/**
 * THE NOTEBOOK COMPOSITION LAWS (v0.3.3) — the spine of the book of you.
 *
 * 1. APPEND-ONLY: a new capture lands at the tail; old pages never
 *    reflow; page numbers are furniture. this is the spatial-memory law
 *    applied to your own mind.
 * 2. bookmarks never enter the notebook (position pegs are not
 *    knowledge).
 * 3. a written page is a page by definition — never packed with cards.
 * 4. search finds the sheet; links resolve at either endpoint.
 */
import { describe, it, expect } from 'vitest';
import { composeSheets, findSheet, linksForSheet, linkKey, CARDS_PER_SHEET } from './notebook-compose.ts';
import type { AnnotationLink, ArchiveEntry, NotebookPage } from '@arivo/core';

let seq = 0;
const at = (): number => {
  seq += 1000;
  return 1_700_000_000_000 + seq;
};

function hl(id: string, text: string, time: number): ArchiveEntry {
  return {
    id,
    kind: 'highlight',
    bookId: 'b1',
    bookTitle: 'A Book',
    bookAuthors: ['An Author'],
    bookFormat: 'epub',
    text,
    note: null,
    color: 'yellow',
    chapter: 'ch 1',
    question: false,
    deskKind: null,
    deskTitle: null,
    deskBody: null,
    sourceRefs: [],
    anchor: { format: 'epub', primary: `epubcfi(/6/4!/${id})`, textRange: null, position: null },
    createdAt: time,
    updatedAt: time,
  };
}

function page(id: string, body: string, time: number): NotebookPage {
  return { id, title: null, body, strokes: [], createdAt: time, updatedAt: time };
}

describe('the append-only law — the notebook is a journal, not a database', () => {
  it('pages pack greedily by capture time, oldest first', () => {
    const feed = Array.from({ length: 10 }, (_, i) => hl(`h${i}`, `quote ${i}`, at()));
    const sheets = composeSheets(feed, []);
    expect(sheets).toHaveLength(Math.ceil(10 / CARDS_PER_SHEET));
    expect(sheets[0]!.cards[0]!.entry.text).toBe('quote 0');
    expect(sheets[sheets.length - 1]!.cards.at(-1)!.entry.text).toBe('quote 9');
  });

  it('a NEW capture never reflows the FULL pages — only the tail may extend', () => {
    const feed = Array.from({ length: CARDS_PER_SHEET * 2 + 2 }, (_, i) => hl(`h${i}`, `quote ${i}`, at()));
    const before = composeSheets(feed, []);
    /* the full sheets (all but the tail) are immutable furniture */
    const immutable = before.slice(0, -1);
    const immutableKeys = immutable.map((s) => s.key);

    /* time passes; three new captures arrive */
    const after = composeSheets(
      [...feed, hl('n1', 'new 1', at()), hl('n2', 'new 2', at()), hl('n3', 'new 3', at())],
      [],
    );
    expect(after.slice(0, immutableKeys.length).map((s) => s.key)).toEqual(immutableKeys);
    /* the head never moves */
    expect(after[0]!.key).toBe(before[0]!.key);
    /* the tail never LOSES anything — the last page fills before a new
     * one starts (the paper journal's own law) */
    const beforeTail = before.at(-1)!.cards.map((c) => c.key);
    const afterTailAt = after
      .find((s) => s.cards.some((c) => c.key === beforeTail[0]))!
      .cards.map((c) => c.key);
    expect(afterTailAt.slice(0, beforeTail.length)).toEqual(beforeTail);
    expect(after.length).toBeGreaterThanOrEqual(before.length);
  });

  it('bookmarks never enter the notebook', () => {
    const feed: ArchiveEntry[] = [
      hl('h1', 'a quote', at()),
      {
        ...hl('k1', 'peg', at()),
        kind: 'bookmark',
      },
    ];
    const sheets = composeSheets(feed, []);
    expect(sheets.flatMap((s) => s.cards)).toHaveLength(1);
  });

  it('a written page is its own sheet — the auto sheet in progress flushes', () => {
    const t0 = at();
    const feed = [hl('h1', 'one', t0), hl('h2', 'two', at())];
    const pages = [page('p1', 'a thought', at())];
    const sheets = composeSheets(feed, pages);
    /* one auto sheet (both cards) + one free sheet, chronological */
    expect(sheets).toHaveLength(2);
    expect(sheets.find((s) => s.kind === 'freeform')!.page!.body).toBe('a thought');
  });
});

describe('the search + link laws', () => {
  it('findSheet finds card text and page bodies, case-quietly', () => {
    const sheets = composeSheets(
      [hl('h1', 'the achievement-subject', at()), hl('h2', 'something else', at())],
      [page('p1', 'compulsive freedom', at())],
    );
    expect(findSheet(sheets, 'achievement')).toBe(0);
    expect(findSheet(sheets, 'COMPULSIVE')).toBeGreaterThanOrEqual(0);
    expect(findSheet(sheets, 'nothing matches this')).toBe(-1);
  });

  it('links resolve at either endpoint; the page kind addresses as free', () => {
    const feed = [hl('h1', 'one', at()), hl('h2', 'two', at())];
    const pages = [page('p1', 'mine', at())];
    const sheets = composeSheets(feed, pages);
    const link: AnnotationLink = {
      id: 'l1',
      from: { kind: 'highlight', id: 'h1' },
      to: { kind: 'page', id: 'p1' },
      reason: 'same mechanism',
      createdAt: at(),
    };
    const h1Sheet = sheets.find((s) => s.cards.some((c) => c.key === 'highlight:h1'))!;
    const p1Sheet = sheets.find((s) => s.kind === 'freeform')!;
    expect(linksForSheet([link], h1Sheet)).toHaveLength(1);
    expect(linksForSheet([link], p1Sheet)).toHaveLength(1);
    expect(linkKey(link.to)).toBe('free:p1');
  });
});
