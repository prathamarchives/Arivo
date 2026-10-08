/**
 * the motion runtime's gate — W2 must prove:
 *   no arbitrary durations · no bounce · no layout animation by accident ·
 *   reduced motion · interruption · visibility pause · reader scroll native
 *
 * every checker runs against the real runtime AND a seeded violation is
 * caught — same discipline as tests/design-law.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CURVE_POINTS,
  curveForJob,
  bezier,
  type CurveName,
} from './curves.ts';
import { DURATION_LADDER, durationFor, REDUCED_MS } from './durations.ts';
import { SPRINGS, dampingRatio, isNoBounce } from './mass.ts';
import {
  prefersReducedMotion,
  setReducedMotionOverride,
  twinForJob,
} from './reduced.ts';
import { cssTransition, cssTransitionMs, crossfadeTwin, twinFor } from './transitions.ts';
import { Spring, SpringAnimator, transformWriter } from './spatial.ts';
import { ingestSample, isSettled, newSampleCore, ScrollSampler } from './scroll.ts';
import { defineMotion } from './spec.ts';
import type { MotionSpec } from './spec.ts';
import { motion } from './index.ts';

const HERE = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const TOKENS = readFileSync(join(HERE, 'tokens.css'), 'utf-8');

/* ---- the rAF harness: manual frame control for every loop in this file ---- */

type FrameCb = (ts: number) => void;
let queue: { cb: FrameCb; id: number }[] = [];
let nextId = 0;

beforeEach(() => {
  queue = [];
  nextId = 0;
  (globalThis as Record<string, unknown>).requestAnimationFrame = (cb: FrameCb): number => {
    queue.push({ cb, id: ++nextId });
    return nextId;
  };
  (globalThis as Record<string, unknown>).cancelAnimationFrame = (id: number): void => {
    queue = queue.filter((f) => f.id !== id);
  };
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).requestAnimationFrame;
  delete (globalThis as Record<string, unknown>).cancelAnimationFrame;
});

/* ---------------- the duration ladder is closed ---------------- */

describe('W2 gate: no arbitrary durations', () => {
  it('the ladder IS the MOTION.md table', () => {
    const table: Record<string, [number, number]> = {
      micro: [120, 90],
      component: [200, 140],
      surface: [320, 220],
      spatial: [560, 380],
      state: [150, 150],
      turn: [250, 250],
      material: [700, 700],
      atmosphere: [1400, 1400],
    };
    for (const [mass, [enter, exit]] of Object.entries(table)) {
      expect(durationFor(mass as never, 'enter').ms).toBe(enter);
      expect(durationFor(mass as never, 'exit').ms).toBe(exit);
    }
  });

  it('entering breathes; leaving is brisk — exit < enter at every mass', () => {
    for (const [mass] of DURATION_LADDER) {
      const enter = durationFor(mass, 'enter').ms;
      const exit = durationFor(mass, 'exit').ms;
      expect(exit).toBeLessThanOrEqual(enter);
    }
  });

  it('every runtime duration mirrors its token in tokens.css', () => {
    for (const [mass, enter, exit, token] of DURATION_LADDER) {
      expect(TOKENS.includes(`${token}: ${enter}ms`)).toBe(true);
      expect(TOKENS.includes(`${durationFor(mass, 'exit').token}: ${exit}ms`)).toBe(true);
    }
  });

  it('the contract input has no numeric slot — durations enter only via the ladder', () => {
    const spec = defineMotion({ mass: 'surface', job: 'enter' }) as MotionSpec;
    expect(spec.duration.ms).toBe(320);
    expect(spec.duration.token).toBe('--dur-surface-in');
    // the type has no duration/ms field; attempting one is a compile error,
    // and the runtime refuses to be constructed any other way
    expect(Object.keys(spec).sort()).toEqual(
      [
        'direction',
        'duration',
        'easing',
        'easingToken',
        'interruptible',
        'job',
        'kind',
        'layoutReason',
        'mass',
        'properties',
        'reducedMotion',
      ].sort(),
    );
  });
});

