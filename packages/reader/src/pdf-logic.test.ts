/**
 * THE PDF SUBSTRATE'S PURE LAWS — tested (D12: the reader package
 * finally has tests; the DOM/pdf.js halves are proven live in W2.2).
 */
import { describe, expect, it } from 'vitest';
import {
  PDF_RENDER_BUFFER,
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  chapterForPage,
  chapterLeaves,
  clampPage,
  computeScale,
  normalizeRect,
  outlineToChapters,
  pageWindow,
  parsePageTarget,
  pdfOpenError,
  stepZoom,
  zoomLabel,
  type OutlineItemLike,
} from './pdf-logic.ts';

describe('clampPage', () => {
  it('keeps pages inside the document', () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(-5, 10)).toBe(1);
    expect(clampPage(11, 10)).toBe(10);
    expect(clampPage(5, 10)).toBe(5);
  });
  it('a zero-page document still reports page 1 (the adapter rejects it earlier)', () => {
    expect(clampPage(3, 0)).toBe(1);
  });
  it('garbage falls back to page 1', () => {
    expect(clampPage(Number.NaN, 10)).toBe(1);
    expect(clampPage(Number.POSITIVE_INFINITY, 10)).toBe(1);
  });
});

describe('parsePageTarget', () => {
  it('speaks page: locators, raw numbers, and nothing else', () => {
    expect(parsePageTarget('page:12', 20)).toBe(12);
    expect(parsePageTarget('12', 20)).toBe(12);
    expect(parsePageTarget(undefined, 20)).toBe(1);
    expect(parsePageTarget('page:99', 20)).toBe(20);
    expect(parsePageTarget('garbage', 20)).toBe(1);
    expect(parsePageTarget('page:0', 20)).toBe(1);
  });
});

describe('pageWindow — the laziness contract', () => {
  it('centers the live window on the current page', () => {
    expect(pageWindow(10, 50, PDF_RENDER_BUFFER)).toEqual({ first: 8, last: 12 });
  });
  it('clamps at the document edges', () => {
    expect(pageWindow(1, 50, 2)).toEqual({ first: 1, last: 3 });
    expect(pageWindow(50, 50, 2)).toEqual({ first: 48, last: 50 });
    expect(pageWindow(1, 2, 2)).toEqual({ first: 1, last: 2 });
  });
  it('a big buffer never escapes the document', () => {
    expect(pageWindow(3, 5, 10)).toEqual({ first: 1, last: 5 });
  });
});

describe('computeScale', () => {
  it('fit-width divides the available width by the page box', () => {
    expect(computeScale('fit-width', 612, 792, 564, 700)).toBeCloseTo(564 / 612);
  });
  it('fit-page takes the tighter of both axes', () => {
    expect(computeScale('fit-page', 612, 792, 564, 500)).toBeCloseTo(500 / 792);
    expect(computeScale('fit-page', 612, 792, 300, 700)).toBeCloseTo(300 / 612);
  });
  it('numeric zoom is clamped to the ladder', () => {
    expect(computeScale(0.1, 612, 792, 564, 700)).toBe(PDF_ZOOM_MIN);
    expect(computeScale(99, 612, 792, 564, 700)).toBe(PDF_ZOOM_MAX);
    expect(computeScale(1.5, 612, 792, 564, 700)).toBe(1.5);
  });
  it('zero-sized pages never divide by zero', () => {
    expect(computeScale('fit-width', 0, 0, 564, 700)).toBe(564);
  });
});

describe('stepZoom', () => {
  it('fit modes enter the ladder at 100%', () => {
    expect(stepZoom('fit-width', 1.25)).toBe(1.25);
  });
  it('steps around the current scale, clamped', () => {
    expect(stepZoom(1, 1.25)).toBe(1.25);
    expect(stepZoom(1.25, 0.8)).toBe(1);
    expect(stepZoom(PDF_ZOOM_MAX, 1.25)).toBe(PDF_ZOOM_MAX);
    expect(stepZoom(PDF_ZOOM_MIN, 0.8)).toBe(PDF_ZOOM_MIN);
  });
});

describe('zoomLabel', () => {
  it('labels modes and percentages honestly', () => {
    expect(zoomLabel('fit-width')).toBe('fit width');
    expect(zoomLabel('fit-page')).toBe('fit page');
    expect(zoomLabel(1.25)).toBe('125%');
    expect(zoomLabel(0.5)).toBe('50%');
  });
});

