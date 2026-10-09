/**
 * the per-book truth file: annotations.json.
 * THE LAW: json = durable truth (written FIRST, atomically + fsynced),
 * sqlite = rebuildable index. deleting the index costs zero data.
 */
import { readFileSync, mkdirSync, existsSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileSyncAtomic } from '@arivo/persistence';
import type { DeskDoc, Highlight, Bookmark, Note, ReadingProgress, Sketch, StickyNote } from '@arivo/core';

export interface BookTruth {
  version: 1;
  bookId: string;
  progress: ReadingProgress | null;
  highlights: Highlight[];
  bookmarks: Bookmark[];
  /** margin notes since schema 003 — absent in older files, tolerated on read */
  notes: Note[];
  /** desk documents since schema 004 — absent in older files, tolerated on read */
  deskDocs: DeskDoc[];
  /** sticky notes since schema 005 — absent in older files, tolerated on read */
  stickies: StickyNote[];
  /** page sketches since schema 005 — absent in older files, tolerated on read */
  sketches: Sketch[];
}

const empty = (bookId: string): BookTruth => ({
  version: 1,
  bookId,
  progress: null,
  highlights: [],
  bookmarks: [],
  notes: [],
  deskDocs: [],
  stickies: [],
  sketches: [],
});

export function readTruth(bookDir: string, bookId: string): BookTruth {
  const file = join(bookDir, 'annotations.json');
  if (!existsSync(file)) return empty(bookId);
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as Partial<BookTruth>;
    if (!Array.isArray(raw.highlights) || !Array.isArray(raw.bookmarks)) throw new Error('shape');
    return {
      version: 1,
      bookId,
      progress: raw.progress ?? null,
      highlights: raw.highlights,
      bookmarks: raw.bookmarks,
      notes: Array.isArray(raw.notes) ? raw.notes : [],
      deskDocs: Array.isArray(raw.deskDocs) ? raw.deskDocs : [],
      stickies: Array.isArray(raw.stickies) ? raw.stickies : [],
      sketches: Array.isArray(raw.sketches) ? raw.sketches : [],
    };
  } catch {
    // corrupted truth file: salvage via .bak, else start empty — never crash the library
    const bak = `${file}.bak`;
    if (existsSync(bak)) {
      try {
        const salvaged = JSON.parse(readFileSync(bak, 'utf-8')) as BookTruth;
        if (Array.isArray(salvaged.highlights)) {
          // the .bak is good — write it back as the live truth, atomically
          writeFileSyncAtomic(file, JSON.stringify({ ...salvaged, bookId }, null, 2));
          return {
            ...salvaged,
            bookId,
            notes: salvaged.notes ?? [],
            deskDocs: salvaged.deskDocs ?? [],
            stickies: salvaged.stickies ?? [],
            sketches: salvaged.sketches ?? [],
          };
        }
      } catch {
        /* fall through */
      }
    }
    return empty(bookId);
  }
}

/**
 * the atomic truth write: content → fsync → rename → fsync dir. a process
 * death at any point leaves the previous or the new content, never a
 * partial file (proven by crash.test.ts with real SIGKILLs). the previous
 * content rotates to `.bak` for corruption salvage.
 */
export function writeTruth(bookDir: string, truth: BookTruth): void {
  mkdirSync(bookDir, { recursive: true });
  const file = join(bookDir, 'annotations.json');
  const bak = `${file}.bak`;
  const content = JSON.stringify(truth, null, 2);
  if (existsSync(file)) {
    // rotate: the current live file becomes the salvage copy
    const current = readFileSync(file, 'utf-8');
    writeFileSync(bak, current);
  }
  writeFileSyncAtomic(file, content);
  // keep .bak exactly one generation behind; renameSync of a missing file never runs
  void renameSync;
}
