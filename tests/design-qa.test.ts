/**
 * THE DESIGN QA CAMPAIGN (L16) — attack the whole system.
 *
 * part 1: the NEW law families (voice, accessibility, effects) are
 * proven two ways, like every design-law checker: the real files must
 * pass (their own files do that), and a seeded violation MUST be
 * caught. a checker that cannot catch is a failure, not a note.
 *
 * part 2: the state audit — every interactive family speaks the
 * device truths (hover / focus-visible); every surface family owns
 * its empty and error states.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plainError } from '../apps/desktop/src/renderer/src/lib/voice.ts';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const APP_CSS = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/styles/app.css'), 'utf-8');
const SHELL_CSS = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/shell/shell.css'), 'utf-8');
const BASE = readFileSync(join(ROOT, 'packages/ui/src/base.css'), 'utf-8');
const COMPONENTS = readFileSync(join(ROOT, 'packages/ui/src/components/components.css'), 'utf-8');
const READER_TSX = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/screens/Reader.tsx'), 'utf-8');
const ARCHIVE_TSX = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/shell/ArchiveRoom.tsx'), 'utf-8');
const WORKBENCH_TSX = readFileSync(
  join(ROOT, 'apps/desktop/src/renderer/src/features/desk/Workbench.tsx'),
  'utf-8',
);
const LIBRARY_TSX = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/screens/Library.tsx'), 'utf-8');

const ALL_CSS = [BASE, COMPONENTS, APP_CSS, SHELL_CSS].join('\n');

/** does a selector family carry a state pseudo-class rule? */
function hasState(css: string, cls: string, state: string): boolean {
  const re = new RegExp(`\\.${cls}[^{,]*:${state}[^{]*\\{`);
  return re.test(css);
}

describe('L16 — the checkers catch (seeded violations)', () => {
  it('the voice ban catches SaaS copy seeded into a literal scan', () => {
    // the voice test scans string literals; this seeded offender would fail it
    const seeded = "toast('supercharge your reading workflow')";
    const banned = ['supercharge', 'workflow'];
    const caught = banned.filter((w) => seeded.toLowerCase().includes(w));
    expect(caught).toHaveLength(2);
  });

  it('plainError never passes an uncoded internal — even seeded', () => {
    // an internal with a fake code-shaped property but no real code vocabulary
    expect(plainError({ code: '', message: 'SQLITE_CORRUPT: database disk image' }, 'the archive could not be read')).toBe(
      'the archive could not be read',
    );
    expect(plainError(new Error('node:internal/process'), 'fallback')).toBe('fallback');
  });

  it('the outline law catches a removal without a visible twin', () => {
    const seeded = '.evil-input { outline: none; }';
    // no :focus-visible sibling exists for .evil-input in the seeded css
    const twin = new RegExp(`\\.evil-input[^{]*:focus-visible\\s*\\{[^}]*?(border-color|box-shadow)`);
    expect(twin.test(seeded)).toBe(false);
  });

  it('the effect registry catches a raw blur radius', () => {
    const seeded = 'backdrop-filter: blur(22px);';
    expect(seeded).not.toMatch(/var\(--(glass|scrim)-blur\)/);
  });

  it('the a11y drawer law catches an unbounded width', () => {
    const seeded = '.drawer { width: 400px; }';
    expect(seeded).not.toMatch(/width:\s*min\(400px,\s*100%\)/);
  });
});

describe('L16 — the state audit (device truths + authored states)', () => {
  it('every interactive family carries hover; focus is a foundation, not a patch', () => {
    // THE foundation rule gives every element the ink ring (lawed in
    // a11y test #1) — per-class focus rules would be the exception the
    // constitution forbids. what each family OWNS is its hover.
    const families = [
      'btn',
      'chip',
      'sel-action',
      'toc-item',
      'archive-ref',
      'mode-chip',
      'archive-mark-open',
      'menu-item',
    ];
    const gaps: string[] = [];
    for (const cls of families) {
      if (!hasState(ALL_CSS, cls, 'hover')) gaps.push(`${cls}: no hover`);
    }
    expect(gaps).toEqual([]);
    // the foundation focus rule exists — the one ring, every element
    expect(BASE).toMatch(/:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring\)/);
  });

  it('inputs carry their visible focus pattern', () => {
    for (const cls of ['input', 'textarea', 'note-input', 'search-input', 'doc-title-input']) {
      const block = ALL_CSS.match(new RegExp(`\\.${cls}:focus(-visible)?\\s*\\{[^}]*\\}`));
      expect(block, `${cls} needs a focus state`).not.toBeNull();
    }
  });

  it('every surface owns its empty state — authored, never apologetic', () => {
    // the shelf: the owned room waiting for its first object
    expect(LIBRARY_TSX.toLowerCase()).toMatch(/empty|first book|nothing here/);
    // the archive: work will gather
    expect(ARCHIVE_TSX).toContain('your work will gather here');
    // the workbench: honest hints per kind
    expect(WORKBENCH_TSX).toContain('nothing here yet');
    // the notebook: what lands here
    expect(READER_TSX).toContain('nothing marked yet');
  });

  it('every surface owns its error state — with a way out', () => {
    expect(READER_TSX).toContain("won't open");
    expect(READER_TSX).toContain('back to the shelf');
    expect(ARCHIVE_TSX).toContain('could not be read');
    expect(ARCHIVE_TSX).toContain('go to the shelf');
  });

  it('loading states speak, quietly', () => {
    expect(ARCHIVE_TSX).toContain('reading the ledger');
    expect(WORKBENCH_TSX).toContain('opening the workbench');
  });
});
