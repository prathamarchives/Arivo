/**
 * mass — what a moving thing IS, physically.
 *
 * the component asks "what kind of motion am i performing?" and answers
 * with a mass + a job. it never answers with a millisecond count. mass
 * decides duration scale and spring weight; the job decides curve and
 * direction. this file also owns the physics presets — and the physics law:
 * damping ratio >= 1, always. no bounce. no elastic. no rebound (law 28).
 */

import type { MassClass, SpecialClass } from './durations.ts';

export type { MassClass, SpecialClass };

/** the physical weight of each mass class, for the spring runtime */
export const MASS_WEIGHT: Record<MassClass, number> = {
  micro: 0.6, // dots, checks — feather receipts
  component: 1, // buttons, chips — the unit weight
  surface: 1.6, // drawers, panels — sheets of paper
  spatial: 2.6, // rooms — the camera itself
};

/**
 * spring presets. values chosen so damping ratio ζ = c / (2·√(k·m)) >= 1
 * — critically damped or slightly above. the constructor of Spring
 * REJECTS anything bouncier; this table is the only sanctioned tuning
 * surface until a motion-specimen review reopens it (GATES.md #4).
 */
export const SPRINGS = {
  /** an instrument following the user's selection / a pill traveling tabs */
  follow: { stiffness: 170, damping: 26.1, mass: 1 },
  /** a book object being pulled out / heavy object continuity */
  object: { stiffness: 120, damping: 24, mass: 1.2 },
  /** mode pill travel — the room's camera easing between places */
  travel: { stiffness: 300, damping: 34.7, mass: 1 },
} as const;

export type SpringPreset = keyof typeof SPRINGS;
export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

/** damping ratio — 1.0 is critically damped (fastest no-overshoot settle) */
export function dampingRatio({ stiffness, damping, mass }: SpringConfig): number {
  return damping / (2 * Math.sqrt(stiffness * mass));
}

/** the no-bounce law as a check. bouncier than critical → rejected. */
export function isNoBounce(config: SpringConfig): boolean {
  const ratio = dampingRatio(config);
  return Number.isFinite(ratio) && ratio >= 1 && ratio < 2.5; // < 2.5: don't be mud
}
