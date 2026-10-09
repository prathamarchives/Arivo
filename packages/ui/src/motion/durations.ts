/**
 * durations — the duration ladder (law 30).
 *
 * duration scales with MASS CLASS, not developer mood. the numbers are the
 * MOTION.md table as data; the css tokens (--dur-*) mirror them and the
 * design-law test proves the mirror. this module is the ONLY constructor of
 * durations in the runtime: a MotionSpec carries a DurationSpec (ms + token)
 * and nothing downstream may write a raw number.
 *
 * entering breathes; leaving is brisk (law 31): exit < enter at every mass.
 */

import type { CurveName } from './curves.ts';

export type MassClass = 'micro' | 'component' | 'surface' | 'spatial';
export type SpecialClass = 'state' | 'turn' | 'material' | 'atmosphere';
export type MotionMass = MassClass | SpecialClass;
export type Direction = 'enter' | 'exit';

/** a duration is a value AND its token — they travel together, like type roles */
export interface DurationSpec {
  readonly ms: number;
  readonly token: string;
  readonly mass: MotionMass;
  readonly direction: Direction | null;
}

const LADDER: Record<MotionMass, Record<Direction, number>> = {
  /* v0.5.0 — the catalyst beat ladder: the room answers at the same
   * tempo pratham's site speaks (state 200, surface 400), and every
   * mass still breathes in / brisk out (law 31). */
  micro: { enter: 140, exit: 100 }, // dots, checks, press receipts
  component: { enter: 240, exit: 160 }, // buttons, chips, inputs
  surface: { enter: 400, exit: 260 }, // drawers, panels, menus — the catalyst settle
  spatial: { enter: 480, exit: 320 }, // rooms, mode transitions
  state: { enter: 200, exit: 200 }, // hover / focus shifts — the catalyst hover beat
  turn: { enter: 250, exit: 250 }, // the page turn — never delays reading
  material: { enter: 600, exit: 600 }, // theme, glass
  atmosphere: { enter: 1400, exit: 1400 }, // booklight, room light
};

const TOKENS: Record<MotionMass, Record<Direction, string>> = {
  micro: { enter: '--dur-micro-in', exit: '--dur-micro-out' },
  component: { enter: '--dur-comp-in', exit: '--dur-comp-out' },
  surface: { enter: '--dur-surface-in', exit: '--dur-surface-out' },
  spatial: { enter: '--dur-spatial-in', exit: '--dur-spatial-out' },
  state: { enter: '--dur-state', exit: '--dur-state' },
  turn: { enter: '--dur-turn', exit: '--dur-turn' },
  material: { enter: '--dur-material', exit: '--dur-material' },
  atmosphere: { enter: '--dur-atmosphere', exit: '--dur-atmosphere' },
};

/** the full ladder as evidence — the lab and the tests read this */
export const DURATION_LADDER: ReadonlyArray<
  [mass: MotionMass, enter: number, exit: number, token: string]
> = (Object.keys(LADDER) as MotionMass[]).map((mass) => [
  mass,
  LADDER[mass].enter,
  LADDER[mass].exit,
  TOKENS[mass].enter,
]);

/** the only duration constructor. direction defaults to 'enter' for the
 *  special classes (state/turn/material/atmosphere are directionless). */
export function durationFor(mass: MotionMass, direction: Direction = 'enter'): DurationSpec {
  return {
    ms: LADDER[mass][direction],
    token: TOKENS[mass][direction],
    mass,
    direction: mass === 'state' || mass === 'turn' || mass === 'material' || mass === 'atmosphere'
      ? null
      : direction,
  };
}

/** reduced-motion duration: the twin's value (law 34 — always 0 in css terms) */
export const REDUCED_MS = 0;

/** the direction implied by a job, when the caller doesn't say */
export function directionForJob(job: string): Direction {
  return job === 'enter' ? 'enter' : job === 'exit' ? 'exit' : 'enter';
}

export type { CurveName };
