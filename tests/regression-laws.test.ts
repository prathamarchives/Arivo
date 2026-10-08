/**
 * THE REGRESSION LAWS (W2.6) — every bug found live becomes a permanent
 * test, so it cannot be reintroduced silently. these four each have a
 * receipt (session 0002, 0003, 0004): the unclickable menu, the
 * multi-class annotation that never painted, the stale mark geometry on
 * repagination, and the seed fixture that faked a green real-book test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const APP_CSS = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/styles/app.css'), 'utf-8');
const EPUB_TS = readFileSync(join(ROOT, 'packages/reader/src/epub.ts'), 'utf-8');
const READER_THEMES = readFileSync(join(ROOT, 'packages/ui/src/reader-themes.ts'), 'utf-8');
const GITIGNORE = readFileSync(join(ROOT, '.gitignore'), 'utf-8');

describe('regression 1 — the unclickable selection menu (session 0003, bdf885c)', () => {
  it('the menu sits at the overlay layer, at or above its own scrim', () => {
    const block = APP_CSS.match(/\.selection-menu\s*\{[^}]*\}/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).toMatch(/z-index:\s*var\(--z-overlay\)/);
    expect(block).not.toMatch(/z-index:\s*var\(--z-floating\)/);
  });
});

describe('regression 2 — the multi-class annotation that never painted (session 0002)', () => {
  it("epub.js's classList.add takes ONE token — the class is a single hyphenated token", () => {
    // the cls is built as `ar-hl-${color}` (or the orphaned marker) — no
    // space may ever ride along, or the mark throws and the catch
    // swallows it silently
    const m = EPUB_TS.match(/const cls =\s*([^;]+);/);
    expect(m).not.toBeNull();
    const clsExpr = m![1];
    expect(clsExpr).toMatch(/ar-hl-/);
    expect(clsExpr).not.toContain("' '");
  });

  it('every offered color has a paint rule (the svg fill contract)', () => {
    for (const color of ['yellow', 'blue', 'green', 'pink', 'gray']) {
      expect(READER_THEMES.includes(`.ar-hl-${color}`)).toBe(true);
    }
  });
});

describe('regression 3 — stale mark geometry on repagination (session 0002, killed twice)', () => {
  it('every repaginating field is a recreate trigger: font, leading, measure, pageMode, flow', () => {
    const block = EPUB_TS.match(/const repaginates =[\s\S]*?;/)?.[0] ?? '';
    expect(block).not.toBe('');
    for (const field of ['fontStep', 'lineHeight', 'measure', 'pageMode']) {
      expect(block).toContain(`settings.${field}`);
    }
    expect(block).toContain('flowChanged');
  });
});

describe('regression 4 — the seed fixture that faked a green test (session 0001/0002)', () => {
  it('the seed path stays gitignored — a fixture can never un-skip the real-book test', () => {
    expect(GITIGNORE).toContain('apps/desktop/public/seed/*.epub');
    expect(GITIGNORE).toContain('apps/desktop/public/seed/*.pdf');
  });
});
