/**
 * interaction — pointer + keyboard semantics as a semantic source.
 *
 * the hook reports WHAT is true (hover/press/focus); it never decides how
 * that looks — that is the state→rendering separation (law 40: stateful
 * differences are semantic). the decision core is pure (`deriveInteraction`)
 * so the law is testable in node; the hook is the thinnest dom shell.
 *
 * focus is keyboard-first-class: the ring renders only for
 * :focus-visible (keyboard entry), never to flatter a pointer click.
 * press covers pointer and the element's own key activation.
 */
import { useCallback, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, FocusEvent as ReactFocusEvent } from 'react';
import { behaviorFor } from './precedence.ts';
import type { UiState } from './state.ts';

/** raw device truth */
export interface RawInteraction {
  hover: boolean;
  press: boolean;
  focus: boolean;
  focusVisible: boolean;
}

/** flags the component owns (async/conditional states gate the pointer) */
export interface InteractionFlags {
  disabled?: boolean;
  loading?: boolean;
  state?: UiState;
}

/** the derived, lawful interaction state */
export interface DerivedInteraction extends RawInteraction {
  /** the state that owns the interaction surface */
  resolved: UiState;
  /** pointer events are lies right now (async/disabled) */
  pointerDead: boolean;
  /** what the resolved state suppresses */
  suppressedHover: boolean;
  suppressedPress: boolean;
}

const REST: RawInteraction = { hover: false, press: false, focus: false, focusVisible: false };

/**
 * the decision core — pure. given raw device truth + the component's own
 * flags, apply the precedence law: disabled kills hover/press; async
 * kills press; focus survives everything except disabled.
 */
export function deriveInteraction(raw: RawInteraction, flags: InteractionFlags): DerivedInteraction {
  const conditional: UiState =
    flags.disabled ? 'disabled' : (flags.state ?? (flags.loading ? 'loading' : 'rest'));
  const b = behaviorFor(
    conditional === 'rest' && raw.hover ? 'hover' : conditional === 'rest' ? 'rest' : conditional,
  );
  // hover ACKNOWLEDGES proximity even while async — the pointer is
  // greeted; it just can't commit anything. press is what dies.
  const hover = raw.hover && !b.suppressed.hover;
  const press = raw.press && !b.suppressed.press && b.acceptsPointer;
  const focus = raw.focus && !b.suppressed.focus;
  const focusVisible = raw.focusVisible && focus;
  return {
    hover,
    press,
    focus,
    focusVisible,
    resolved: b.resolved,
    pointerDead: !b.acceptsPointer,
    suppressedHover: b.suppressed.hover,
    suppressedPress: b.suppressed.press,
  };
}

/** the dom shell: bind these to the interactive element */
export function useInteraction(flags: InteractionFlags = {}): {
  interaction: DerivedInteraction;
  bind: {
    onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onFocus: (e: ReactFocusEvent<HTMLElement>) => void;
    onBlur: (e: ReactFocusEvent<HTMLElement>) => void;
  };
} {
  const [raw, setRaw] = useState<RawInteraction>(REST);
  // the decision core is pure and cheap — no memoization gymnastics, no
  // stale flags. derive on every render; the bind callbacks stay stable.
  const interaction = deriveInteraction(raw, {
    disabled: flags.disabled ?? false,
    loading: flags.loading ?? false,
    state: flags.state,
  });

  const bind = {
    onPointerEnter: useCallback((e: ReactPointerEvent<HTMLElement>): void => {
      if (e.pointerType === 'mouse') setRaw((r) => ({ ...r, hover: true }));
    }, []),
    onPointerLeave: useCallback((): void => {
      setRaw((r) => ({ ...r, hover: false, press: false }));
    }, []),
    onPointerDown: useCallback((e: ReactPointerEvent<HTMLElement>): void => {
      if (e.button === 0) setRaw((r) => ({ ...r, press: true }));
    }, []),
    onPointerUp: useCallback((): void => {
      setRaw((r) => ({ ...r, press: false }));
    }, []),
    onFocus: useCallback((e: ReactFocusEvent<HTMLElement>): void => {
      const visible =
        typeof e.currentTarget.matches === 'function' && e.currentTarget.matches(':focus-visible');
      setRaw((r) => ({ ...r, focus: true, focusVisible: visible }));
    }, []),
    onBlur: useCallback((): void => {
      setRaw((r) => ({ ...r, focus: false, focusVisible: false }));
    }, []),
  };

  return { interaction, bind };
}
