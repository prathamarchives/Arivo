/**
 * the per-book truth file: annotations.json.
 * THE LAW: json = durable truth (written first), sqlite = rebuildable index.
 * deleting the index costs zero data.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { Highlight, Bookmark, ReadingProgress } from '@arivo/core';

export interface BookTruth {
  version: 1;
  bookId: string;
  progress: ReadingProgress | null;
  highlights: Highlight[];
  bookmarks: Bookmark[];
}

const empty = (bookId: string): BookTruth => ({
  version: 1,
  bookId,
  progress: null,
  highlights: [],
  bookmarks: [],
});

export function readTruth(bookDir: string, bookId: string): BookTruth {
  const file = join(bookDir, 'annotations.json');
  if (!existsSync(file)) return empty(bookId);
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as Partial<BookTruth>;
    return {
      version: 1,
      bookId,
      progress: raw.progress ?? null,
      highlights: raw.highlights ?? [],
      bookmarks: raw.bookmarks ?? [],
    };
  } catch {
    // corrupted truth file: salvage via .bak, else start empty — never crash the library
    const bak = `${file}.bak`;
    if (existsSync(bak)) {
      try {
        return JSON.parse(readFileSync(bak, 'utf-8')) as BookTruth;
      } catch {
        /* fall through */
      }
    }
    return empty(bookId);
  }
}

/** atomic-ish: write .new → rename to live, keep previous as .bak */
export function writeTruth(bookDir: string, truth: BookTruth): void {
  mkdirSync(bookDir, { recursive: true });
  const file = join(bookDir, 'annotations.json');
  const next = `${file}.new`;
  const bak = `${file}.bak`;
  writeFileSync(next, JSON.stringify(truth, null, 2), 'utf-8');
  if (existsSync(file)) renameSync(file, bak);
  renameSync(next, file);
}
