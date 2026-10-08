/**
 * spatial — the physics layer of the motion runtime.
 *
 * PHYSICAL MOTION lives here: drag, gesture, interruptible spatial
 * movement — the book pull-out, the floating instrument following a
 * selection, the mode pill's travel. springs (not css) because velocity
 * continuity actually matters in exactly these places.
 *
 * the laws this engine enforces:
 *   - no bounce: every config must have damping ratio >= 1 (law 28)
 *   - interruptible: follow() mid-flight starts from the current state
 *     and KEEPS velocity — a retarget never jumps, never restarts (law 29)
 *   - exact rest: on settle the value snaps to target, velocity to zero
 *   - idle cost zero: the rAF loop only runs while unsettled (law 42)
 *   - visibility pause: hidden tab → the loop stops in place
 *   - reduced motion: follow() degrades to an instant snap (law 34)
 */

import { isNoBounce, type SpringConfig } from './mass.ts';
import { prefersReducedMotion } from './reduced.ts';

const SETTLE_EPS = 0.05; // px from target
const SETTLE_V_EPS = 0.01; // px per frame-ish
const MAX_DT = 34; // ms per integration step — tab-switch gaps get clamped

/** one spring. pure computation — no dom, no clock. ticks are fed in. */
export class Spring {
  private x: number;
  private v = 0;
  private target: number;
  private readonly config: SpringConfig;
  private _settled = false;

  constructor(config: SpringConfig, initial = 0) {
    if (!isNoBounce(config)) {
      throw new Error(
        `spring config violates the no-bounce law (ζ < 1): ${JSON.stringify(config)}. ` +
          'damping must satisfy 1 <= ζ < 2.5 — tune via SPRINGS or a specimen review.',
      );
    }
    this.config = config;
    this.x = initial;
    this.target = initial;
  }

  get value(): number {
    return this.x;
  }
  get velocity(): number {
    return this.v;
  }
  get settled(): boolean {
    return this._settled;
  }
  get restingTarget(): number {
    return this.target;
  }

  /** jump: no travel, no velocity. the reduced-motion path. */
  snap(value: number): void {
    this.x = value;
    this.v = 0;
    this.target = value;
    this._settled = true;
  }

  /**
   * retarget: the interruption primitive. position and velocity are
   * preserved — the spring curves toward the new target from wherever it
   * currently is, at whatever speed it currently has.
   */
  follow(target: number): void {
    this.target = target;
    this._settled = false;
  }

  /** advance one step. dt in ms; huge gaps are clamped (physics stays
   *  stable across a hidden tab without teleporting). */
  tick(dtMs: number): number {
    if (this._settled) return this.x;
    const dt = Math.min(Math.max(dtMs, 0), MAX_DT) / 1000;
    if (dt <= 0) return this.x;
    const { stiffness: k, damping: c, mass: m } = this.config;
    // semi-implicit euler: velocity first, then position with the new
    // velocity — unconditionally stable for these step sizes
    const force = -k * (this.x - this.target) - c * this.v;
    this.v += (force / m) * dt;
    this.x += this.v * dt;
    if (Math.abs(this.x - this.target) < SETTLE_EPS && Math.abs(this.v) < SETTLE_V_EPS) {
      this.snap(this.target); // exact rest — the last law of viscous precision
    }
    return this.x;
  }
}

/** a write effect for an animator: receives the value each frame */
export type SpringWrite = (value: number) => void;

/**
 * a spring driven by rAF. writes through the callback — typically a
 * transform writer. the loop exists ONLY while the spring is unsettled:
 * an idle animator costs nothing (law 42 — a useful effect justifies its
 * cost; motion at rest has no cost at all).
 */
