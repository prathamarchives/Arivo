/**
 * curves — the closed easing vocabulary (law 34).
 *
 * exactly four curves exist: glide / retreat / shift / settle. the numeric
 * forms live here AND in tokens.css (--ease-*); the design-law test proves
 * the mirror never drifts. a curve outside this set is a violation, not a
 * taste decision — no component, spring, or keyframe may invent one.
 */

export type CurveName = 'glide' | 'retreat' | 'shift' | 'settle';

/** the cubic-bezier control points, in css order (x1, y1, x2, y2) */
export const CURVE_POINTS: Record<CurveName, readonly [number, number, number, number]> = {
  glide: [0.16, 1, 0.3, 1], // enter — fast start, weighted decel, exact rest
  retreat: [0.4, 0, 1, 1], // exit — brisk, accelerating away
  shift: [0.3, 0, 0.2, 1], // move — controlled continuity
  settle: [0.2, 0, 0, 1], // rest — viscous settle, no overshoot
};

/** the css token each curve is addressed by */
export const CURVE_TOKENS: Record<CurveName, string> = {
  glide: '--ease-glide',
  retreat: '--ease-retreat',
  shift: '--ease-shift',
  settle: '--ease-settle',
};

/** the job each curve owns — a motion asks for its job, never its number */
export const CURVE_JOBS: Record<CurveName, string> = {
  glide: 'enter',
  retreat: 'exit',
  shift: 'move',
  settle: 'rest',
};

/**
 * the curve for a motion job. derived, never hand-picked:
 *   enter-family → glide, exit-family → retreat, moves → shift,
 *   everything that rests (hover, press, focus, selection, settle) → settle.
 * this is the whole assignment table from MOTION.md as data.
 */
export function curveForJob(job: string): CurveName {
  if (job === 'enter') return 'glide';
  if (job === 'exit') return 'retreat';
  if (job === 'shift' || job === 'follow') return 'shift';
  if (job === 'turn') return 'glide'; // the page turn glides — never delays reading
  // hover, press, focus, selection, settle, material — receipts rest
  return 'settle';
}

/** css `cubic-bezier(...)` literal for a curve — the ms-mode twin of the var */
export function bezier(name: CurveName): string {
  const [x1, y1, x2, y2] = CURVE_POINTS[name];
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

/** css `var(--ease-*)` reference — the canonical form for stylesheets */
export function easeVar(name: CurveName): string {
  return `var(${CURVE_TOKENS[name]})`;
}
