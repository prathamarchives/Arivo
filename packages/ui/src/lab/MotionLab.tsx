/**
 * the motion runtime lab — W2's evidence, rendered.
 *
 * sections:
 *   11  the engine — the two-layer map + mass-class demos (enter/exit at
 *       micro/component/surface/spatial) replayed on demand
 *   12  the torture test — drag the object halfway through its animation
 *       and retarget it. if it visibly stops and restarts, the motion
 *       system failed.
 *   13  the scroll runtime — passive velocity sampling, direction, settle
 *       detection; velocity exposure and edge dissolve as OPT-IN effects
 *
 * everything runs through the runtime (motion.* / SpringAnimator /
 * ScrollSampler) — no raw durations exist in this file.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, SPRINGS, SpringAnimator, ScrollSampler } from '../motion/index.ts';
import { cssTransition } from '../motion/index.ts';
import { setReducedMotionOverride } from '../motion/reduced.ts';

/* ---------------- 11 · the engine: mass × direction ---------------- */

const MASSES = ['micro', 'component', 'surface', 'spatial'] as const;
type DemoMass = (typeof MASSES)[number];

function MassRow({ mass }: { mass: DemoMass }): ReactNode {
  const [shown, setShown] = useState(true);
  const [mode, setMode] = useState<'enter' | 'exit'>('enter');
  const enter = motion[mass].enter;
  const exit = motion[mass].exit;
  // replay by key remount: the tile mounts with the enter transition
  const [tick, setTick] = useState(0);

  const spec = shown ? enter : exit;
  const style = {
    transition: cssTransition(spec),
    opacity: shown ? 1 : 0,
    transform: shown ? 'translateY(0)' : 'translateY(10px)',
  };

  return (
    <div className="lab-mass-row">
      <div className="lab-mass-stage">
        <div key={`${tick}-${shown}`} className="lab-mass-tile" style={style}>
          <span className="meta-label">{mass}</span>
        </div>
      </div>
      <div className="lab-mass-controls">
        <span className="meta-label">
          {shown ? enter.duration.ms : exit.duration.ms}ms ·{' '}
          {shown ? enter.easing : exit.easing} · {mode}
        </span>
        <button
          className="btn"
          onClick={() => {
            setMode('enter');
            setShown(true);
            setTick((t) => t + 1);
          }}
        >
          enter
        </button>
        <button
          className="btn"
          onClick={() => {
            setMode('exit');
            setShown(false);
          }}
        >
          exit
        </button>
      </div>
    </div>
  );
}

/* ---------------- 12 · the torture test: drag + retarget ---------------- */

function RetargetProbe(): ReactNode {
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<SpringAnimator | null>(null);
  const dragRef = useRef<{ dragging: boolean; grabOffset: number }>({ dragging: false, grabOffset: 0 });
  const [grabbed, setGrabbed] = useState(false);

  useEffect(() => {
    const knob = knobRef.current;
    if (!knob) return;
    const animator = new SpringAnimator(
      (v) => {
        knob.style.transform = `translateX(${v}px)`;
      },
      SPRINGS.follow,
      0,
    );
    animatorRef.current = animator;
    return () => animator.destroy();
  }, []);

  const bounds = (): { min: number; max: number } => {
    const track = trackRef.current;
    const knob = knobRef.current;
    if (!track || !knob) return { min: 0, max: 0 };
    return { min: 0, max: Math.max(0, track.clientWidth - knob.clientWidth - 4) };
  };

  const clamp = (v: number): number => {
    const { min, max } = bounds();
    return Math.min(max, Math.max(min, v));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!knobRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // grab it wherever it currently is — mid-flight or at rest
    const trackLeft = trackRef.current?.getBoundingClientRect().left ?? 0;
    dragRef.current = { dragging: true, grabOffset: e.clientX - trackLeft - readX(knobRef.current) };
    setGrabbed(true);
  };

  const readX = (knob: HTMLElement): number => {
    const m = /translateX\((-?[\d.]+)px\)/.exec(knob.style.transform);
    return m ? Number(m[1]) : 0;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current.dragging) return;
    const trackLeft = trackRef.current?.getBoundingClientRect().left ?? 0;
    const x = clamp(e.clientX - trackLeft - dragRef.current.grabOffset);
    animatorRef.current?.chase(x); // the spring chases the pointer
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    setGrabbed(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // retarget to the nearest anchor — velocity preserved through release
    const { min, max } = bounds();
    const x = readX(knobRef.current!);
    const nearest = Math.abs(x - min) < Math.abs(x - max) ? min : max;
    animatorRef.current?.to(nearest);
  };

  const send = (): void => {
    const { min, max } = bounds();
    const x = readX(knobRef.current!);
    animatorRef.current?.to(x > (min + max) / 2 ? min : max);
  };

  return (
    <div className="lab-retarget">
      <div
        ref={trackRef}
        className="lab-retarget-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-label="interruption probe — drag the instrument mid-flight"
        aria-valuenow={0}
        tabIndex={0}
      >
        <div ref={knobRef} className={`lab-retarget-knob ${grabbed ? 'is-grabbed' : ''}`}>
          <span className="meta-label">grab me</span>
        </div>
      </div>
      <div className="lab-retarget-controls">
        <button className="btn" onClick={send}>
          send it across
        </button>
        <span className="meta-label">
          {grabbed ? 'following the pointer — velocity live' : 'drag the instrument mid-flight, release anywhere'}
        </span>
      </div>
    </div>
  );
}

/* ---------------- 13 · the scroll runtime ---------------- */

