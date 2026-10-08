/**
 * THE DESIGN SYSTEM IS EXECUTABLE POLICY — the constitution's laws as
 * tests. every checker is proven two ways: against the real token/css
 * files (must pass) and against a seeded violation (must catch). if a
 * seeded violation passes, the checker is broken — that is a failure,
 * not a note.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const TOKENS = readFileSync(join(ROOT, 'packages/ui/src/tokens.css'), 'utf-8');
const BASE = readFileSync(join(ROOT, 'packages/ui/src/base.css'), 'utf-8');
const COMPONENTS_CSS = readFileSync(join(ROOT, 'packages/ui/src/components/components.css'), 'utf-8');
const LAYOUT_CSS = readFileSync(join(ROOT, 'packages/ui/src/layout/layout.css'), 'utf-8');
const LAB_CSS = readFileSync(join(ROOT, 'packages/ui/src/lab/lab.css'), 'utf-8');
const APP_CSS = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/styles/app.css'), 'utf-8');
const READER_THEMES = readFileSync(join(ROOT, 'packages/ui/src/reader-themes.ts'), 'utf-8');

/* ------------------------- the checkers ------------------------- */

/** extract custom-property definitions from css */
export function propsOf(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1]!, m[2]!.trim());
  }
  return out;
}

/** spacing tokens must sit exactly on the canonical scale */
export function spacingViolations(css: string): string[] {
  const scale = new Set(['4px', '8px', '12px', '16px', '24px', '32px', '48px', '64px', '96px', '128px']);
  const bad: string[] = [];
  for (const m of css.matchAll(/(--s[a-z0-9-]*)\s*:\s*(\d+px);/g)) {
    if (!scale.has(m[2]!)) bad.push(`${m[1]}: ${m[2]}`);
  }
  return bad;
}

/** radius tokens must sit exactly on the radius grammar */
export function radiusViolations(css: string): string[] {
  const grammar = new Set(['4px', '8px', '12px', '14px', '16px', '999px']);
  const bad: string[] = [];
  for (const m of css.matchAll(/(--r-[a-z0-9-]+)\s*:\s*(\d+px|999px);/g)) {
    if (!grammar.has(m[2]!)) bad.push(`${m[1]}: ${m[2]}`);
  }
  return bad;
}

/** annotation identity colors are constant across every block */
export function annotationDrift(css: string): string[] {
  const identity = new Map<string, Set<string>>();
  for (const m of css.matchAll(/(--anno-[a-z]+)\s*:\s*(#[0-9A-Fa-f]{6});/g)) {
    const set = identity.get(m[1]!) ?? new Set<string>();
    set.add(m[2]!.toUpperCase());
    identity.set(m[1]!, set);
  }
  const bad: string[] = [];
  for (const [name, values] of identity) {
    if (values.size !== 1) bad.push(`${name} defined ${values.size} ways: ${[...values].join(' ')}`);
  }
  return bad;
}

/** only the four named easings exist in the token file */
export function easingViolations(css: string): string[] {
  const named = new Set([
    'cubic-bezier(0.16, 1, 0.3, 1)',
    'cubic-bezier(0.4, 0, 1, 1)',
    'cubic-bezier(0.3, 0, 0.2, 1)',
    'cubic-bezier(0.2, 0, 0, 1)',
  ]);
  const bad: string[] = [];
  for (const m of css.matchAll(/cubic-bezier\([^)]*\)/g)) {
    if (!named.has(m[0]!)) bad.push(m[0]!);
  }
  return bad;
}

/** helvetica ships 400 / 700 (300 wordmark-only): no 500/600 anywhere */
export function weightViolations(...css: string[]): string[] {
  const bad: string[] = [];
  for (const cssText of css) {
    for (const m of cssText.matchAll(/font-weight\s*:\s*(\d{3});/g)) {
      if (!['300', '400', '700'].includes(m[1]!)) bad.push(`font-weight: ${m[1]}`);
    }
  }
  return bad;
}

/** z-index only through the semantic stack */
export function zIndexViolations(...css: string[]): string[] {
  const bad: string[] = [];
  for (const cssText of css) {
    for (const m of cssText.matchAll(/z-index\s*:\s*([^;]+);/g)) {
      const v = m[1]!.trim();
      if (!v.startsWith('var(--z-')) bad.push(`z-index: ${v}`);
    }
  }
  return bad;
}

/** retired tokens never return */
export function retiredTokenViolations(...sources: string[]): string[] {
  const retired = ['--s5', '--s10', '--s-2', '--r1', '--r2', '--r3', '--shadow-1', '--shadow-2', '--shadow-3', '--glass-line', '--font-display', '--amber'];
  const bad: string[] = [];
  for (const src of sources) {
    for (const name of retired) {
      if (src.includes(`var(${name})`)) bad.push(name);
    }
  }
  return bad;
}

/** raw hex outside the token file + documented allowlist */
export function rawHexViolations(css: string): string[] {
  const allow = new Set(['#fff', '#000']); // pdf pages + invisible selection proxy — documented
  const bad: string[] = [];
  for (const m of css.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)) {
    if (!allow.has(m[0]!.toLowerCase())) bad.push(m[0]!);
  }
  return bad;
}

