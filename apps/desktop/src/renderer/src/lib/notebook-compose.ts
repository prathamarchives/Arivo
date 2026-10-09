/**
 * the notebook's composition engine (v0.3.3) — the pure math that turns
 * the reading life into pages. no react, no ipc: everything here is
 * testable law.
 *
 * THE APPEND-ONLY INVARIANT (the notebook's spine): pages compose from
 * the timeline of WHEN you captured, oldest first. a new capture is
 * always newer than everything before it, so it lands at the tail — the
 * old pages never reflow, their numbers never move. the notebook is a
 * journal, not a database.
 *
 * freeform pages (your own writing) are pages BY DEFINITION — they never
 * share a sheet with cards. when one arrives mid-timeline the auto page
 * in progress flushes, the written page takes its own sheet, and packing
 * resumes after it.
 */
import type { AnnotationLink, ArchiveEntry, NotebookPage } from '@arivo/core';

/** cards per auto-generated sheet — six is a full page of thought */
export const CARDS_PER_SHEET = 6;

export type SheetKind = 'auto' | 'freeform';

export interface EntryCard {
  key: string;
  kind: 'highlight' | 'note' | 'deskdoc';
  at: number;
  entry: ArchiveEntry;
}

export interface NotebookSheet {
  key: string;
  kind: SheetKind;
  /** stable: the first + last item keys this sheet spans */
  firstKey: string;
  lastKey: string;
  dateLabel: string;
  cards: EntryCard[];
  page: NotebookPage | null;
}

interface TimelineItem {
  key: string;
  at: number;
  kind: 'highlight' | 'note' | 'deskdoc' | 'freeform';
  entry?: ArchiveEntry;
  page?: NotebookPage;
}

function dateLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** compose the sheets: timeline order, greedy packing, append-only. */
export function composeSheets(
  feed: ArchiveEntry[],
  pages: NotebookPage[],
): NotebookSheet[] {
  /* bookmarks are position pegs, not knowledge — the notebook keeps
   * what you learned and what you thought, not where you paused */
  const items: TimelineItem[] = [];
  for (const e of feed) {
    if (e.kind === 'bookmark') continue;
    items.push({
      key: `${e.kind}:${e.id}`,
      at: Math.min(e.updatedAt, e.createdAt) || e.createdAt,
      kind: e.kind,
      entry: e,
    });
  }
  for (const p of pages) {
    items.push({ key: `free:${p.id}`, at: p.createdAt, kind: 'freeform', page: p });
  }
  items.sort((a, b) => a.at - b.at);

  const sheets: NotebookSheet[] = [];
  let pending: EntryCard[] = [];

  const flush = (): void => {
    if (pending.length === 0) return;
    sheets.push({
      key: `auto:${pending[0]!.key}-${pending[pending.length - 1]!.key}`,
      kind: 'auto',
      firstKey: pending[0]!.key,
      lastKey: pending[pending.length - 1]!.key,
      dateLabel: dateLabel(pending[0]!.at),
      cards: pending,
      page: null,
    });
    pending = [];
  };

  for (const item of items) {
    if (item.kind === 'freeform') {
      /* a written page is a page by definition — the auto sheet in
       * progress flushes, the writing takes its own sheet */
      flush();
      const p = item.page!;
      sheets.push({
        key: `free:${p.id}`,
        kind: 'freeform',
        firstKey: item.key,
        lastKey: item.key,
        dateLabel: dateLabel(p.createdAt),
        cards: [],
        page: p,
      });
    } else {
      pending.push({
        key: item.key,
        kind: item.kind,
        at: item.at,
        entry: item.entry!,
      });
      if (pending.length >= CARDS_PER_SHEET) flush();
    }
  }
  flush();
  return sheets;
}

/** find the sheet index containing a query (card text + page bodies) */
export function findSheet(
  sheets: NotebookSheet[],
  query: string,
): number {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return -1;
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i]!;
    if (s.kind === 'freeform') {
      const p = s.page!;
      if ((p.title ?? '').toLowerCase().includes(q) || p.body.toLowerCase().includes(q)) return i;
      continue;
    }
    for (const c of s.cards) {
      const e = c.entry;
      const hay = `${e.text} ${e.note ?? ''} ${e.deskTitle ?? ''} ${e.deskBody ?? ''}`.toLowerCase();
      if (hay.includes(q)) return i;
    }
  }
  return -1;
}

/** the links that touch a sheet (either endpoint on this sheet) */
export function linksForSheet(
  links: AnnotationLink[],
  sheet: NotebookSheet,
): AnnotationLink[] {
  const keys = new Set(sheet.cards.map((c) => c.key));
  if (sheet.page) keys.add(`free:${sheet.page.id}`);
  return links.filter(
    (l) =>
      keys.has(linkKey(l.from)) ||
      keys.has(linkKey(l.to)),
  );
}

export function linkKey(ref: { kind: string; id: string }): string {
  return ref.kind === 'page' ? `free:${ref.id}` : `${ref.kind}:${ref.id}`;
}