function ScrollRuntimeSection(): ReactNode {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const dirRef = useRef<HTMLSpanElement>(null);
  const settleRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const [exposure, setExposure] = useState(false);
  const [dissolve, setDissolve] = useState(false);
  const exposureRef = useRef(false);
  const dissolveRef = useRef(false);
  const chipAnimRef = useRef<SpringAnimator | null>(null);
  const CHIP_TRACK = 420; // the instrument's rail, in px — the stage owns its geometry

  useEffect(() => {
    exposureRef.current = exposure;
  }, [exposure]);
  useEffect(() => {
    dissolveRef.current = dissolve;
  }, [dissolve]);

  useEffect(() => {
    const el = scrollerRef.current;
    const chip = chipRef.current;
    if (!el || !chip) return;
    const sampler = new ScrollSampler(el);
    const chipAnim = new SpringAnimator(
      (v) => {
        // the exposure effect: the instrument's lift follows velocity,
        // clamped to the tokenized lift vocabulary
        const lift = Math.min(1, Math.abs(v) / 1.2);
        chip.style.transform = `translateX(${(CHIP_TRACK * 2) / 3}px) translateY(${-lift * 6}px)`;
      },
      SPRINGS.follow,
      0,
    );
    chipAnimRef.current = chipAnim;
    const unsub = sampler.onSample((s) => {
      if (readRef.current) readRef.current.textContent = `${s.velocity.toFixed(2)} px/ms`;
      if (dirRef.current) dirRef.current.textContent = s.direction ?? '—';
      if (settleRef.current) settleRef.current.textContent = s.settling ? 'settling' : 'moving';
      if (maskRef.current) {
        const on = dissolveRef.current && !s.settling && s.direction === 'up';
        maskRef.current.style.opacity = on ? '1' : '0';
      }
      if (exposureRef.current && !s.settling) {
        chipAnim.chase(s.velocity);
      }
    });
    sampler.start();
    return () => {
      unsub();
      sampler.destroy();
      chipAnim.destroy();
    };
  }, []);

  return (
    <div className="lab-scroll">
      <div className="lab-scroll-readout">
        <span className="meta-label">
          velocity <span ref={readRef} className="lab-scroll-num">0.00 px/ms</span>
        </span>
        <span className="meta-label">
          direction <span ref={dirRef} className="lab-scroll-num">—</span>
        </span>
        <span className="meta-label">
          state <span ref={settleRef} className="lab-scroll-num">settling</span>
        </span>
        <span className="meta-label">passive · native scroll · law 43</span>
      </div>
      <div className="lab-scroll-stage">
        <div className="lab-scroll-scrolls">
          <div ref={maskRef} className="lab-scroll-dissolve" />
          <div ref={scrollerRef} className="lab-scroll-list">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="lab-scroll-item">
                <span className="meta-label">{String(i + 1).padStart(2, '0')}</span>
                <span>the workspace scrolls; the instrument reacts only if you ask it to</span>
              </div>
            ))}
          </div>
          <div ref={chipRef} className="lab-scroll-chip">
            <span className="meta-label">floating instrument</span>
          </div>
        </div>
        <div className="lab-scroll-controls">
          <button className={`btn ${exposure ? 'btn-solid' : ''}`} onClick={() => setExposure((v) => !v)}>
            velocity exposure {exposure ? 'on' : 'off'}
          </button>
          <button className={`btn ${dissolve ? 'btn-solid' : ''}`} onClick={() => setDissolve((v) => !v)}>
            edge dissolve {dissolve ? 'on' : 'off'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- the composed section ---------------- */

export function MotionRuntimeLab(): ReactNode {
  const [twinForced, setTwinForced] = useState(false);

  useEffect(() => {
    return () => {
      setReducedMotionOverride(null); // leaving the section restores the os truth
    };
  }, []);

  const forceTwins = (): void => {
    const next = !twinForced;
    setReducedMotionOverride(next); // physics snaps instead of following
    document.documentElement.setAttribute('data-lab-reduced', next ? '1' : '0'); // css twins at 0ms
    setTwinForced(next);
  };

  return (
    <>
      <section className="lab-section">
        <LabHead
          n="11"
          title="motion runtime — the engine"
          note="css for state · springs for physics · no raw durations"
        />
        <div className="lab-engine-map">
          <div className="lab-panel surface">
            <span className="meta-label">state motion — css</span>
            <span>
              hover · focus · press receipts · color/border shifts · simple entrances. cheap, tokenized,
              zeroed by the reduced-motion block.
            </span>
          </div>
          <div className="lab-panel raised-2">
            <span className="meta-label">physical motion — spring runtime</span>
            <span>
              drag · following instruments · pill travel. velocity-continuous, interruptible, visibility-
              paused. ζ ≥ 1 — no bounce, ever.
            </span>
          </div>
        </div>
        {MASSES.map((mass) => (
          <MassRow key={mass} mass={mass} />
        ))}
        <div className="lab-twin-controls">
          <button className={`btn ${twinForced ? 'btn-solid' : ''}`} onClick={forceTwins}>
            inspect reduced-motion twins
          </button>
          <span className="meta-label">
            forces the twins regardless of os setting — physics snaps, css zeroes. lab-only.
          </span>
        </div>
      </section>

      <section className="lab-section">
        <LabHead
          n="12"
          title="the torture test — interruption"
          note="drag it mid-flight · release anywhere · no stop-and-restart"
        />
        <RetargetProbe />
      </section>

      <section className="lab-section">
        <LabHead
          n="13"
          title="scroll runtime — passive observation"
          note="velocity sampler · settle detection · effects opt-in"
        />
        <ScrollRuntimeSection />
      </section>
    </>
  );
}

function LabHead({ n, title, note }: { n: string; title: string; note?: string }): ReactNode {
  return (
    <div className="lab-h">
      <span className="meta-label">{n}</span>
      <span className="type-title">{title}</span>
      {note ? <span className="meta-label">{note}</span> : null}
    </div>
  );
}
