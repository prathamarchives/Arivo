/**
 * spec — the motion contract. the heart of L3.
 *
 * a component never says `duration: 320`. it says WHAT it is doing:
 *
 *   motion.define({ mass: 'surface', job: 'enter', interruptible: true })
 *
 * and the system decides the number, the curve, the twin, and the
 * interruptibility semantics. the contract is checked at construction —
 * invalid combinations (a bounce, a layout property without a measured
 * reason, a physics job asked of css) throw. it should be difficult to
 * violate the constitution, not just forbidden.
 */

import { curveForJob, type CurveName } from './curves.ts';
import { directionForJob, durationFor, type Direction, type MotionMass } from './durations.ts';
import { twinForJob, type ReducedTwin } from './reduced.ts';
import type { SpringConfig } from './mass.ts';

/** the jobs a motion can be asked to do */
export type MotionJob =
  | 'enter'
  | 'exit'
  | 'shift'
  | 'follow'
  | 'settle'
  | 'turn'
  | 'hover'
  | 'press'
  | 'focus'
  | 'selection'
  | 'material';

/** properties motion is allowed to touch. transform/opacity are free;
 *  layout properties (width/height/top/left/gap...) animate ONLY with a
 *  measured reason — law 1 of MOTION.md, enforced here. */
export type MotionProperty =
  | 'transform'
  | 'opacity'
  | 'background'
  | 'color'
  | 'border-color'
  | 'box-shadow'
  | 'filter'
  | 'clip-path';

/** the layout-property escape hatch: allowed, but never anonymous */
export type LayoutProperty = `--layout:${string}`;
export type AnyMotionProperty = MotionProperty | LayoutProperty;

/** css-layer spec: durations/curves from the ladder, consumed as var()s */
export interface MotionSpec {
  readonly kind: 'css';
  readonly mass: MotionMass;
  readonly job: MotionJob;
  readonly direction: Direction;
  readonly duration: { ms: number; token: string };
  readonly easing: CurveName;
  readonly easingToken: string;
  readonly properties: readonly AnyMotionProperty[];
  readonly interruptible: boolean;
  readonly reducedMotion: ReducedTwin;
  /** the measured reason, when a layout property animates */
  readonly layoutReason: string | null;
}

/** physics-layer spec: velocity-continuous, interruptible by nature */
export interface PhysicalMotionSpec {
  readonly kind: 'physics';
  readonly mass: MotionMass;
  readonly job: 'follow' | 'settle' | 'shift';
  readonly spring: SpringConfig;
  readonly interruptible: true;
  readonly reducedMotion: ReducedTwin;
}

export type AnyMotionSpec = MotionSpec | PhysicalMotionSpec;

/** the input to motion.define — semantic, no numbers allowed in */
export interface MotionContractInput {
  mass: MotionMass;
  job: MotionJob;
  /** overrides the job-implied twin — rare, recorded in DECISIONS.md */
  reducedMotion?: ReducedTwin;
  /** css-layer only: properties in play. defaults per job below. */
  properties?: AnyMotionProperty[];
  /** REQUIRED when a `--layout:*` property is present — the measured reason */
  measuredReason?: string;
}

const DEFAULT_PROPERTIES: Record<string, readonly MotionProperty[]> = {
  enter: ['transform', 'opacity'],
  exit: ['transform', 'opacity'],
  shift: ['transform'],
  follow: ['transform'], // physics owns follow; css fallback = transform
  settle: ['transform'],
  turn: ['transform', 'opacity'],
  hover: ['color', 'background', 'border-color'],
  press: ['transform'],
  focus: ['box-shadow', 'border-color'],
  selection: ['background', 'color', 'border-color'],
  material: ['background', 'color', 'box-shadow'],
};


function fail(input: MotionContractInput, why: string): never {
  throw new Error(`motion.define(${input.mass}/${input.job}): ${why}`);
}

/**
 * the motion contract constructor. throws on every unconstitutional
 * combination — the violation surfaces at authoring time, not review time.
 */
export function defineMotion(input: MotionContractInput): MotionSpec | PhysicalMotionSpec {
  const { mass, job } = input;

  // physics jobs belong to the spring runtime — never to css
  if (job === 'follow') {
    if (input.properties) fail(input, 'follow is physical motion — use the spring runtime (motion.spatial.follow)');
    return physicalSpec(mass, job);
  }

  // hover/press/focus/selection are state mass by definition
  if ((job === 'hover' || job === 'focus' || job === 'selection') && mass !== 'state') {
    fail(input, `${job} is a state shift — mass must be 'state'`);
  }
  if (job === 'press' && mass !== 'micro') {
    fail(input, 'press is a micro receipt — mass must be micro (scale 0.985, ~120ms)');
  }
  if (job === 'turn' && mass !== 'turn') {
    fail(input, 'the page turn is its own mass — never delay reading (law 33)');
  }
  if (job === 'material' && mass !== 'material') {
    fail(input, 'material changes (theme/glass) breathe at material mass');
  }
  if (mass === 'state' && job !== 'hover' && job !== 'focus' && job !== 'selection' && job !== 'settle') {
    fail(input, 'state mass is for hover/focus/selection/settle only');
  }

  const direction: Direction = directionForJob(job);
  const duration = durationFor(mass, direction);
  const easing = curveForJob(job);
  let properties = input.properties ?? DEFAULT_PROPERTIES[job] ?? ['transform', 'opacity'];
  // state-mass settling = color/bg/border shifts only (MOTION.md: "never
  // layout properties" for chip/menu hovers — transform is not a state shift)
  if (mass === 'state' && job === 'settle' && !input.properties) {
    properties = ['color', 'background', 'border-color'];
  }

  // the layout-property law: never anonymous, always measured
  const layout = properties.filter((p): p is LayoutProperty => p.startsWith('--layout:'));
  if (layout.length > 0 && !input.measuredReason) {
    fail(input, `layout property ${layout[0]} without a measuredReason — law: layout animates only with a measured reason`);
  }

  // the twin: crossfade keeps opacity only; enter-family defaults hold.
  // atmosphere is the one job that stops entirely under reduced motion —
  // the light doesn't travel, it simply is (D-014).
  const reducedMotion =
    input.reducedMotion ?? (mass === 'atmosphere' ? 'none' : twinForJob(job));

  return {
    kind: 'css',
    mass,
    job,
    direction,
    duration: { ms: duration.ms, token: duration.token },
    easing,
    easingToken: `--ease-${easing}`,
    properties,
    interruptible: direction === 'enter' || job === 'shift', // css exits complete; enters may re-enter
    reducedMotion,
    layoutReason: input.measuredReason ?? null,
  };
}

function physicalSpec(mass: MotionMass, job: 'follow' | 'settle' | 'shift'): PhysicalMotionSpec {
  // damping = 2·√(k·m) exactly — critically damped, ζ = 1.000+, no bounce
  const SPRINGS_BY_MASS: Record<string, SpringConfig> = {
    micro: { stiffness: 260, damping: 25.0, mass: 0.6 },
    component: { stiffness: 170, damping: 26.1, mass: 1 },
    surface: { stiffness: 130, damping: 28.9, mass: 1.6 },
    spatial: { stiffness: 100, damping: 32.3, mass: 2.6 },
  };
  const spring = SPRINGS_BY_MASS[mass] ?? SPRINGS_BY_MASS.component!;
  return {
    kind: 'physics',
    mass,
    job,
    spring,
    interruptible: true,
    reducedMotion: 'instant', // physics snaps under reduced motion
  };
}
