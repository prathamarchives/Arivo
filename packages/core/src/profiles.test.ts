/**
 * THE READING PROFILE LAW (W2.3) — presets are bundles, the active chip
 * is derived, and every profile field sits on its ladder. the invariant:
 * selecting a profile writes exactly its fields; nudging one field is
 * honest divergence (chip off), never a stale mode.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  FONT_STEPS,
  LINE_HEIGHTS,
  MEASURES,
  READING_PROFILES,
  activeProfile,
  type ReaderSettings,
} from './types.ts';

const base: ReaderSettings = {
  theme: 'light',
  ...READING_PROFILES.default,
  pageMode: 'single',
};

describe('the ladders are closed vocabularies', () => {
  it('the leading ladder is three honest steps', () => {
    expect([...LINE_HEIGHTS]).toEqual([1.5, 1.65, 1.8]);
  });
  it('the measure ladder honors the law: 520–760, ideal 680', () => {
    expect([...MEASURES]).toEqual([520, 620, 680, 760]);
    expect(MEASURES[2]).toBe(680);
  });
  it('every profile field sits on its ladder', () => {
    for (const preset of Object.values(READING_PROFILES)) {
      expect(FONT_STEPS[preset.fontStep]).toBeDefined();
      expect(LINE_HEIGHTS).toContain(preset.lineHeight);
      expect(MEASURES).toContain(preset.measure);
    }
  });
  it('the profiles are distinct bundles, not three names for one setting', () => {
    const values = Object.values(READING_PROFILES).map((p) => JSON.stringify(p));
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('activeProfile — the chip is derived, never stored', () => {
  it('defaults derive to the default profile', () => {
    expect(activeProfile(base)).toBe('default');
    expect(activeProfile({ ...DEFAULT_SETTINGS })).toBe('default');
  });
  it('an exact bundle match lights its chip', () => {
    expect(activeProfile({ ...base, ...READING_PROFILES.dense })).toBe('dense');
    expect(activeProfile({ ...base, ...READING_PROFILES.research })).toBe('research');
  });
  it('theme and pageMode are orthogonal — they never break the derivation', () => {
    expect(activeProfile({ ...base, theme: 'dark', pageMode: 'auto' })).toBe('default');
  });
  it('one nudged field is honest divergence — no chip, no stale mode', () => {
    expect(activeProfile({ ...base, fontStep: 2 })).toBeNull();
    expect(activeProfile({ ...base, lineHeight: 1.5 })).toBeNull();
    expect(activeProfile({ ...base, measure: 760 })).toBeNull();
    expect(activeProfile({ ...base, flow: 'scrolled' })).toBeNull();
  });
});

describe('the geometry invariant (W2.3): every repaginating field is a setting', () => {
  it('font size, leading, measure, flow, page mode all live in ReaderSettings', () => {
    const keys = Object.keys(base) as (keyof ReaderSettings)[];
    for (const k of ['fontStep', 'lineHeight', 'measure', 'flow', 'pageMode'] as const) {
      expect(keys).toContain(k);
    }
  });
  it('selecting a profile is a plain write — the preset spreads into settings', () => {
    const next = { ...base, ...READING_PROFILES.research };
    expect(next.fontStep).toBe(2);
    expect(next.measure).toBe(520);
    expect(next.flow).toBe('scrolled');
    expect(activeProfile(next)).toBe('research');
  });
});
