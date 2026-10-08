/**
 * precedence — the state order as an executable law (STATES.md).
 *
 * the core order is the documented contract:
 *
 *   disabled > loading > error > focus > selected > hover > rest
 *
 * the arivo extension, recorded in DECISIONS.md (D-017):
 *
 *   - the async family slots directly under loading, ordered by urgency:
 *     recovering (repairing damage) > saving (user data at risk) >
 *     processing (derivable work)
 *   - needs-attention sits with error's family, one step below error
 *     itself — a flag defers to an actual failure
 *   - the quiet receipts (saved, modified) rank below interaction but
 *     above rest — they coexist with focus/selected/hover visuals and
 *     only own the surface when nothing interactive is happening
 *
 * no component may invent a contradictory order: resolveState is the only
 * precedence interpreter, and the exhaustive Record makes a new state
 * without a slot a compile error.
 */

import { acceptsPointer, isAsync, type UiState } from './state.ts';

/** the total order. first = wins. */
export const PRECEDENCE: readonly UiState[] = [
  'disabled',
  'loading',
  'recovering',
  'saving',
  'processing',
  'error',
  'needs-attention',
  'focus',
  'selected',
  'hover',
  'press',
  'saved',
  'modified',
  'empty',
  'rest',
];

/** the exhaustive map — adding a UiState without a slot fails to compile */
export const PRECEDENCE_INDEX: Record<UiState, number> = Object.fromEntries(
  PRECEDENCE.map((s, i) => [s, i]),
) as Record<UiState, number>;

/**
 * which state owns the surface. input is a set of active states (an
 * object map is the ergonomic shape at the call site).
 */
export function resolveState(active: Partial<Record<UiState, boolean>>): UiState {
  let best: UiState = 'rest';
  let bestIndex = PRECEDENCE_INDEX.rest;
  for (const state of Object.keys(active) as UiState[]) {
    if (!active[state]) continue;
    const idx = PRECEDENCE_INDEX[state];
    if (idx === undefined) {
      throw new Error(`resolveState: unknown state "${state}" — the vocabulary is closed (state.ts)`);
    }
    if (idx < bestIndex) {
      best = state;
      bestIndex = idx;
    }
  }
  return best;
}

/**
 * what the resolved state suppresses — the doc laws, executable:
 *   a disabled control never shows hover or press.
 *   a loading control never shows press.
 *   error beats everything visible except disabled.
 */
export interface Suppression {
  hover: boolean;
  press: boolean;
  focus: boolean;
  selected: boolean;
}

export function suppresses(state: UiState): Suppression {
  // disabled is native: no hover, no press, no focus, no selection — a
  // disabled control is not an interactive surface at all
  const suppressAll: Suppression = { hover: true, press: true, focus: true, selected: true };
  switch (state) {
    case 'disabled':
      return suppressAll;
    case 'loading':
    case 'recovering':
    case 'saving':
    case 'processing':
      // async work: press is a lie; hover still acknowledges proximity;
      // focus stays — the ink ring is never removed for aesthetics
      return { hover: false, press: true, focus: false, selected: false };
    case 'error':
    case 'needs-attention':
      // attention owns the visual surface but the pointer stays live —
      // retry is the whole point of an error control
      return { hover: false, press: false, focus: false, selected: true };
    default:
      return { hover: false, press: false, focus: false, selected: false };
  }
}

/** may a pointer event do anything at all right now? */
export function pointerLive(resolved: UiState): boolean {
  return acceptsPointer(resolved) && !suppresses(resolved).press;
}

/** the full behavior contract for a resolved state — consumed by
 *  interaction.ts and the primitives */
export interface StateBehavior {
  readonly resolved: UiState;
  readonly acceptsPointer: boolean;
  readonly suppressed: Suppression;
  readonly ariaBusy: boolean;
}

export function behaviorFor(resolved: UiState): StateBehavior {
  return {
    resolved,
    acceptsPointer: pointerLive(resolved),
    suppressed: suppresses(resolved),
    ariaBusy: isAsync(resolved),
  };
}
