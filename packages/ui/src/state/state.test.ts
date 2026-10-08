/**
 * the state runtime's gate — W4 must prove:
 *   the vocabulary is closed · the precedence is the documented order ·
 *   suppression laws are executable · the decision core is pure ·
 *   the aria surface is total · focus survives everything but disabled
 */
import { describe, it, expect } from 'vitest';

import {
  CORE_STATES,
  ARIVO_STATES,
  ALL_STATES,
  isAsync,
  isAttention,
  acceptsPointer,
} from './state.ts';
import {
  PRECEDENCE,
  PRECEDENCE_INDEX,
  resolveState,
  suppresses,
  pointerLive,
  behaviorFor,
} from './precedence.ts';
import { deriveInteraction, type RawInteraction } from './interaction.ts';
import { ariaForState, liveForState, focusRemovableBy, needsAnnouncement } from './accessibility.ts';

/* ---------------- the vocabulary ---------------- */

describe('W4 gate: the state vocabulary is closed', () => {
  it('the canonical nine exist, exactly', () => {
    expect([...CORE_STATES]).toEqual([
      'rest', 'hover', 'press', 'focus', 'selected', 'disabled', 'loading', 'error', 'empty',
    ]);
  });

  it('the arivo machinery exists, exactly', () => {
    expect([...ARIVO_STATES]).toEqual([
      'saving', 'saved', 'processing', 'modified', 'needs-attention', 'recovering',
    ]);
  });

  it('every state has a precedence slot — no orphans, no duplicates', () => {
    expect(PRECEDENCE).toHaveLength(ALL_STATES.length);
    expect(new Set(PRECEDENCE).size).toBe(ALL_STATES.length);
    for (const s of ALL_STATES) {
      expect(PRECEDENCE_INDEX[s]).toBeDefined();
    }
  });
});

/* ---------------- the precedence law ---------------- */

describe('W4 gate: the documented order is executable', () => {
  it('disabled > loading > error > focus > selected > hover > rest', () => {
    const doc: [string, Partial<Record<string, boolean>>][] = [
      ['disabled', { disabled: true, loading: true, error: true, focus: true, selected: true, hover: true }],
      ['loading', { loading: true, error: true, focus: true, selected: true, hover: true }],
      ['error', { error: true, focus: true, selected: true, hover: true }],
      ['focus', { focus: true, selected: true, hover: true }],
      ['selected', { selected: true, hover: true }],
      ['hover', { hover: true }],
      ['rest', {}],
    ];
    for (const [expected, active] of doc) {
      expect(resolveState(active as never)).toBe(expected);
    }
  });

  it('the arivo extension slots lawfully (D-017)', () => {
    // async family under loading, urgency ordered
    expect(resolveState({ loading: true, recovering: true })).toBe('loading');
    expect(resolveState({ recovering: true, saving: true })).toBe('recovering');
    expect(resolveState({ saving: true, processing: true })).toBe('saving');
    // needs-attention defers to error, outranks focus
    expect(resolveState({ error: true, 'needs-attention': true })).toBe('error');
    expect(resolveState({ 'needs-attention': true, focus: true })).toBe('needs-attention');
    // quiet receipts coexist below interaction
    expect(resolveState({ saved: true, hover: true })).toBe('hover');
    expect(resolveState({ modified: true, saved: true })).toBe('saved');
  });

  it('unknown states throw — the vocabulary cannot be extended silently', () => {
    expect(() => resolveState({ bouncing: true } as never)).toThrow(/closed/);
  });
});

/* ---------------- the suppression laws ---------------- */

describe('W4 gate: suppression is the doc law, executable', () => {
  it('a disabled control never shows hover or press', () => {
    const s = suppresses('disabled');
    expect(s.hover).toBe(true);
    expect(s.press).toBe(true);
    expect(s.selected).toBe(true);
  });

  it('a loading control never shows press; hover still acknowledges; focus stays', () => {
    for (const asyncState of ['loading', 'saving', 'processing', 'recovering'] as const) {
      const s = suppresses(asyncState);
      expect(s.press).toBe(true);
      expect(s.hover).toBe(false);
      expect(s.focus).toBe(false);
    }
  });

  it('focus is never removed for aesthetics — only disabled may take it', () => {
    for (const state of ALL_STATES) {
      const lawful = focusRemovableBy(state);
      expect(suppresses(state).focus).toBe(state === 'disabled' ? true : false);
      expect(lawful).toBe(state === 'disabled');
    }
  });

  it('the pointer is dead while async or disabled work', () => {
    expect(pointerLive('loading')).toBe(false);
    expect(pointerLive('saving')).toBe(false);
    expect(pointerLive('disabled')).toBe(false);
    expect(pointerLive('rest')).toBe(true);
    expect(pointerLive('error')).toBe(true); // attention still accepts input (retry)
    expect(acceptsPointer('error')).toBe(true);
  });

  it('behaviorFor bundles the whole contract', () => {
    const b = behaviorFor('saving');
    expect(b.resolved).toBe('saving');
    expect(b.acceptsPointer).toBe(false);
    expect(b.ariaBusy).toBe(true);
    expect(isAsync('saving')).toBe(true);
    expect(isAttention('needs-attention')).toBe(true);
  });
});

