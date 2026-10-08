/**
 * state — L5, the interaction/state runtime's public face.
 *
 * the separation the wave exists for:
 *   semantic state  — the component knows `state = 'loading'`
 *   precedence      — the order is executable, not documentation
 *   rendering       — the design system decides what loading looks like
 *   aria            — what it says, decided once, here
 *
 * primitives consume this through a single `state` prop + native attrs;
 * no component encodes state entirely in css selectors.
 */

export {
  CORE_STATES,
  ARIVO_STATES,
  ALL_STATES,
  STATE_ORIGIN,
  acceptsPointer,
  isAsync,
  isAttention,
  isQuiet,
  isAuthoredSurface,
} from './state.ts';
export type { CoreState, ArivoState, UiState, StateOrigin } from './state.ts';

export {
  PRECEDENCE,
  PRECEDENCE_INDEX,
  resolveState,
  suppresses,
  pointerLive,
  behaviorFor,
} from './precedence.ts';
export type { Suppression, StateBehavior } from './precedence.ts';

export { deriveInteraction, useInteraction } from './interaction.ts';
export type { RawInteraction, InteractionFlags, DerivedInteraction } from './interaction.ts';

export {
  ariaForState,
  liveForState,
  phraseForState,
  focusRemovableBy,
  needsAnnouncement,
} from './accessibility.ts';
export type { AriaState } from './accessibility.ts';