describe('outlineToChapters', () => {
  const tree: OutlineItemLike[] = [
    {
      title: 'Part One',
      items: [
        { title: 'Chapter 1', items: null },
        { title: 'Chapter 2', items: [] },
      ],
    },
    { title: 'Part Two', items: [{ title: 'Chapter 3' }] },
    { title: '', items: [{ title: 'Unlabeled parent' }] },
  ];
  const pages = new Map<OutlineItemLike, number>([
    [tree[0]!, 1],
    [tree[0]!.items![0]!, 1],
    [tree[0]!.items![1]!, 5],
    [tree[1]!, 9],
    [tree[1]!.items![0]!, 10],
  ]);

  it('builds the hierarchy with page targets', () => {
    const chapters = outlineToChapters(tree, (i) => pages.get(i) ?? null);
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toMatchObject({ label: 'Part One', target: 'page:1' });
    expect(chapters[0]!.children.map((c) => c.target)).toEqual(['page:1', 'page:5']);
    expect(chapters[1]!.children[0]).toMatchObject({ label: 'Chapter 3', target: 'page:10' });
  });
  it('an unlabeled parent is dropped along with its subtree', () => {
    const chapters = outlineToChapters(tree, (i) => pages.get(i) ?? 1);
    expect(chapters.every((c) => c.label.length > 0)).toBe(true);
    expect(chapters.flatMap((c) => c.children)).toHaveLength(3);
  });
  it('a parent with no page of its own inherits its first child\'s target', () => {
    const chapters = outlineToChapters(tree, (i) => pages.get(i) ?? null);
    expect(chapters[1]).toMatchObject({ label: 'Part Two', target: 'page:9' });
  });
  it('items with no page and no children are dropped, never guessed', () => {
    const chapters = outlineToChapters(
      [{ title: 'Floating' }, { title: 'Chapter 1' }],
      (i) => (i.title === 'Chapter 1' ? 3 : null),
    );
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.target).toBe('page:3');
  });
  it('an unresolvable destination never produces a wrong target', () => {
    const chapters = outlineToChapters([{ title: 'A' }], () => null);
    expect(chapters).toHaveLength(0);
  });
  it('huge outlines are budgeted, not exploded', () => {
    const many: OutlineItemLike[] = Array.from({ length: 5000 }, (_, i) => ({
      title: `T${i}`,
    }));
    expect(outlineToChapters(many, () => 1, 100).length).toBeLessThanOrEqual(100);
  });
});

describe('chapterLeaves + chapterForPage', () => {
  const chapters = outlineToChapters(
    [
      { title: 'Part One', items: [{ title: 'Chapter 1' }, { title: 'Chapter 2' }] },
      { title: 'Part Two', items: [{ title: 'Chapter 3' }] },
    ],
    (i) =>
      i.title === 'Part One' ? 1 : i.title === 'Chapter 1' ? 3 : i.title === 'Chapter 2' ? 5 : i.title === 'Part Two' ? 8 : 9,
  );

  it('flattens to page-sorted leaves', () => {
    const leaves = chapterLeaves(chapters);
    expect(leaves.map((l) => [l.page, l.label])).toEqual([
      [1, 'Part One'],
      [3, 'Chapter 1'],
      [5, 'Chapter 2'],
      [8, 'Part Two'],
      [9, 'Chapter 3'],
    ]);
  });
  it('the nearest heading at or before the page wins', () => {
    const leaves = chapterLeaves(chapters);
    expect(chapterForPage(leaves, 1)).toBe('Part One');
    expect(chapterForPage(leaves, 4)).toBe('Chapter 1');
    expect(chapterForPage(leaves, 8)).toBe('Part Two');
    expect(chapterForPage(leaves, 9)).toBe('Chapter 3');
    expect(chapterForPage(leaves, 50)).toBe('Chapter 3');
  });
  it('before the first heading → null (the caller falls back to Page N)', () => {
    expect(chapterForPage(chapterLeaves(chapters), 0)).toBeNull();
    expect(chapterForPage([], 5)).toBeNull();
  });
});

describe('pdfOpenError — failures explain themselves', () => {
  it('password', () => {
    const e = Object.assign(new Error('No password given'), { name: 'PasswordException' });
    expect(pdfOpenError(e)).toContain('password-protected');
  });
  it('damaged', () => {
    const e = Object.assign(new Error('Invalid PDF'), { name: 'InvalidPDFException' });
    expect(pdfOpenError(e)).toContain('not a readable pdf');
  });
  it('missing', () => {
    const e = Object.assign(new Error('Missing'), { name: 'MissingPDFException' });
    expect(pdfOpenError(e)).toContain('missing or in use');
  });
  it('unknown still speaks plainly', () => {
    expect(pdfOpenError(new Error('weird'))).toBe('the pdf failed to open');
    expect(pdfOpenError(null)).toBe('the pdf failed to open');
  });
});

describe('normalizeRect', () => {
  it('client rect + page box → 0-1 anchor rect', () => {
    const r = normalizeRect(
      { left: 100, top: 50, width: 200, height: 20 },
      { left: 0, top: 0, width: 400, height: 800 },
      7,
    );
    expect(r).toEqual({ page: 7, x: 0.25, y: 0.0625, w: 0.5, h: 0.025 });
  });
  it('zero-area boxes never divide by zero', () => {
    const r = normalizeRect({ left: 0, top: 0, width: 10, height: 10 }, { left: 0, top: 0, width: 0, height: 0 }, 1);
    expect(r.x).toBe(0);
    expect(r.w).toBe(10);
  });
});