/* ---------------- the curve vocabulary ---------------- */

describe('W2 gate: the easing vocabulary stays closed', () => {
  it('exactly four curves; the runtime mirrors tokens.css', () => {
    expect(Object.keys(CURVE_POINTS).sort()).toEqual(['glide', 'retreat', 'settle', 'shift']);
    for (const name of Object.keys(CURVE_POINTS) as CurveName[]) {
      expect(TOKENS.includes(`--ease-${name}: ${bezier(name)}`)).toBe(true);
    }
  });

  it('jobs map to their assigned curve', () => {
    expect(curveForJob('enter')).toBe('glide');
    expect(curveForJob('exit')).toBe('retreat');
    expect(curveForJob('shift')).toBe('shift');
    expect(curveForJob('follow')).toBe('shift');
    expect(curveForJob('turn')).toBe('glide');
    expect(curveForJob('hover')).toBe('settle');
    expect(curveForJob('press')).toBe('settle');
  });
});

/* ---------------- the contract constructor ---------------- */

describe('W2 gate: the contract refuses unconstitutional input', () => {
  it('press is a micro receipt — nothing heavier', () => {
    expect(() => defineMotion({ mass: 'component', job: 'press' })).toThrow(/micro/);
  });

  it('hover/focus/selection are state mass', () => {
    expect(() => defineMotion({ mass: 'component', job: 'hover' })).toThrow(/state/);
    expect(() => defineMotion({ mass: 'micro', job: 'focus' })).toThrow(/state/);
  });

  it('the page turn is its own mass — never delay reading', () => {
    expect(() => defineMotion({ mass: 'surface', job: 'turn' })).toThrow(/law 33/);
  });

  it('layout properties animate only with a measured reason', () => {
    expect(() =>
      defineMotion({ mass: 'surface', job: 'enter', properties: ['--layout:width'] as never }),
    ).toThrow(/measuredReason/);
    const ok = defineMotion({
      mass: 'surface',
      job: 'enter',
      properties: ['--layout:width'] as never,
      measuredReason: 'drawer width is measured: content reflow proof #12',
    }) as MotionSpec;
    expect(ok.layoutReason).toContain('drawer width');
  });

  it('follow belongs to physics — never to css transitions', () => {
    const spec = defineMotion({ mass: 'spatial', job: 'follow' });
    expect(spec.kind).toBe('physics');
    expect(() => cssTransition(spec as never)).toThrow(/physics/);
    expect(() => defineMotion({ mass: 'spatial', job: 'follow', properties: ['transform'] })).toThrow(
      /spring runtime/,
    );
  });
});

/* ---------------- the semantic tree ---------------- */

describe('W2: the semantic tree answers questions, not numbers', () => {
  it('every canonical motion is addressable and correct', () => {
    expect(motion.surface.enter.duration.ms).toBe(320);
    expect(motion.surface.enter.easing).toBe('glide');
    expect(motion.surface.exit.duration.ms).toBe(220);
    expect(motion.surface.exit.easing).toBe('retreat');
    expect(motion.component.enter.duration.ms).toBe(200);
    expect(motion.micro.exit.duration.ms).toBe(90);
    expect(motion.spatial.enter.duration.ms).toBe(560);
    expect(motion.press.duration.ms).toBe(120);
    expect(motion.press.properties).toEqual(['transform']);
    expect(motion.hover.duration.token).toBe('--dur-state');
    expect(motion.hover.properties).toEqual(['color', 'background', 'border-color']);
    expect(motion.turn.settle.duration.ms).toBe(250);
    expect(motion.turn.settle.easing).toBe('glide');
    expect(motion.material.shift.duration.ms).toBe(700);
    expect(motion.atmosphere.shift.duration.ms).toBe(1400);
    expect(motion.spatial.follow.kind).toBe('physics');
    expect(motion.spatial.follow.interruptible).toBe(true);
  });

  it('cssTransition emits token form — durations and easings as var()', () => {
    expect(cssTransition(motion.surface.enter)).toBe(
      'transform var(--dur-surface-in) var(--ease-glide), opacity var(--dur-surface-in) var(--ease-glide)',
    );
    expect(cssTransition(motion.press)).toBe('transform var(--dur-micro-in) var(--ease-settle)');
  });
});

