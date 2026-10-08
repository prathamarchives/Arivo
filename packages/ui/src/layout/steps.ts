/**
 * spacing steps — the closed ladder as a type (law 17).
 *
 * layout primitives speak steps ('s4'), never pixels. the class system
 * (layout.css) maps each step to its var; this module is the shared
 * vocabulary so Stack, Inline, Grid, Region, Container, and Spacer can
 * never disagree about what exists.
 */

export const SPACING_STEPS = [
  's1',
  's2',
  's3',
  's4',
  's6',
  's8',
  's12',
  's16',
  's24',
  's32',
] as const;

export type SpacingStep = (typeof SPACING_STEPS)[number];

/** the css var for a step */
export function stepVar(step: SpacingStep): string {
  return `var(--${step})`;
}

/** the generated class fragment for a step ('gap-s4') */
export function stepClass(step: SpacingStep): string {
  return `gap-${step}`;
}

/** density-aware region padding: calc(var(--sN) * var(--density)) —
 *  temperament modulates REGION breathing, never text legibility (law 36) */
export function densityVar(step: SpacingStep): string {
  return `calc(var(--${step}) * var(--density))`;
}

/** the grid's minimum track widths — track geometry, not spacing (D-015) */
export const GRID_MIN_TRACKS = ['narrow', 'wide', 'object'] as const;
export type GridMin = (typeof GRID_MIN_TRACKS)[number];

/** px value per track kind — mirrored in layout.css classes */
export const GRID_MIN_PX: Record<GridMin, number> = {
  narrow: 180, // dense metadata lists
  wide: 240, // the default workspace track
  object: 320, // book objects / artifact previews
};