/** durations only through the ladder — no raw non-zero ms in css (L3 law) */
export function rawDurationViolations(css: string): string[] {
  const bad: string[] = [];
  for (const m of css.matchAll(/(?:transition|animation)[^;{}]*?(\d+)ms/g)) {
    if (m[1]! !== '0') bad.push(`${m[1]}ms — ${m[0]!.slice(0, 50)}`);
  }
  return bad;
}

/* ------------------- the law: the real files -------------------- */

describe('the design law — tokens are the closed vocabulary', () => {
  it('every required L2 token family exists', () => {
    const props = propsOf(TOKENS);
    const required = [
      '--font-ui', '--font-wordmark', '--font-read', '--font-mono',
      '--text-micro', '--text-meta', '--text-base', '--text-hero',
      '--tracking-meta', '--tracking-tight',
      '--s1', '--s2', '--s3', '--s4', '--s6', '--s8', '--s12', '--s16', '--s24', '--s32',
      '--r-structural', '--r-surface', '--r-interactive', '--r-object', '--r-generous', '--r-instrument',
      '--z-canvas', '--z-content', '--z-sticky', '--z-floating', '--z-overlay', '--z-transient',
      '--shadow-contact', '--shadow-ambient', '--elevation-1', '--elevation-2', '--elevation-3',
      '--ease-glide', '--ease-retreat', '--ease-shift', '--ease-settle',
      '--dur-state', '--dur-turn', '--dur-material', '--dur-atmosphere',
      '--glass-blur', '--glass-saturation', '--glass-tint', '--glass-rim',
      '--paper-grain', '--paper-grain-opacity',
      '--anno-amber', '--anno-sage', '--anno-blue', '--anno-rose', '--anno-violet',
      '--aura-h', '--aura-s', '--aura-l', '--aura-alpha',
      '--density', '--accent', '--img-scrim',
    ];
    const missing = required.filter((t) => !props.has(t));
    expect(missing).toEqual([]);
  });

  it('the spacing scale is exactly the canonical ladder', () => {
    expect(spacingViolations(TOKENS)).toEqual([]);
    const props = propsOf(TOKENS);
    expect(props.get('--s1')).toBe('4px');
    expect(props.get('--s32')).toBe('128px');
  });

  it('the radius grammar is exact', () => {
    expect(radiusViolations(TOKENS)).toEqual([]);
  });

  it('annotation identity colors are constant (law 38)', () => {
    expect(annotationDrift(TOKENS)).toEqual([]);
    const props = propsOf(TOKENS);
    expect(props.get('--anno-amber')).toBe('#DCA93B');
    expect(props.get('--anno-sage')).toBe('#6E9951');
    expect(props.get('--anno-blue')).toBe('#4E8FC4');
    expect(props.get('--anno-rose')).toBe('#C66A67');
    expect(props.get('--anno-violet')).toBe('#9074C2');
  });

  it('the easing vocabulary is exactly glide/retreat/shift/settle', () => {
    expect(easingViolations(TOKENS)).toEqual([]);
  });

  it('reduced-motion twins exist for every duration family', () => {
    const block = TOKENS.slice(TOKENS.indexOf('prefers-reduced-motion'));
    for (const t of ['--dur-state', '--dur-comp-in', '--dur-surface-in', '--dur-spatial-in', '--dur-turn', '--dur-material', '--dur-atmosphere']) {
      expect(block.includes(t)).toBe(true);
    }
  });

  it('both room axes are addressable: temperament and lighting', () => {
    expect(TOKENS.includes("[data-temperament='den']")).toBe(true);
    expect(TOKENS.includes("[data-temperament='lab']")).toBe(true);
    for (const t of ['paper', 'sepia', 'night']) {
      expect(TOKENS.includes(`[data-theme='${t}']`)).toBe(true);
    }
  });
});

