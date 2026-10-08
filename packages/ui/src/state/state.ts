/**
 * state — the interaction vocabulary (L5, law 39).
 *
 * every interactive thing must define these; a missing state is a bug, not
 * a nicety. the canonical nine:
 *
 *   rest · hover · press · focus · selected · disabled · loading · error · empty
 *
 * and the arivo-specific quiet machinery — the states a local-first
 * reading environment actually lives in:
 *
 *   saving · saved · processing · modified · needs-attention · recovering
 *
 * semantic state is SEPARATE from rendering: the component knows it is
 * loading; the design system decides what loading looks like, sounds
 * like (aria-live), does to motion, and does to pointer input. states are
 * never encoded entirely in css selectors.
 */

/** the canonical nine — every interactive component speaks these */
export type CoreState =
  | 'rest'
  | 'hover'
  | 'press'
  | 'focus'
  | 'selected'
  | 'disabled'
  | 'loading'
  | 'error'
  | 'empty';

/** the arivo quiet machinery — async truth, local-first recovery */
export type ArivoState =
  | 'saving' // a write is in flight (journal fsync, library save)
  | 'saved' // the quiet receipt — file landed, index updated
  | 'processing' // indexing, parsing, cover extraction
  | 'modified' // dirty — the truth on disk differs from the truth in hand
  | 'needs-attention' // the flag: drift, orphan, conflict awaiting the user
  | 'recovering'; // repair in flight (reconciliation, index rebuild)

export type UiState = CoreState | ArivoState;

export const CORE_STATES: readonly CoreState[] = [
  'rest',
  'hover',
  'press',
  'focus',
  'selected',
  'disabled',
  'loading',
  'error',
  'empty',
];

export const ARIVO_STATES: readonly ArivoState[] = [
  'saving',
  'saved',
  'processing',
  'modified',
  'needs-attention',
  'recovering',
];

export const ALL_STATES: readonly UiState[] = [...CORE_STATES, ...ARIVO_STATES];

/** how a state arrives — this decides who may set it */
export type StateOrigin =
  | 'pointer' // hover, press — the device is involved
  | 'keyboard' // focus — the ink ring is keyboard-first-class
  | 'semantics' // selected, disabled — the component's own contract
  | 'data'; // loading, error, empty, the async family — the world's truth

export const STATE_ORIGIN: Record<UiState, StateOrigin> = {
  rest: 'semantics',
  hover: 'pointer',
  press: 'pointer',
  focus: 'keyboard',
  selected: 'semantics',
  disabled: 'semantics',
  loading: 'data',
  error: 'data',
  empty: 'data',
  saving: 'data',
  saved: 'data',
  processing: 'data',
  modified: 'data',
  'needs-attention': 'data',
  recovering: 'data',
};

/** does the state own the pointer? async and broken controls do not */
export function acceptsPointer(state: UiState): boolean {
  return state !== 'disabled' && !isAsync(state);
}

/** the async family — work in flight; press is a lie while these run */
export function isAsync(state: UiState): boolean {
  return state === 'loading' || state === 'saving' || state === 'processing' || state === 'recovering';
}

/** the attention family — something is wrong or flagged */
export function isAttention(state: UiState): boolean {
  return state === 'error' || state === 'needs-attention';
}

/** the quiet family — informational, never blocks anyone */
export function isQuiet(state: UiState): boolean {
  return state === 'rest' || state === 'saved' || state === 'modified' || state === 'empty';
}

/** an empty state is authored, never blank (law 39) — it renders content */
export function isAuthoredSurface(state: UiState): boolean {
  return state === 'empty' || state === 'error';
}
