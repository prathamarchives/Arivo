/**
 * THE TOOLBOX LAWS (v0.3.2) — the right-click is the reader's single
 * entry point. every action that lived on the navbar has a home: the
 * toolbox, a shortcut, or the palette. the native context menu never
 * shows on the reading surface. the ink family grows (graphite + the
 * width ladder) and the sticky paper resizes — both proven here as
 * executable law, the same two-way proof the design law uses: the real
 * files must pass, and the checkers must catch.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemas } from '../apps/desktop/src/main/ipc-schemas.ts';
import { ValidationError } from '../packages/core/src/index.ts';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const READER_TSX = readFileSync(
  join(ROOT, 'apps/desktop/src/renderer/src/screens/Reader.tsx'),
  'utf-8',
);
const PAGE_OBJECTS_TSX = readFileSync(
  join(ROOT, 'apps/desktop/src/renderer/src/screens/PageObjects.tsx'),
  'utf-8',
);
const EPUB_TS = readFileSync(join(ROOT, 'packages/reader/src/epub.ts'), 'utf-8');
const PDF_TS = readFileSync(join(ROOT, 'packages/reader/src/pdf.ts'), 'utf-8');
const FORMATS_TS = readFileSync(join(ROOT, 'packages/core/src/formats.ts'), 'utf-8');

const stickyBase = {
  id: 'k' .repeat(20),
  bookId: 'b'.repeat(20),
  anchor: {
    format: 'epub',
    primary: 'epubcfi(/6/4)',
    textRange: null,
    position: { spineIndex: 1 },
  },
  body: 'a thought pinned to the page',
  color: 'yellow',
  x: 0.4,
  y: 0.2,
  chapter: null,
  createdAt: 1,
  updatedAt: 1,
};

const sketchBase = {
  id: 'k'.repeat(20),
  bookId: 'b'.repeat(20),
  anchor: stickyBase.anchor,
  strokes: [
    { tool: 'pencil', color: 'ink', size: 2, points: [0.1, 0.1, 0.2, 0.2] },
  ],
  chapter: null,
  createdAt: 1,
  updatedAt: 1,
};

const expectReject = (schema: { (input: unknown, path?: string): unknown }, input: unknown): void => {
  try {
    schema(input);
    expect.unreachable('schema must reject this input');
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
  }
};

describe('the toolbox law — the right-click is the door', () => {
  it('the hook exists in the contract and both adapters speak it', () => {
    expect(FORMATS_TS).toContain('onContextMenu?:');
    // epub: wired per rendered contents, translated across the iframe
    expect(EPUB_TS).toContain('wireContextMenu');
    expect(EPUB_TS).toContain("doc.addEventListener('contextmenu'");
    expect(EPUB_TS).toContain('e.preventDefault()');
    expect(EPUB_TS).toContain('frameElement');
    // pdf: wired on the container
    expect(PDF_TS).toContain("container.addEventListener('contextmenu'");
  });

  it('the reader answers the right-click on the whole surface — and never on the paper', () => {
    // the host-side door
    expect(READER_TSX).toContain('onReaderContextMenu');
    expect(READER_TSX).toContain('onContextMenu={onReaderContextMenu}');
    // the adapter-side door (the epub iframe)
    expect(READER_TSX).toContain('onContextMenu: (p) =>');
    // the paper is self-contained; inputs keep their paste menu
    expect(READER_TSX).toContain(".sticky-note')");
  });

  it('the toolbox is a labeled menu carrying the page furniture + the pens', () => {
    expect(READER_TSX).toContain('function PageToolbox');
    expect(READER_TSX).toContain('role="menu"');
    expect(READER_TSX).toContain('aria-label="page tools"');
    for (const action of ['sticky', 'bookmark', 'note', 'contents', 'highlights']) {
      expect(READER_TSX.toLowerCase()).toContain(action);
    }
  });

  it('a right-click with a selection re-anchors the selection instrument, never a second menu', () => {
    // the SelectionMenu takes the right-click position; the page toolbox
    // only renders when there is no selection — one instrument at a time
    expect(READER_TSX).toContain('at={toolbox}');
    expect(READER_TSX).toMatch(/\{toolbox && !selection && \(/);
  });

  it('the escape cascade peels the toolbox first', () => {
    const block = READER_TSX.match(/case 'Escape':[\s\S]*?break;/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block.indexOf('if (toolbox)')).toBeLessThan(block.indexOf('if (tocOpen)'));
  });
});

describe('the ink family law — graphite and the width ladder', () => {
  it('the palette is the five identity colors plus graphite', () => {
    expect(PAGE_OBJECTS_TSX).toContain("INK_COLORS: readonly InkColor[] = ['ink', 'yellow', 'blue', 'green', 'pink', 'violet']");
    // graphite reads the room's ink token, not an identity color
    expect(PAGE_OBJECTS_TSX).toContain("getPropertyValue('--ink')");
  });

  it('the width ladder is three steps over each tool\'s own character', () => {
    expect(PAGE_OBJECTS_TSX).toContain('INK_WIDTHS: readonly number[] = [1, 1.8, 3.2]');
  });

  it('the schema accepts graphite strokes and honest widths, rejects lies', () => {
    expect(() => schemas.sketchSave({ bookId: 'b'.repeat(20), s: sketchBase })).not.toThrow();
    expect(() =>
      schemas.sketchSave({
        bookId: 'b'.repeat(20),
        s: { ...sketchBase, strokes: [{ tool: 'pen', color: 'violet', size: 6.3, points: [0, 0, 1, 1] }] },
      }),
    ).not.toThrow();
    expectReject(schemas.sketchSave, {
      bookId: 'b'.repeat(20),
      s: { ...sketchBase, strokes: [{ tool: 'pen', color: 'neon', size: 6, points: [0, 0, 1, 1] }] },
    });
    expectReject(schemas.sketchSave, {
      bookId: 'b'.repeat(20),
      s: { ...sketchBase, strokes: [{ tool: 'crayon', color: 'ink', size: 6, points: [0, 0, 1, 1] }] },
    });
  });
});

describe('the sticky paper law — resizable, fractionally honest', () => {
  it('the grip exists and the paper commits fractions once', () => {
    expect(PAGE_OBJECTS_TSX).toContain('aria-label="resize note"');
    expect(PAGE_OBJECTS_TSX).toContain('onResizePointerUp');
    expect(PAGE_OBJECTS_TSX).toMatch(/\.\.\.\(note\.w !== undefined \? \{ width:/);
  });

  it('the schema takes optional w/h in honest bounds, rejects out-of-bounds', () => {
    expect(() => schemas.stickyCreate({ bookId: 'b'.repeat(20), s: { ...stickyBase, w: 0.3, h: 0.2 } })).not.toThrow();
    // legacy notes (no w/h) still pass — absence is the class default
    expect(() => schemas.stickyCreate({ bookId: 'b'.repeat(20), s: stickyBase })).not.toThrow();
    expectReject(schemas.stickyCreate, { bookId: 'b'.repeat(20), s: { ...stickyBase, w: 2 } });
    expectReject(schemas.stickyCreate, { bookId: 'b'.repeat(20), s: { ...stickyBase, h: -0.1 } });
  });
});