describe('the design law — components speak only tokens', () => {
  it('no raw hex in any component skin file (token files own color)', () => {
    expect(rawHexViolations(BASE)).toEqual([]);
    expect(rawHexViolations(COMPONENTS_CSS)).toEqual([]);
    expect(rawHexViolations(LAYOUT_CSS)).toEqual([]);
    expect(rawHexViolations(LAB_CSS)).toEqual([]);
  });

  it('z-index is semantic everywhere (law 47)', () => {
    expect(zIndexViolations(BASE, COMPONENTS_CSS, LAYOUT_CSS, LAB_CSS, APP_CSS)).toEqual([]);
  });

  it('weights are 400/700 only (300 wordmark) — the supplied cuts', () => {
    expect(weightViolations(BASE, COMPONENTS_CSS, LAYOUT_CSS, LAB_CSS, APP_CSS)).toEqual([]);
  });

  it('no raw durations — transitions speak only the ladder (L3)', () => {
    expect(rawDurationViolations(BASE)).toEqual([]);
    expect(rawDurationViolations(COMPONENTS_CSS)).toEqual([]);
    expect(rawDurationViolations(LAYOUT_CSS)).toEqual([]);
    expect(rawDurationViolations(LAB_CSS)).toEqual([]);
    expect(rawDurationViolations(APP_CSS)).toEqual([]);
  });

  it('retired tokens never return', () => {
    expect(retiredTokenViolations(BASE, COMPONENTS_CSS, LAYOUT_CSS, LAB_CSS, APP_CSS, READER_THEMES)).toEqual([]);
  });

  it('the retired display serif is gone from the reading surface', () => {
    expect(READER_THEMES.includes('Instrument')).toBe(false);
    expect(READER_THEMES.includes("--font-display")).toBe(false);
  });
});

/* ---------------- the proof: seeded violations MUST fail ---------------- */

describe('the checkers work — seeded violations are caught', () => {
  it('spacing checker catches off-scale tokens', () => {
    expect(spacingViolations(':root { --s5: 20px; --s10: 40px; }')).toHaveLength(2);
  });

  it('radius checker catches off-grammar radius', () => {
    expect(radiusViolations(':root { --r-surface: 10px; }')).toHaveLength(1);
  });

  it('annotation drift checker catches a redefined identity', () => {
    const css = ':root { --anno-amber: #DCA93B; } [data-theme=night] { --anno-amber: #7A6428; }';
    expect(annotationDrift(css)).toHaveLength(1);
  });

  it('easing checker catches an unnamed curve', () => {
    expect(easingViolations('transition: all 200ms cubic-bezier(0.68, -0.55, 0.27, 1.55);')).toHaveLength(1);
  });

  it('weight checker catches a 500', () => {
    expect(weightViolations('.btn { font-weight: 500; }')).toHaveLength(1);
  });

  it('z-index checker catches a raw 9999', () => {
    expect(zIndexViolations('.modal { z-index: 9999; }')).toHaveLength(1);
  });

  it('retired-token checker catches a returning alias', () => {
    expect(retiredTokenViolations('.card { box-shadow: var(--shadow-2); }')).toHaveLength(1);
  });

  it('raw hex checker catches a stray color', () => {
    expect(rawHexViolations('.btn { background: #3B82F6; }')).toHaveLength(1);
  });

  it('raw duration checker catches an invented 340ms transition', () => {
    expect(
      rawDurationViolations('.btn { transition: transform 340ms var(--ease-glide); }'),
    ).toHaveLength(1);
    // zero is the twin, not a violation
    expect(rawDurationViolations('.btn { transition-duration: 0ms; }')).toHaveLength(0);
  });
});

/* ---------------- the lab mirror must match the tokens ---------------- */

describe('the design lab tells the truth', () => {
  const LAB_DATA = readFileSync(join(ROOT, 'packages/ui/src/lab/lab-data.ts'), 'utf-8');

  it('lab spacing table matches tokens.css', () => {
    const props = propsOf(TOKENS);
    for (const m of LAB_DATA.matchAll(/\['(--s[a-z0-9]+)',\s*(\d+)\]/g)) {
      expect(props.get(m[1]!)).toBe(`${m[2]}px`);
    }
  });

  it('lab radius table matches tokens.css', () => {
    const props = propsOf(TOKENS);
    for (const m of LAB_DATA.matchAll(/\['(--r-[a-z-]+)',\s*(\d+)\]/g)) {
      expect(props.get(m[1]!)).toBe(`${m[2]}px`);
    }
  });

  it('lab annotation table matches tokens.css', () => {
    const props = propsOf(TOKENS);
    for (const m of LAB_DATA.matchAll(/\['(--anno-[a-z]+)',\s*'(#[0-9A-Fa-f]{6})'\]/g)) {
      expect(props.get(m[1]!)).toBe(m[2]!);
    }
  });

  it('lab easing table matches tokens.css', () => {
    const props = propsOf(TOKENS);
    for (const m of LAB_DATA.matchAll(/\['(--ease-[a-z]+)',\s*'(cubic-bezier\([^)]*\))'/g)) {
      expect(props.get(m[1]!)).toBe(m[2]!);
    }
  });
});
