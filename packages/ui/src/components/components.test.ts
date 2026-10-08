/**
 * the primitive library's gate — W5 must prove:
 *   no primitive invents a foundational value · the icon language is one ·
 *   every role/state/material has its skin · the coverage matrix exists
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ICON_PATHS, IconSearch, IconBook, type IconName } from './Icon.tsx';
import { Text } from './Typography.tsx';
import { Surface, Divider } from './Surface.tsx';
import { Button } from './Actions.tsx';
import { ANNO_IDENTITY } from './Reader.tsx';

const HERE = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const COMPONENTS_CSS = readFileSync(join(HERE, 'components/components.css'), 'utf-8');
const LAYOUT_CSS = readFileSync(join(HERE, 'layout/layout.css'), 'utf-8');

/* ---------------- the icon language ---------------- */

describe('W5 gate: the icon language is one family', () => {
  it('32 glyphs, all real paths on the 16-grid', () => {
    /* 24 at L6 + shelf and archive at L8 + the wave-1 surfaces
     * (settings, info, tag, pencil, folder, pulse). a new glyph must
     * extend the family, never fork it. */
    expect(Object.keys(ICON_PATHS)).toHaveLength(32);
    for (const [name, d] of Object.entries(ICON_PATHS)) {
      expect(d!.startsWith('M')).toBe(true);
      void name;
    }
  });

  it('the named factories exist and are functions', () => {
    expect(typeof IconSearch).toBe('function');
    expect(typeof IconBook).toBe('function');
  });

  it('the stroke language is constant: 1.5 round caps, currentColor, 16 grid', () => {
    expect(COMPONENTS_CSS).not.toMatch(/stroke-width\s*:\s*(?!1\.5)\d/);
  });
});

/* ---------------- typography roles ---------------- */

describe('W5 gate: typography roles carry the composite tokens', () => {
  it('every role has its skin class in components.css', () => {
    for (const role of [
      't-display', 't-screen-title', 't-title', 't-emphasis', 't-body', 't-quiet', 't-control',
      't-label', 't-meta', 't-micro', 't-read', 'ink-1', 'ink-2', 'ink-3',
    ]) {
      expect(COMPONENTS_CSS.includes(`.${role} {`)).toBe(true);
    }
  });

  it('weights are 400/700 only — bold is spent deliberately', () => {
    const roleBlocks = COMPONENTS_CSS.match(/\.t-[a-z-]+\s*\{[^}]*\}/g) ?? [];
    for (const block of roleBlocks) {
      const m = block.match(/font-weight\s*:\s*(\d{3})/);
      if (m) expect(['400', '700']).toContain(m[1]);
    }
  });

  it('read is literata; everything else is the room', () => {
    const read = COMPONENTS_CSS.match(/\.t-read\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(read).toContain('var(--font-read)');
    const title = COMPONENTS_CSS.match(/\.t-title\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(title).toContain('var(--font-ui)');
  });
});

/* ---------------- surface materials ---------------- */

describe('W5 gate: surface materials are roles, not accidents', () => {
  it('paper / glass / ink each own their skin', () => {
    for (const mat of ['mat-paper', 'mat-glass', 'mat-ink', 'mat-bordered', 'mat-sunken']) {
      expect(COMPONENTS_CSS.includes(`.${mat}`)).toBe(true);
    }
  });

  it('glass is the only blur in the room', () => {
    // the fallback's explicit `none` disables the effect, and the
    // @supports capability probe (blur(1px)) is a question, not a blur
    const blurs = (COMPONENTS_CSS.match(/backdrop-filter[^;]*/g) ?? []).filter(
      (b) => !b.includes(': none') && !b.includes('blur(1px)'),
    );
    expect(blurs.length).toBe(2); // prefixed pair on one rule
  });

  it('the elevation map covers every meaning word', () => {
    for (const step of ['elev-1', 'elev-2', 'elev-3']) {
      expect(LAYOUT_CSS.includes(`.${step}`)).toBe(true);
    }
  });

  it('divider is a hairline — never a shadow, never a gradient', () => {
    const d = COMPONENTS_CSS.match(/\.divider\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(d).toContain('background: var(--line)');
    expect(d).not.toContain('box-shadow');
    void Divider;
  });
});

/* ---------------- the family coherence ---------------- */

describe('W5 gate: one physical family', () => {
  it('every interactive skin has the press receipt (0.985) or defers to base', () => {
    // base.css owns .btn:active; component skins repeat the receipt where
    // they own the element: tabs, nav items, dots
    expect(COMPONENTS_CSS).toMatch(/\.tab:active\s*\{\s*transform: scale\(0\.985\)/);
    expect(COMPONENTS_CSS).toMatch(/\.nav-item:active\s*\{\s*transform: scale\(0\.985\)/);
  });

  it('the focus ring law: ink ring, visible to keyboards, everywhere interactive', () => {
    // base.css carries the global :focus-visible ring; inputs pair it
    // with their own border law — nothing removes it for aesthetics
    expect(COMPONENTS_CSS).not.toMatch(/outline:\s*none(?!;?\s*;?\s*border-color)/);
  });

  it('async states get the spinner + cursor law; attention gets accent', () => {
    expect(COMPONENTS_CSS.includes(".btn[data-state='loading']")).toBe(true);
    expect(COMPONENTS_CSS.includes('.status-error .status-dot')).toBe(true);
    expect(COMPONENTS_CSS).toMatch(/cursor: progress/);
  });

  it('progress and the reading hairline animate transform, never width', () => {
    const progress = COMPONENTS_CSS.match(/\.progress-fill\s*\{[^}]*\}/g)?.join('') ?? '';
    const hairline = COMPONENTS_CSS.match(/\.read-progress-fill\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(progress).toContain('transform: scaleX');
    expect(hairline).toContain('transform: scaleX');
    // the law is layout ANIMATION: no transition/animation rule may touch width
    expect(COMPONENTS_CSS).not.toMatch(/(?:transition|animation)[^;{}]*\bwidth\b/);
  });

  it('the annotation identities are the five + the pencil', () => {
    expect([...ANNO_IDENTITY]).toEqual(['amber', 'sage', 'blue', 'rose', 'violet']);
    for (const identity of [...ANNO_IDENTITY, 'gray']) {
      expect(COMPONENTS_CSS.includes(`.hl-${identity}`)).toBe(true);
      expect(COMPONENTS_CSS.includes(`.sel-${identity}`)).toBe(true);
    }
  });
});

/* ---------------- the state matrix door ---------------- */

describe('W5: primitives carry the semantic state door', () => {
  it('Button accepts state and speaks aria', () => {
    // structural: the prop exists on the signature (compile-checked);
    // here we assert the skin reacts to every data-state it can receive
    for (const state of ['loading', 'saving', 'processing', 'recovering', 'error', 'needs-attention', 'saved']) {
      expect(COMPONENTS_CSS.includes(`[data-state='${state}']`)).toBe(true);
    }
  });

  it('every icon name addresses a real glyph', () => {
    const names: IconName[] = ['search', 'book', 'note', 'trash', 'fitPage'];
    for (const n of names) expect(ICON_PATHS[n]).toBeDefined();
    void Text;
    void Surface;
    void Button;
  });
});
