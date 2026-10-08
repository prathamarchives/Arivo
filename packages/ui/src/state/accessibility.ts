/**
 * accessibility — the state contract's aria surface.
 *
 * the component knows `state = "loading"`; this module decides what that
 * MEANS to assistive tech: what it says (aria-live), what it flags
 * (aria-busy/invalid/pressed), what it never does (remove focus for
 * aesthetics — the ink ring is first-class).
 */
import { isAsync, isAttention, type UiState } from './state.ts';

/** the attributes a state contributes to the element */
export interface AriaState {
  'aria-busy'?: boolean;
  'aria-invalid'?: boolean;
  'aria-disabled'?: boolean;
  'aria-selected'?: boolean;
  'aria-pressed'?: boolean;
  'aria-live'?: 'polite' | 'assertive';
}

/** the aria translation of a resolved state */
export function ariaForState(state: UiState, options?: { selected?: boolean; pressed?: boolean }): AriaState {
  const out: AriaState = {};
  if (isAsync(state)) out['aria-busy'] = true;
  if (state === 'error') out['aria-invalid'] = true;
  if (state === 'disabled') out['aria-disabled'] = true;
  if (options?.selected || state === 'selected') out['aria-selected'] = true;
  if (options?.pressed) out['aria-pressed'] = true;
  return out;
}

/**
 * the live-region announcement a state transition deserves:
 *   assertive — failure (error) and damage-in-repair (recovering)
 *   polite — receipts (saved) and flags (needs-attention, saving)
 *   none — everything else: hover/press/focus are visual receipts; the
 *   screen reader already knows about focus
 */
export function liveForState(state: UiState): 'polite' | 'assertive' | null {
  switch (state) {
    case 'error':
    case 'recovering':
      return 'assertive';
    case 'saving':
    case 'saved':
    case 'processing':
    case 'needs-attention':
    case 'modified':
      return 'polite';
    default:
      return null;
  }
}

/** the human phrase for a state — the toast/status line's job, kept here
 *  so voice and state can never drift apart */
export function phraseForState(state: UiState): string {
  switch (state) {
    case 'loading':
      return 'loading';
    case 'saving':
      return 'saving';
    case 'saved':
      return 'saved';
    case 'processing':
      return 'processing';
    case 'recovering':
      return 'repairing the library';
    case 'modified':
      return 'unsaved changes';
    case 'needs-attention':
      return 'needs attention';
    case 'error':
      return 'something failed';
    case 'empty':
      return 'nothing here yet';
    case 'disabled':
      return 'unavailable';
    default:
      return '';
  }
}

/** focus is keyboard-first-class — a state may never remove it for
 *  aesthetics. this is the check components/tests consult. */
export function focusRemovableBy(state: UiState): boolean {
  return state === 'disabled'; // the only lawful removal
}

/** attention states must be reachable, not just visible */
export function needsAnnouncement(state: UiState): boolean {
  return isAttention(state) || isAsync(state) || state === 'saved' || state === 'modified';
}
