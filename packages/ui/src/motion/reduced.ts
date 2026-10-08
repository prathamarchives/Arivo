/**
 * reduced — the twin system (law 34).
 *
 * every motion has a reduced-motion twin. the token layer already zeroes
 * every --dur-* under `prefers-reduced-motion: reduce` (the global hammer
 * for css transitions). this module serves the OTHER two layers:
 *
 *   1. css twins — what a spec degrades to when motion is reduced
 *      ('crossfade': opacity-only at state duration; 'instant': 0ms;
 *       'none': no motion at all, the effect simply doesn't run)
 *   2. physics twins — the spring runtime consults prefersReducedMotion()
 *      on every follow() and snaps instead of animating.
 *
 * the lab can force the twin on to inspect it (setReducedMotionOverride) —
 * production never sets that flag; it only reads the user's OS.
 */

let override: boolean | null = null;

/** does the user ask for less motion? (override is lab-only) */
export function prefersReducedMotion(): boolean {
  if (override !== null) return override;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false; // node/test — no motion system to reduce
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * lab-only force switch for inspecting twins under any os setting.
 * production code must never call this. returns the previous value.
 */
export function setReducedMotionOverride(v: boolean | null): boolean | null {
  const prev = override;
  override = v;
  return prev;
}

/** subscribe to the real os-level preference (ignores the lab override) */
export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}; // node/test
  }
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = (e: MediaQueryListEvent): void => cb(e.matches);
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}

/** what a motion degrades to when motion must be reduced */
export type ReducedTwin = 'crossfade' | 'instant' | 'none';

/**
 * the default twin per job:
 *   - enters crossfade (opacity at 150ms state duration — a material
 *     change, not movement; fading is permitted under reduced motion)
 *   - exits are instant (leaving is never worth motion)
 *   - receipts (hover/press/focus/selection) are instant
 *   - 'none' is reserved for atmosphere/booklight — under reduced motion
 *     the light simply doesn't travel
 */
export const DEFAULT_TWIN: Record<string, ReducedTwin> = {
  enter: 'crossfade',
  exit: 'instant',
  shift: 'instant',
  follow: 'instant',
  settle: 'instant',
  turn: 'crossfade', // the page must still change — as a crossfade
  hover: 'instant',
  press: 'instant',
  focus: 'instant',
  selection: 'instant',
  material: 'crossfade',
  atmosphere: 'none',
};

export function twinForJob(job: string): ReducedTwin {
  return DEFAULT_TWIN[job] ?? 'instant';
}