/* ---------------- the interaction decision core ---------------- */

describe('W4 gate: the decision core is pure and lawful', () => {
  const rawHover: RawInteraction = { hover: true, press: false, focus: false, focusVisible: false };
  const rawPress: RawInteraction = { hover: true, press: true, focus: false, focusVisible: false };
  const rawFocus: RawInteraction = { hover: false, press: false, focus: true, focusVisible: true };

  it('rest + hover = hover; rest alone = rest', () => {
    expect(deriveInteraction(rawHover, {}).resolved).toBe('hover');
    expect(deriveInteraction(REST(), {}).resolved).toBe('rest');
    expect(deriveInteraction(rawHover, {}).hover).toBe(true);
  });

  it('disabled kills hover and press; focus is suppressed', () => {
    const d = deriveInteraction(rawPress, { disabled: true });
    expect(d.hover).toBe(false);
    expect(d.press).toBe(false);
    expect(d.pointerDead).toBe(true);
    expect(d.resolved).toBe('disabled');
  });

  it('loading kills press but hover still acknowledges proximity', () => {
    const l = deriveInteraction(rawPress, { loading: true });
    expect(l.press).toBe(false);
    expect(l.hover).toBe(true);
    expect(l.resolved).toBe('loading');
  });

  it('focus survives async — the ink ring is first-class', () => {
    const f = deriveInteraction(rawFocus, { loading: true });
    expect(f.focus).toBe(true);
    expect(f.focusVisible).toBe(true);
    expect(f.press).toBe(false);
  });

  it('an explicit conditional state outranks device truth', () => {
    const e = deriveInteraction(rawPress, { state: 'error' });
    expect(e.resolved).toBe('error');
    expect(e.press).toBe(true); // attention accepts input — retry is the whole point
    expect(e.suppressedPress).toBe(false);
  });

  function REST(): RawInteraction {
    return { hover: false, press: false, focus: false, focusVisible: false };
  }
});

/* ---------------- the aria surface ---------------- */

describe('W4 gate: the aria surface is total', () => {
  it('every state maps to live-region semantics', () => {
    expect(liveForState('error')).toBe('assertive');
    expect(liveForState('recovering')).toBe('assertive');
    expect(liveForState('saving')).toBe('polite');
    expect(liveForState('saved')).toBe('polite');
    expect(liveForState('hover')).toBeNull();
    expect(liveForState('focus')).toBeNull();
    expect(liveForState('press')).toBeNull();
  });

  it('busy/invalid/disabled flags are correct', () => {
    expect(ariaForState('loading')).toEqual({ 'aria-busy': true });
    expect(ariaForState('saving')).toEqual({ 'aria-busy': true });
    expect(ariaForState('error')).toEqual({ 'aria-invalid': true });
    expect(ariaForState('disabled')).toEqual({ 'aria-disabled': true });
    expect(ariaForState('rest')).toEqual({});
  });

  it('selection translates for both roles (selected/pressed)', () => {
    expect(ariaForState('rest', { selected: true })).toEqual({ 'aria-selected': true });
    expect(ariaForState('rest', { pressed: true })).toEqual({ 'aria-pressed': true });
  });

  it('attention and async announce; receipts announce politely; rest never interrupts', () => {
    for (const s of ['error', 'needs-attention', 'saving', 'saved', 'modified', 'recovering', 'processing'] as const) {
      expect(needsAnnouncement(s)).toBe(true);
    }
    for (const s of ['rest', 'hover', 'press', 'focus', 'selected'] as const) {
      expect(needsAnnouncement(s)).toBe(false);
    }
  });
});