/* ---------------- reduced motion ---------------- */

describe('W2 gate: every motion has a reduced-motion twin', () => {
  it('every job has a default twin', () => {
    for (const job of [
      'enter',
      'exit',
      'shift',
      'follow',
      'settle',
      'turn',
      'hover',
      'press',
      'focus',
      'selection',
      'material',
      'atmosphere',
    ]) {
      expect(['crossfade', 'instant', 'none']).toContain(twinForJob(job));
    }
  });

  it('REDUCED_MS is zero and the ms-mode twin honors it', () => {
    expect(REDUCED_MS).toBe(0);
    expect(cssTransitionMs(motion.surface.enter, true)).not.toContain('320');
    expect(cssTransitionMs(motion.surface.enter, true)).toContain('0ms');
  });

  it('the semantic tree carries twins on every spec', () => {
    for (const spec of [
      motion.micro.enter,
      motion.micro.exit,
      motion.component.enter,
      motion.component.exit,
      motion.surface.enter,
      motion.surface.exit,
      motion.spatial.enter,
      motion.spatial.exit,
      motion.state.shift,
      motion.turn.settle,
      motion.material.shift,
      motion.atmosphere.shift,
      motion.press,
      motion.hover,
      motion.focus,
      motion.selection,
    ]) {
      expect(['crossfade', 'instant', 'none']).toContain(spec.reducedMotion);
    }
    expect(motion.surface.enter.reducedMotion).toBe('crossfade');
    expect(motion.atmosphere.shift.reducedMotion).toBe('none');
  });

  it('the twin forms are exact', () => {
    expect(crossfadeTwin()).toBe('opacity var(--dur-state) var(--ease-settle)');
    expect(twinFor(motion.atmosphere.shift)).toBe('none');
  });

  it('the override is lab-only and restores cleanly', () => {
    expect(prefersReducedMotion()).toBe(false); // node: no motion system
    setReducedMotionOverride(true);
    expect(prefersReducedMotion()).toBe(true);
    setReducedMotionOverride(null);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('physics snaps under reduced motion instead of animating', () => {
    setReducedMotionOverride(true);
    try {
      const writes: number[] = [];
      const animator = new SpringAnimator((v) => writes.push(v), SPRINGS.follow, 0);
      animator.to(100);
      expect(writes.at(-1)).toBe(100); // snapped, no travel
      animator.destroy();
    } finally {
      setReducedMotionOverride(null);
    }
  });
});

/* ---------------- no bounce ---------------- */

describe('W2 gate: no bounce, no elastic, no rebound — ever', () => {
  it('every sanctioned spring is critically damped or above (ζ >= 1)', () => {
    for (const config of Object.values(SPRINGS)) {
      expect(dampingRatio(config)).toBeGreaterThanOrEqual(1);
      expect(isNoBounce(config)).toBe(true);
    }
    const follow = motion.spatial.follow.spring;
    expect(dampingRatio(follow)).toBeGreaterThanOrEqual(1);
  });

  it('the spring constructor rejects a bouncy config', () => {
    expect(() => new Spring({ stiffness: 170, damping: 10, mass: 1 })).toThrow(/no-bounce/);
  });

  it('simulated travel never overshoots the target', () => {
    const configs = [
      ...Object.values(SPRINGS),
      motion.spatial.follow.spring,
      motion.spatial.followComponent.spring,
    ];
    for (const config of configs) {
      const s = new Spring(config, 0);
      s.follow(100);
      let peak = -Infinity;
      // run until the spring itself declares exact rest (capped: 24s simulated)
      for (let i = 0; i < 1500 && !s.settled; i++) {
        peak = Math.max(peak, s.tick(16));
      }
      expect(peak).toBeLessThanOrEqual(100.001); // no overshoot, ever
      expect(s.settled).toBe(true);
      expect(s.value).toBe(100); // exact rest
    }
  });
});

/* ---------------- interruption ---------------- */

describe('W2 gate: interruption preserves position and velocity', () => {
  it('a retarget mid-flight starts from the current state, never jumps', () => {
    const s = new Spring(SPRINGS.follow, 0);
    s.follow(100);
    for (let i = 0; i < 12; i++) s.tick(16); // mid-flight
    const [xBefore, vBefore] = [s.value, s.velocity];
    expect(xBefore).toBeGreaterThan(0);
    expect(xBefore).toBeLessThan(100);
    s.follow(200); // the interruption — a new destination arrives
    expect(s.value).toBe(xBefore); // position continuity: no jump
    expect(s.velocity).toBe(vBefore); // velocity continuity: no restart
    for (let i = 0; i < 300; i++) s.tick(16);
    expect(s.value).toBe(200);
    expect(s.settled).toBe(true);
  });

  it('the tab-switch gap is clamped — physics does not teleport', () => {
    const s = new Spring(SPRINGS.follow, 0);
    s.follow(1000);
    for (let i = 0; i < 10; i++) s.tick(16);
    const before = s.value;
    s.tick(60_000); // a hidden minute
    expect(s.value).toBeGreaterThan(before);
    expect(s.value).toBeLessThan(1000);
  });

  it('settle means exact rest: value snapped to target, velocity zero', () => {
    const s = new Spring(SPRINGS.travel, 0);
    s.follow(50);
    for (let i = 0; i < 500; i++) s.tick(16);
    expect(s.settled).toBe(true);
    expect(s.value).toBe(50);
    expect(s.velocity).toBe(0);
  });
});

/* ---------------- the animator loop + visibility pause ---------------- */

function flushFrames(n: number, dt: number): void {
  let ts = 0;
  for (let i = 0; i < n; i++) {
    ts += dt;
    const running = queue;
    queue = [];
    for (const f of running) f.cb(ts);
  }
}

describe('W2 gate: the animator pays zero when idle, pauses when hidden', () => {
  it('settled motion schedules nothing — idle cost is zero', () => {
    const animator = new SpringAnimator(() => {}, SPRINGS.follow, 0);
    expect(queue).toHaveLength(0); // construction is free
    animator.destroy();
  });

  it('motion runs the loop, writes every frame, and stops at rest', () => {
    const writes: number[] = [];
    const animator = new SpringAnimator((v) => writes.push(v), SPRINGS.follow, 0);
    animator.to(100);
    expect(queue.length).toBeGreaterThan(0);
    flushFrames(400, 16);
    expect(queue).toHaveLength(0); // the loop ended itself at settle
    expect(writes.at(-1)).toBe(100);
    animator.destroy();
  });

  it('pause stops the loop mid-flight; resume continues from the same state', () => {
    const animator = new SpringAnimator(() => {}, SPRINGS.follow, 0);
    animator.to(100);
    flushFrames(10, 16); // mid-flight
    expect(queue.length).toBeGreaterThan(0);
    animator.pause(); // the hidden-tab path
    expect(queue).toHaveLength(0);
    flushFrames(10, 16); // nothing advances while paused
    animator.resume();
    expect(queue.length).toBeGreaterThan(0);
    flushFrames(400, 16);
    expect(queue).toHaveLength(0);
    animator.destroy();
  });
});

/* ---------------- the scroll runtime ---------------- */

describe('W2 gate: scroll sampling — passive, budgeted, native', () => {
  it('velocity and direction from synthetic travel', () => {
    const core = newSampleCore();
    ingestSample(core, 0, 0);
    // 2px/ms sustained downward
    for (let t = 16; t <= 320; t += 16) {
      const { sample } = ingestSample(core, (t / 16) * 32, t);
      if (t >= 64) {
        expect(sample.velocity).toBeGreaterThan(0.5);
        expect(sample.direction).toBe('down');
      }
    }
    // a hard stop: stillness settles
    expect(isSettled(core, 320 + 10)).toBe(false);
    expect(isSettled(core, 320 + 200)).toBe(true);
  });

  it('direction flips with upward travel; sub-pixel jitter is noise, not motion', () => {
    const core = newSampleCore();
    ingestSample(core, 1000, 0);
    const sample = ingestSample(core, 1000 - 160, 16).sample; // 10px/ms up
    expect(sample.direction).toBe('up');
    // jitter below the noise floor contributes zero — velocity decays to settle
    let last = sample;
    for (let i = 0; i < 15; i++) {
      last = ingestSample(core, 1000 - 160 + (i % 2 ? 0.2 : -0.2), 32 + i * 16).sample;
    }
    expect(last.settling).toBe(true);
    expect(last.direction).toBe(null);
  });

  it('the sampler observes passively — never preventDefault, never write', () => {
    const registrations: { type: string; opts: AddEventListenerOptions | undefined }[] = [];
    const listeners: Record<string, () => void> = {};
    const fake = {
      addEventListener: (type: string, cb: () => void, opts?: AddEventListenerOptions): void => {
        registrations.push({ type, opts });
        listeners[type] = cb;
      },
      removeEventListener: (): void => {},
    } as unknown as HTMLElement;
    const pos = { v: 0 };
    const sampler = new ScrollSampler(fake, () => pos.v);
    sampler.start();
    expect(registrations.every((r) => r.opts?.passive === true)).toBe(true);
    pos.v = 500;
    listeners.scroll?.();
    expect(sampler.onSample(() => {}) instanceof Function).toBe(true); // subscribable
    sampler.destroy(); // cleans up without touching scroll position
    expect(pos.v).toBe(500);
  });
});

/* ---------------- the two-layer split ---------------- */

describe('W2: state motion is css; physical motion is the spring runtime', () => {
  it('css specs address tokens; physics specs address springs', () => {
    expect(motion.hover.kind).toBe('css');
    expect(motion.surface.enter.kind).toBe('css');
    expect(motion.spatial.follow.kind).toBe('physics');
    expect(motion.spatial.follow.spring.stiffness).toBeGreaterThan(0);
  });

  it('transformWriter writes transform only — never layout properties', () => {
    const fake = { style: { transform: '' } } as unknown as HTMLElement;
    const w = transformWriter(fake, 'x');
    w(24);
    expect(fake.style.transform).toBe('translateX(24px)');
    expect(Object.keys(fake.style)).toEqual(['transform']);
  });
});

/* ---------------- seeded violations are caught ---------------- */

describe('the motion checkers work — seeded violations are caught', () => {
  it('a bouncy spring cannot be constructed', () => {
    expect(() => new Spring({ stiffness: 200, damping: 20, mass: 1 })).toThrow();
  });

  it('an off-ladder duration cannot be expressed through the contract', () => {
    // the only way to get a duration is durationFor — and it returns the table
    expect(durationFor('surface', 'enter').ms).not.toBe(321);
    expect(DURATION_LADDER.find(([, enter]) => enter === 250)).toBeDefined(); // turn exists
    expect(DURATION_LADDER.find(([, enter]) => enter === 330)).toBeUndefined(); // invented values don't
  });

  it('a physics job asked of css throws', () => {
    expect(() => cssTransition(motion.spatial.follow as never)).toThrow(/physics/);
  });
});
