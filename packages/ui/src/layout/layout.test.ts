/**
 * the spatial runtime's gate — W3 must prove:
 *   the ladder is closed and shared · density is inherited at regions ·
 *   the reading measure tops out at 68ch · z-space stays semantic ·
 *   grid tracks are the recorded geometry · primitives carry no raw values
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPACING_STEPS, stepVar, stepClass, densityVar, GRID_MIN_PX } from './steps.ts';
import { REGION_ROLES } from './Region.tsx';

const HERE = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const LAYOUT_CSS = readFileSync(join(HERE, 'layout/layout.css'), 'utf-8');
const TOKENS = readFileSync(join(HERE, 'tokens.css'), 'utf-8');

/* ---------------- the ladder ---------------- */

describe('W3 gate: the spacing ladder is closed and shared', () => {
  it('the steps ARE the token ladder', () => {
    expect([...SPACING_STEPS]).toEqual(['s1', 's2', 's3', 's4', 's6', 's8', 's12', 's16', 's24', 's32']);
    for (const step of SPACING_STEPS) {
      expect(TOKENS.includes(`--${step}:`)).toBe(true);
    }
  });

  it('stepVar and stepClass address tokens, never pixels', () => {
    expect(stepVar('s4')).toBe('var(--s4)');
    expect(stepClass('s4')).toBe('gap-s4');
    expect(densityVar('s6')).toBe('calc(var(--s6) * var(--density))');
  });

  it('every primitive family generated its ladder classes in layout.css', () => {
    for (const step of SPACING_STEPS) {
      for (const family of ['stack-gap', 'inline-gap', 'grid-gap', 'spacer-gap', 'pad-gap']) {
        expect(LAYOUT_CSS.includes(`.${family}-${step}`)).toBe(true);
      }
    }
  });
});

/* ---------------- density ---------------- */

describe('W3 gate: density is inherited at regions, never multiplied per component', () => {
  it('every region and container pad class multiplies var(--density)', () => {
    const pads = LAYOUT_CSS.match(/\.(?:region|container)-pad-gap-s\d+\s*\{[^}]*\}/g) ?? [];
    expect(pads.length).toBeGreaterThanOrEqual(20);
    for (const rule of pads) {
      expect(rule).toContain('calc(var(--s');
      expect(rule).toContain('* var(--density))');
    }
  });

  it('no box/stack/inline/grid/spacer class touches density — text never re-leads', () => {
    const nonRegion = LAYOUT_CSS.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.(?:box|stack|inline|grid|spacer)[^{]*\{[^}]*\}/g) ?? [];
    for (const rule of nonRegion) {
      expect(rule.includes('--density')).toBe(false);
    }
  });

  it('the tokens define density for both temperaments', () => {
    expect(TOKENS.includes('--density: 1.1')).toBe(true);
    expect(TOKENS.includes('--density: 0.9')).toBe(true);
  });
});

/* ---------------- the reading measure ---------------- */

describe('W3 gate: the reading body never exceeds the measure (law 45)', () => {
  it('68ch is the ceiling, with the px approximation bridge (gate 15)', () => {
    expect(LAYOUT_CSS.includes('max-width: min(68ch, 760px)')).toBe(true);
    expect(LAYOUT_CSS.includes('min-width: min(100%, 520px)')).toBe(true);
    expect(LAYOUT_CSS.includes('margin-inline: auto')).toBe(true);
  });
});

/* ---------------- z-space ---------------- */

describe('W3 gate: z-space stays semantic (law 47)', () => {
  it('the overlay layer addresses only --z-overlay', () => {
    for (const m of LAYOUT_CSS.matchAll(/z-index\s*:\s*([^;]+);/g)) {
      expect(m[1]!.trim().startsWith('var(--z-')).toBe(true);
    }
  });
});

/* ---------------- grid tracks ---------------- */

describe('W3 gate: grid tracks are the recorded geometry (D-015)', () => {
  it('the three track minimums mirror steps.ts exactly', () => {
    expect(LAYOUT_CSS.includes('minmax(180px, 1fr)')).toBe(true);
    expect(LAYOUT_CSS.includes('minmax(240px, 1fr)')).toBe(true);
    expect(LAYOUT_CSS.includes('minmax(320px, 1fr)')).toBe(true);
    expect(GRID_MIN_PX.narrow).toBe(180);
    expect(GRID_MIN_PX.wide).toBe(240);
    expect(GRID_MIN_PX.object).toBe(320);
  });
});

/* ---------------- region roles ---------------- */

describe('W3: the shell vocabulary arrives before the shell', () => {
  it('orientation / work / context / overlay — the four roles exist', () => {
    expect([...REGION_ROLES]).toEqual(['orientation', 'work', 'context', 'overlay']);
    for (const role of REGION_ROLES) {
      expect(LAYOUT_CSS.includes(`.region-${role}`)).toBe(true);
    }
  });

  it('work flexes, orientation and context hold — structure, not collapse', () => {
    expect(LAYOUT_CSS.includes('.region-work')).toBe(true);
    const work = LAYOUT_CSS.match(/\.region-work\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(work).toContain('flex: 1 1 0%');
    const orient = LAYOUT_CSS.match(/\.region-orientation\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(orient).toContain('flex: 0 0 auto');
  });
});

/* ---------------- no raw values ---------------- */

describe('W3 gate: layout.css speaks only tokens', () => {
  it('no raw hex, no raw durations', () => {
    expect([...LAYOUT_CSS.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)]).toEqual([]);
    expect([...LAYOUT_CSS.matchAll(/(?:transition|animation)[^;{}]*?[1-9]\d*ms/g)]).toEqual([]);
  });

  it('every spacing reference in layout.css is a ladder var', () => {
    for (const m of LAYOUT_CSS.matchAll(/var\((--s[a-z0-9-]+)\)/g)) {
      expect(SPACING_STEPS).toContain(m[1]!.slice(2));
    }
  });

  it('every radius reference sits on the grammar', () => {
    const grammar = new Set(['--r-structural', '--r-surface', '--r-interactive', '--r-object', '--r-generous', '--r-instrument']);
    for (const m of LAYOUT_CSS.matchAll(/var\((--r-[a-z-]+)\)/g)) {
      expect(grammar.has(m[1]!)).toBe(true);
    }
  });
});
