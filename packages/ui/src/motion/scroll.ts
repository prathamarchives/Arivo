/**
 * scroll — the scroll runtime (law 43 / 44).
 *
 * reader scroll is native and sacred. this sampler NEVER hijacks, never
 * preventDefaults, never writes scrollTop — it only observes, and it does
 * so on a budget:
 *
 *   - zero cost at rest (the rAF loop starts on first scroll, stops after
 *     settle — an idle list costs exactly nothing)
 *   - one computation per frame while scrolling (ema-smoothed velocity)
 *   - pauses when the tab is hidden
 *
 * the effects that may consume it (velocity exposure, edge dissolve near
 * floating chrome) are OPT-IN and off by default — the lab can prove them
 * with ON/OFF without tying anything to the product.
 */

export type ScrollDirection = 'up' | 'down' | null;

export interface ScrollSample {
  /** px per ms, signed (down positive), ema-smoothed */
  readonly velocity: number;
  readonly direction: ScrollDirection;
  /** true while |velocity| is under the settle threshold */
  readonly settling: boolean;
}

export interface ScrollState extends ScrollSample {
  readonly scrolling: boolean;
}

/** pure core — the transform from raw positions to a sample. testable in node. */
export interface SampleCore {
  lastPos: number | null;
  lastTs: number;
  velocity: number; // px/ms ema
  lastMoveTs: number; // ts of last movement above noise
}

const EMA_ALPHA = 0.4; // smoothing: 40% new, 60% history — responsive, not jittery
const NOISE_PX = 0.5; // sub-pixel jitter is not motion
const SETTLE_VELOCITY = 0.04; // px/ms — below this we call it settling
const SETTLE_HOLD = 140; // ms of stillness before "settled"

export function newSampleCore(): SampleCore {
  return { lastPos: null, lastTs: 0, velocity: 0, lastMoveTs: 0 };
}

/** ingest one (position, timestamp) observation → the current sample.
 *  stillness decays velocity (raw = 0 blends into the ema) — a scroll
 *  stream that stops must settle, not remember its speed forever. */
export function ingestSample(
  core: SampleCore,
  pos: number,
  ts: number,
): { sample: ScrollSample; moved: boolean } {
  let moved = false;
  if (core.lastPos === null) {
    core.lastPos = pos;
    core.lastTs = ts;
    return {
      sample: { velocity: 0, direction: null, settling: true },
      moved: false,
    };
  }
  const dt = ts - core.lastTs;
  const dx = pos - core.lastPos;
  const hasMotion = dt > 0 && Math.abs(dx) > NOISE_PX;
  const raw = hasMotion ? dx / dt : 0; // still frames contribute zero, not memory
  if (hasMotion) {
    core.velocity = core.velocity === 0 ? raw : EMA_ALPHA * raw + (1 - EMA_ALPHA) * core.velocity;
    core.lastMoveTs = ts;
    moved = true;
  } else {
    core.velocity = EMA_ALPHA * raw + (1 - EMA_ALPHA) * core.velocity; // decays toward 0
  }
  core.lastPos = pos;
  core.lastTs = ts;
  const direction: ScrollDirection =
    Math.abs(core.velocity) < SETTLE_VELOCITY ? null : core.velocity > 0 ? 'down' : 'up';
  const settling = Math.abs(core.velocity) < SETTLE_VELOCITY;
  return { sample: { velocity: core.velocity, direction, settling }, moved };
}

/** has the stream been still long enough to call it settled? */
export function isSettled(core: SampleCore, ts: number): boolean {
  return ts - core.lastMoveTs > SETTLE_HOLD;
}

/**
 * the passive observer. attach to the scroller that owns chrome effects
 * (never the reader column itself — the reader stays untouched, law 43).
 */
export class ScrollSampler {
  private readonly core = newSampleCore();
  private raf: number | null = null;
  private dirty = false;
  private destroyed = false;
  private readonly listeners = new Set<(s: ScrollState) => void>();
  private readonly target: HTMLElement | Window;
  private readonly read: (() => number) | null;
  private readonly onScroll: () => void;
  private readonly onVisibility: () => void;

  /**
   * @param target the scroller that owns chrome effects (never the reader
   *        column itself — the reader stays native, law 43)
   * @param read optional position override (tests; the lab can also point
   *        it at any scroll source)
   */
  constructor(
    target: HTMLElement | Window = typeof window !== 'undefined' ? window : (undefined as never),
    read?: () => number,
  ) {
    this.target = target;
    this.read = read ?? null;
    this.onScroll = (): void => {
      this.dirty = true;
      this.startLoop();
    };
    this.onVisibility = (): void => {
      if (typeof document !== 'undefined' && document.hidden) this.stopLoop();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  start(): void {
    this.target.addEventListener('scroll', this.onScroll, { passive: true });
  }

  stop(): void {
    this.target.removeEventListener('scroll', this.onScroll);
    this.stopLoop();
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.listeners.clear();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
  }

  /** subscribe to per-frame samples while scrolling. returns unsubscribe. */
  onSample(cb: (s: ScrollState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private readPos(): number {
    if (this.read) return this.read();
    if (this.target instanceof HTMLElement) return this.target.scrollTop;
    return this.target.scrollY;
  }

  private startLoop(): void {
    if (this.raf !== null || this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stopLoop(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    this.dirty = false;
  }

  private frame = (): void => {
    this.raf = null;
    if (this.destroyed) return;
    this.dirty = false; // consumed — scroll events arriving during this frame re-set it
    const ts = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const { sample } = ingestSample(this.core, this.readPos(), ts);
    const settled = isSettled(this.core, ts);
    const state: ScrollState = { ...sample, scrolling: !settled };
    for (const cb of this.listeners) cb(state);
    // budget law: the loop lives only while motion or its settle-tail does
    if (!settled) {
      this.raf = requestAnimationFrame(this.frame);
    }
  };
}