export class SpringAnimator {
  private readonly spring: Spring;
  private readonly write: SpringWrite;
  private raf: number | null = null;
  private last: number | null = null;
  private paused = false;
  private readonly onHidden: () => void;
  private readonly onVisible: () => void;
  private destroyed = false;
  private readonly observer: IntersectionObserver | null = null;
  private readonly observedEl: Element | null;
  private readonly onIntersection: (entries: IntersectionObserverEntry[]) => void;
  private inView = true;

  constructor(write: SpringWrite, config: SpringConfig, initial = 0, observe?: Element | null) {
    this.spring = new Spring(config, initial);
    this.write = write;
    write(initial);

    this.observedEl = observe ?? null;

    // visibility pause: hidden tab → the loop stops in place, mid-flight
    this.onHidden = (): void => {
      this.pause();
    };
    this.onVisible = (): void => {
      this.resume();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }

    // in-view pause: an instrument scrolled out of the room stops paying
    // for motion. only when an element is handed over.
    this.onIntersection = (entries): void => {
      this.inView = entries[0]?.isIntersecting ?? true;
      if (!this.inView) this.pause();
      else this.resume();
    };
    if (this.observedEl && typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(this.onIntersection);
      this.observer.observe(this.observedEl);
    }
  }

  private onVisibility = (): void => {
    if (typeof document !== 'undefined' && document.hidden) this.onHidden();
    else this.onVisible();
  };

  /** animate/retarget to a value. reduced motion → snap. */
  to(target: number): void {
    if (this.destroyed) return;
    if (prefersReducedMotion()) {
      this.spring.snap(target);
      this.write(this.spring.value);
      this.stopLoop();
      return;
    }
    this.spring.follow(target);
    this.resume();
  }

  /** jump instantly (programmatic positioning, not a motion) */
  snap(target: number): void {
    if (this.destroyed) return;
    this.spring.snap(target);
    this.write(this.spring.value);
    this.stopLoop();
  }

  /** feed the pointer's live position into the spring as a moving target.
   *  the spring chases it — this is what makes drag feel continuous. */
  chase(target: number): void {
    this.to(target);
  }

  pause(): void {
    this.paused = true;
    this.stopLoop();
  }

  resume(): void {
    if (this.destroyed || !this.inView) return;
    this.paused = false; // resume is the PAIRED release of pause — deadlock is a bug
    this.startLoop();
  }

  get settled(): boolean {
    return this.spring.settled;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopLoop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    this.observer?.disconnect();
  }

  private startLoop(): void {
    if (this.raf !== null || this.spring.settled) return;
    this.last = null;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stopLoop(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    this.last = null;
  }

  private frame = (now: number): void => {
    this.raf = null;
    if (this.paused || this.destroyed) return;
    if (this.last === null) this.last = now;
    this.spring.tick(now - this.last);
    this.last = now;
    this.write(this.spring.value);
    if (!this.spring.settled) {
      this.raf = requestAnimationFrame(this.frame);
    } else {
      this.raf = null;
    }
  };
}

/** a transform writer: value → `transform: translateX(${v}px)` etc. */
export function transformWriter(
  el: HTMLElement,
  axis: 'x' | 'y' | 'scale',
): SpringWrite {
  return (v: number): void => {
    if (axis === 'scale') {
      el.style.transform = `scale(${v})`;
    } else {
      el.style.transform = `translate${axis === 'x' ? 'X' : 'Y'}(${v}px)`;
    }
  };
}

/** combined writer: multiple axes in one transform string */
export function compositeTransformWriter(
  el: HTMLElement,
  axes: { x?: number; y?: number; scale?: number },
  key: keyof { x: number; y: number; scale: number },
): SpringWrite {
  return (v: number): void => {
    const next = { ...axes, [key]: v };
    const parts: string[] = [];
    if (next.x) parts.push(`translateX(${next.x}px)`);
    if (next.y) parts.push(`translateY(${next.y}px)`);
    if (next.scale && next.scale !== 1) parts.push(`scale(${next.scale})`);
    el.style.transform = parts.join(' ') || 'none';
  };
}
