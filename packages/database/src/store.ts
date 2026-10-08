/**
 * the store — every mutation, dual-write. json first (truth), sqlite second (index).
 * either store can die; the truth reconstructs everything.
 */
import { join } from 'node:path';
import {
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import type {
  Book,
  BookFolderMeta,
  DeskDoc,
  Highlight,
  Bookmark,
  Note,
  ReadingProgress,
  Collection,
  SearchHit,
  ArchiveEntry,
  Anchor,
  HighlightColor,
  ResolutionStatus,
  SessionStats,
  SessionDayStat,
  BookTimeStat,
} from '@arivo/core';
import { uuidv7, exportReadingNotes } from '@arivo/core';
import { writeFileSyncAtomic } from '@arivo/persistence';
import { openDb, openMemoryDb, type Db } from './db.ts';
import { readTruth, writeTruth } from './truth.ts';
import { toFtsPrefixQuery } from './search-query.ts';

/** the folder contract (metadata.json) is the domain shape — see @arivo/core */
export type BookRecord = BookFolderMeta;

export interface BookWithProgress extends Book {
  progress: ReadingProgress | null;
}

const rowToBook = (r: BookRow): Book => ({
  id: r.id,
  title: r.title,
  subtitle: r.subtitle,
  authors: JSON.parse(r.authors) as string[],
  description: r.description,
  language: r.language,
  publisher: r.publisher,
  publishedYear: r.published_year,
  coverPath: r.cover_path,
  format: r.format as Book['format'],
  hash: r.hash,
  fileName: r.file_name,
  fileSize: r.file_size,
  addedAt: r.added_at,
  updatedAt: r.updated_at,
  tags: [],
  fileMissing: r.file_missing === 1,
});

interface BookRow {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string;
  description: string | null;
  language: string | null;
  publisher: string | null;
  published_year: string | null;
  cover_path: string | null;
  format: string;
  hash: string;
  file_name: string;
  file_size: number;
  added_at: number;
  updated_at: number;
  fts_row: number;
  file_missing: number;
}

interface HighlightRow {
  id: string;
  book_id: string;
  primary_locator: string;
  text_exact: string;
  text_prefix: string;
  text_suffix: string;
  pos_spine: number | null;
  pos_page: number | null;
  pos_percent: number | null;
  chapter: string | null;
  color: string;
  note: string | null;
  status: string;
  text: string;
  created_at: number;
  updated_at: number;
  fts_row: number;
}

interface BookmarkRow {
  id: string;
  book_id: string;
  primary_locator: string;
  pos_spine: number | null;
  pos_page: number | null;
  pos_percent: number | null;
  label: string | null;
  chapter: string | null;
  created_at: number;
}

interface NoteRow {
  id: string;
  book_id: string;
  primary_locator: string;
  text_exact: string;
  text_prefix: string;
  text_suffix: string;
  pos_spine: number | null;
  pos_page: number | null;
  pos_percent: number | null;
  chapter: string | null;
  body: string;
  question: number;
  created_at: number;
  updated_at: number;
  fts_row: number;
}

interface DeskDocRow {
  id: string;
  book_id: string;
  kind: string;
  title: string;
  body: string;
  source_refs: string;
  created_at: number;
  updated_at: number;
  fts_row: number;
}

const rowToDeskDoc = (r: DeskDocRow): DeskDoc => ({
  id: r.id,
  bookId: r.book_id,
  kind: r.kind === 'research' || r.kind === 'make' || r.kind === 'reflect' ? r.kind : 'research',
  title: r.title,
  body: r.body,
  sourceRefs: JSON.parse(r.source_refs || '[]') as DeskDoc['sourceRefs'],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const rowToNote = (r: NoteRow): Note => ({
  id: r.id,
  bookId: r.book_id,
  anchor: {
    format: 'epub',
    primary: r.primary_locator,
    textRange:
      r.text_exact || r.text_prefix || r.text_suffix
        ? { exact: r.text_exact, prefix: r.text_prefix, suffix: r.text_suffix }
        : null,
    position: { spineIndex: r.pos_spine ?? undefined, page: r.pos_page ?? undefined, percent: r.pos_percent ?? undefined },
  },
  body: r.body,
  chapter: r.chapter,
  question: r.question === 1 ? true : undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const rowToHighlight = (r: HighlightRow): Highlight => ({
  id: r.id,
  bookId: r.book_id,
  anchor: {
    format: 'epub',
    primary: r.primary_locator,
    textRange: { exact: r.text_exact, prefix: r.text_prefix, suffix: r.text_suffix },
    position: { spineIndex: r.pos_spine ?? undefined, page: r.pos_page ?? undefined, percent: r.pos_percent ?? undefined },
  },
  color: r.color as HighlightColor,
  text: r.text,
  chapter: r.chapter,
  note: r.note,
  status: r.status as ResolutionStatus,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const rowToBookmark = (r: BookmarkRow): Bookmark => ({
  id: r.id,
  bookId: r.book_id,
  anchor: {
    format: 'epub',
    primary: r.primary_locator,
    textRange: null,
    position: { spineIndex: r.pos_spine ?? undefined, page: r.pos_page ?? undefined, percent: r.pos_percent ?? undefined },
  },
  label: r.label,
  chapter: r.chapter,
  createdAt: r.created_at,
});

const anchorCols = (a: Anchor) => ({
  primary_locator: a.primary,
  text_exact: a.textRange?.exact ?? '',
  text_prefix: a.textRange?.prefix ?? '',
  text_suffix: a.textRange?.suffix ?? '',
  pos_spine: a.position?.spineIndex ?? null,
  pos_page: a.position?.page ?? null,
  pos_percent: a.position?.percent ?? null,
});

interface CollectionsTruth {
  version: 1;
  collections: Collection[];
  items: { collectionId: string; bookId: string }[];
}

export class ArivoStore {
  private readonly db: Db;
  private readonly libraryRoot: string;
  private seq: ReturnType<Db['raw']['prepare']>;

  constructor(db: Db, libraryRoot: string) {
    this.db = db;
    this.libraryRoot = libraryRoot;
    mkdirSync(join(libraryRoot, 'library'), { recursive: true });
    mkdirSync(join(libraryRoot, 'config'), { recursive: true });
    this.seq = db.raw.prepare('UPDATE fts_seq SET next = next + 1 WHERE name = ?');
  }

  booksDir(): string {
    return join(this.libraryRoot, 'library');
  }

  bookDir(bookId: string): string {
    return join(this.libraryRoot, 'library', bookId);
  }

  private nextSeq(name: string): number {
    const row = this.db.raw
      .prepare('SELECT next FROM fts_seq WHERE name = ?')
      .get(name) as { next: number } | undefined;
    if (!row) {
      this.db.raw.prepare('INSERT INTO fts_seq(name, next) VALUES (?, 2)').run(name);
      return 1;
    }
    this.seq.run(name);
    return row.next;
  }

  // ---------- books ----------

  listBooks(): BookWithProgress[] {
    const rows = this.db.raw.prepare('SELECT * FROM books ORDER BY added_at DESC').all() as BookRow[];
    const tags = new Map<string, string[]>();
    for (const t of this.db.raw.prepare('SELECT book_id, tag FROM tags').all() as {
      book_id: string;
      tag: string;
    }[]) {
      const arr = tags.get(t.book_id) ?? [];
      arr.push(t.tag);
      tags.set(t.book_id, arr);
    }
    const prog = new Map<string, ReadingProgress>();
    for (const p of this.db.raw.prepare('SELECT * FROM progress').all() as Record<
      string,
      unknown
    >[]) {
      prog.set(p.book_id as string, {
        bookId: p.book_id as string,
        locator: p.locator as string,
        percent: p.percent as number,
        chapter: (p.chapter as string | null) ?? null,
        startedAt: (p.started_at as number | null) ?? null,
        lastReadAt: p.last_read_at as number,
        completedAt: (p.completed as number) === 1,
      });
    }
    return rows.map((r) => {
      const b = rowToBook(r);
      b.tags = tags.get(r.id) ?? [];
      return { ...b, progress: prog.get(r.id) ?? null };
    });
  }

  getBook(id: string): BookWithProgress | null {
    const row = this.db.raw.prepare('SELECT * FROM books WHERE id = ?').get(id) as
      | BookRow
      | undefined;
    if (!row) return null;
    const all = this.listBooks();
    return all.find((b) => b.id === id) ?? null;
  }

  findByHash(hash: string): string | null {
    const row = this.db.raw.prepare('SELECT id FROM books WHERE hash = ?').get(hash) as
      | { id: string }
      | undefined;
    return row?.id ?? null;
  }

  /** index a book whose folder the documents layer already wrote (truth exists) */
  indexBook(rec: BookRecord): void {
    const now = rec.addedAt ?? Date.now();
    const fts = this.nextSeq('book');
    this.db.raw
      .prepare(
        `INSERT INTO books (id, title, subtitle, authors, description, language, publisher,
          published_year, cover_path, format, hash, file_name, file_size, added_at, updated_at, fts_row)
         VALUES (@id, @title, @subtitle, @authors, @description, @language, @publisher,
          @publishedYear, @coverPath, @format, @hash, @fileName, @fileSize, @addedAt, @updatedAt, @fts)`,
      )
      .run({
        ...rec,
        authors: JSON.stringify(rec.authors),
        addedAt: now,
        updatedAt: rec.updatedAt ?? now,
        fts,
      });
    const tagStmt = this.db.raw.prepare(
      'INSERT OR IGNORE INTO tags(book_id, tag) VALUES (?, ?)',
    );
    for (const t of rec.tags) tagStmt.run(rec.id, t);
    this.db.raw
      .prepare(
        'INSERT INTO books_fts(rowid, title, subtitle, authors, description) VALUES (?, ?, ?, ?, ?)',
      )
      .run(fts, rec.title, rec.subtitle ?? '', rec.authors.join(' '), rec.description ?? '');
  }

  removeBook(id: string, deleteFiles: boolean): void {
    const row = this.db.raw.prepare('SELECT fts_row FROM books WHERE id = ?').get(id) as
      | { fts_row: number }
      | undefined;
    if (!row) return;
    this.db.raw.prepare('DELETE FROM books_fts WHERE rowid = ?').run(row.fts_row);
    for (const h of this.db.raw
      .prepare('SELECT fts_row FROM highlights WHERE book_id = ?')
      .all(id) as { fts_row: number }[]) {
      this.db.raw.prepare('DELETE FROM highlights_fts WHERE rowid = ?').run(h.fts_row);
    }
    this.db.raw.prepare('DELETE FROM highlights WHERE book_id = ?').run(id);
    this.db.raw.prepare('DELETE FROM bookmarks WHERE book_id = ?').run(id);
    for (const n of this.db.raw
      .prepare('SELECT fts_row FROM notes WHERE book_id = ?')
      .all(id) as { fts_row: number }[]) {
      this.db.raw.prepare('DELETE FROM notes_fts WHERE rowid = ?').run(n.fts_row);
    }
    this.db.raw.prepare('DELETE FROM notes WHERE book_id = ?').run(id);
    for (const d of this.db.raw
      .prepare('SELECT fts_row FROM desk_docs WHERE book_id = ?')
      .all(id) as { fts_row: number }[]) {
      this.db.raw.prepare('DELETE FROM desk_docs_fts WHERE rowid = ?').run(d.fts_row);
    }
    this.db.raw.prepare('DELETE FROM desk_docs WHERE book_id = ?').run(id);
    this.db.raw.prepare('DELETE FROM progress WHERE book_id = ?').run(id);
    this.db.raw.prepare('DELETE FROM sessions WHERE book_id = ?').run(id);
    this.db.raw.prepare('DELETE FROM tags WHERE book_id = ?').run(id);
    this.db.raw.prepare('DELETE FROM collection_items WHERE book_id = ?').run(id);
    this.db.raw.prepare('DELETE FROM books WHERE id = ?').run(id);
    if (deleteFiles) {
      const dir = this.bookDir(id);
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  }

  /** index-only removal — reconciliation drops rows without touching files */
  removeIndexRow(id: string): void {
    this.removeBook(id, false);
  }

  /** row-level fingerprint update (metadata.json was already written first) */
  updateBookRow(
    id: string,
    patch: { hash: string; fileSize: number; fileName: string; fileMissing?: boolean },
  ): void {
    this.db.raw
      .prepare(
        'UPDATE books SET hash = @hash, file_name = @fileName, file_size = @fileSize, updated_at = @now, file_missing = @fileMissing WHERE id = @id',
      )
      .run({ ...patch, fileMissing: patch.fileMissing ? 1 : 0, now: Date.now(), id });
  }

  /** reconciliation's ORPHANED_DATA flag — row-level, cheap */
  setBookFileMissing(id: string, missing: boolean): void {
    this.db.raw
      .prepare('UPDATE books SET file_missing = ?, updated_at = ? WHERE id = ?')
      .run(missing ? 1 : 0, Date.now(), id);
  }

  /** tags are user-owned truth: metadata.json first, index second (the dual-write law) */
  setBookTags(bookId: string, tags: string[]): void {
    const metaFile = join(this.bookDir(bookId), 'metadata.json');
    try {
      const meta = JSON.parse(readFileSync(metaFile, 'utf-8')) as BookRecord;
      meta.tags = tags;
      meta.updatedAt = Date.now();
      writeFileSyncAtomic(metaFile, JSON.stringify(meta, null, 2));
    } catch {
      /* the folder may be gone (fileMissing) — the index still holds the tags;
         a later reconcile re-syncs truth when the folder returns */
    }
    this.db.raw.prepare('DELETE FROM tags WHERE book_id = ?').run(bookId);
    const tagStmt = this.db.raw.prepare(
      'INSERT OR IGNORE INTO tags(book_id, tag) VALUES (?, ?)',
    );
    for (const t of tags) tagStmt.run(bookId, t);
    this.db.raw
      .prepare('UPDATE books SET updated_at = ? WHERE id = ?')
      .run(Date.now(), bookId);
  }

  /**
   * register a book folder that already exists on disk (truth complete):
   * index the metadata + the truth contents WITHOUT rewriting truth files.
   * live duplicate guard: same content under another id → not registered.
   */
  registerFromTruth(bookDir: string): {
    registered: boolean;
    duplicateOf?: string;
    highlights: number;
    bookmarks: number;
  } {
    let meta: BookRecord;
    try {
      meta = JSON.parse(readFileSync(join(bookDir, 'metadata.json'), 'utf-8')) as BookRecord;
    } catch {
      return { registered: false, highlights: 0, bookmarks: 0 };
    }
    const existing = this.findByHash(meta.hash);
    if (existing && existing !== meta.id) {
      return { registered: false, duplicateOf: existing, highlights: 0, bookmarks: 0 };
    }
    this.indexBook(meta);
    const truth = readTruth(bookDir, meta.id);
    // the folder contract: truth inside {id}/ belongs to {id} — normalize any
    // stale embedded ids (e.g. a folder copied externally under a new name)
    if (truth.progress) this.insertProgressRow({ ...truth.progress, bookId: meta.id });
    for (const h of truth.highlights) this.insertHighlightRow({ ...h, bookId: meta.id });
    for (const b of truth.bookmarks) this.insertBookmarkRow({ ...b, bookId: meta.id });
    for (const n of truth.notes) this.insertNoteRow({ ...n, bookId: meta.id });
    for (const d of truth.deskDocs) this.insertDeskDocRow({ ...d, bookId: meta.id });
    return { registered: true, highlights: truth.highlights.length, bookmarks: truth.bookmarks.length };
  }

  // ---------- progress + sessions ----------

  saveProgress(bookId: string, progress: ReadingProgress): void {
    // truth first
    const truth = readTruth(this.bookDir(bookId), bookId);
    truth.progress = progress;
    writeTruth(this.bookDir(bookId), truth);
    this.insertProgressRow(progress);
  }

  private insertProgressRow(progress: ReadingProgress): void {
    this.db.raw
      .prepare(
        `INSERT INTO progress (book_id, locator, percent, chapter, started_at, last_read_at, completed)
         VALUES (@bookId, @locator, @percent, @chapter, @startedAt, @lastReadAt, @completed)
         ON CONFLICT(book_id) DO UPDATE SET locator = @locator, percent = @percent,
           chapter = @chapter, started_at = @startedAt, last_read_at = @lastReadAt, completed = @completed`,
      )
      .run({ ...progress, completed: progress.completedAt ? 1 : 0 });
  }

  getProgress(bookId: string): ReadingProgress | null {
    const p = this.db.raw.prepare('SELECT * FROM progress WHERE book_id = ?').get(bookId) as
      | Record<string, unknown>
      | undefined;
    if (!p) return null;
    return {
      bookId,
      locator: p.locator as string,
      percent: p.percent as number,
      chapter: (p.chapter as string | null) ?? null,
      startedAt: (p.started_at as number | null) ?? null,
      lastReadAt: p.last_read_at as number,
      completedAt: (p.completed as number) === 1,
    };
  }

  beginSession(bookId: string, startPercent: number): string {
    const id = uuidv7();
    this.db.raw
      .prepare(
        'INSERT INTO sessions (id, book_id, started_at, duration_ms, start_percent) VALUES (?, ?, ?, 0, ?)',
      )
      .run(id, bookId, Date.now(), startPercent);
    return id;
  }

  endSession(sessionId: string, endPercent: number): void {
    const s = this.db.raw.prepare('SELECT started_at FROM sessions WHERE id = ?').get(sessionId) as
      | { started_at: number }
      | undefined;
    if (!s) return;
    this.db.raw
      .prepare(
        'UPDATE sessions SET ended_at = ?, duration_ms = ?, end_percent = ? WHERE id = ?',
      )
      .run(Date.now(), Date.now() - s.started_at, endPercent, sessionId);
  }

  /** the reading life, from finished sessions only — quiet numbers, index-derived */
  sessionStats(): SessionStats {
    const rows = this.db.raw
      .prepare('SELECT book_id, started_at, duration_ms, ended_at FROM sessions')
      .all() as { book_id: string; started_at: number; duration_ms: number; ended_at: number | null }[];
    const finished = rows.filter((r) => r.ended_at !== null);

    const localDay = (ts: number): number => {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const today = localDay(Date.now());
    const DAY = 86_400_000;

    const totalMs = finished.reduce((acc, r) => acc + r.duration_ms, 0);
    const weekMs = finished
      .filter((r) => r.started_at >= today - 6 * DAY)
      .reduce((acc, r) => acc + r.duration_ms, 0);

    // per-day buckets for the last 14 days + the streak walk
    const byDay = new Map<number, number>();
    for (const r of finished) {
      const day = localDay(r.started_at);
      if (day >= today - 13 * DAY) {
        byDay.set(day, (byDay.get(day) ?? 0) + r.duration_ms);
      }
    }
    const days: SessionDayStat[] = [...byDay.entries()]
      .map(([day, ms]) => ({ day, ms }))
      .sort((a, b) => a.day - b.day);

    // the read-days set spans all history (a streak can be older than 14 days)
    const readDays = new Set(finished.map((r) => localDay(r.started_at)));
    let streakDays = 0;
    let cursor = readDays.has(today) ? today : today - DAY;
    while (readDays.has(cursor)) {
      streakDays++;
      cursor -= DAY;
    }

    const byBook = new Map<string, { ms: number; last: number }>();
    for (const r of finished) {
      const b = byBook.get(r.book_id) ?? { ms: 0, last: 0 };
      b.ms += r.duration_ms;
      b.last = Math.max(b.last, r.ended_at ?? r.started_at);
      byBook.set(r.book_id, b);
    }
    const books: BookTimeStat[] = [...byBook.entries()]
      .map(([bookId, { ms, last }]) => {
        const row = this.db.raw
          .prepare('SELECT title FROM books WHERE id = ?')
          .get(bookId) as { title: string } | undefined;
        return { bookId, title: row?.title ?? '(removed book)', ms, lastReadAt: last };
      })
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 6);

    return { totalMs, weekMs, streakDays, sessions: finished.length, days, books };
  }

  // ---------- highlights (the dual-write heart) ----------

  listHighlights(bookId: string): Highlight[] {
    const rows = this.db.raw
      .prepare('SELECT * FROM highlights WHERE book_id = ? ORDER BY created_at DESC')
      .all(bookId) as HighlightRow[];
    return rows.map(rowToHighlight);
  }

  createHighlight(bookId: string, h: Highlight): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    truth.highlights.push(h);
    writeTruth(this.bookDir(bookId), truth); // truth first
    this.insertHighlightRow(h);
  }

  private insertHighlightRow(h: Highlight): void {
    const fts = this.nextSeq('highlight');
    const cols = anchorCols(h.anchor);
    this.db.raw
      .prepare(
        `INSERT INTO highlights (id, book_id, primary_locator, text_exact, text_prefix, text_suffix,
          pos_spine, pos_page, pos_percent, chapter, color, note, status, text, created_at, updated_at, fts_row)
         VALUES (@id, @bookId, @primary_locator, @text_exact, @text_prefix, @text_suffix,
          @pos_spine, @pos_page, @pos_percent, @chapter, @color, @note, @status, @text, @createdAt, @updatedAt, @fts)`,
      )
      .run({ ...h, ...cols, fts });
    this.db.raw
      .prepare('INSERT INTO highlights_fts(rowid, text, note, chapter) VALUES (?, ?, ?, ?)')
      .run(fts, h.text, h.note ?? '', h.chapter ?? '');
  }

  updateHighlight(bookId: string, h: Highlight): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    const i = truth.highlights.findIndex((x) => x.id === h.id);
    if (i !== -1) truth.highlights[i] = h;
    writeTruth(this.bookDir(bookId), truth);
    const existing = this.db.raw
      .prepare('SELECT fts_row FROM highlights WHERE id = ?')
      .get(h.id) as { fts_row: number } | undefined;
    const cols = anchorCols(h.anchor);
    if (existing) {
      this.db.raw.prepare('DELETE FROM highlights_fts WHERE rowid = ?').run(existing.fts_row);
      this.db.raw
        .prepare(
          `UPDATE highlights SET primary_locator = @primary_locator, text_exact = @text_exact,
            text_prefix = @text_prefix, text_suffix = @text_suffix, pos_spine = @pos_spine,
            pos_page = @pos_page, pos_percent = @pos_percent, chapter = @chapter, color = @color,
            note = @note, status = @status, text = @text, updated_at = @updatedAt WHERE id = @id`,
        )
        .run({ ...h, ...cols });
      this.db.raw
        .prepare('INSERT INTO highlights_fts(rowid, text, note, chapter) VALUES (?, ?, ?, ?)')
        .run(existing.fts_row, h.text, h.note ?? '', h.chapter ?? '');
    } else {
      this.createHighlight(bookId, h);
    }
  }

  deleteHighlight(bookId: string, id: string): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    truth.highlights = truth.highlights.filter((h) => h.id !== id);
    writeTruth(this.bookDir(bookId), truth);
    const existing = this.db.raw
      .prepare('SELECT fts_row FROM highlights WHERE id = ?')
      .get(id) as { fts_row: number } | undefined;
    this.db.raw.prepare('DELETE FROM highlights WHERE id = ?').run(id);
    if (existing) this.db.raw.prepare('DELETE FROM highlights_fts WHERE rowid = ?').run(existing.fts_row);
  }

  // ---------- bookmarks ----------

  listBookmarks(bookId: string): Bookmark[] {
    const rows = this.db.raw
      .prepare('SELECT * FROM bookmarks WHERE book_id = ? ORDER BY created_at DESC')
      .all(bookId) as BookmarkRow[];
    return rows.map(rowToBookmark);
  }

  createBookmark(bookId: string, b: Bookmark): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    truth.bookmarks.push(b);
    writeTruth(this.bookDir(bookId), truth);
    this.insertBookmarkRow(b);
  }

  private insertBookmarkRow(b: Bookmark): void {
    const cols = anchorCols(b.anchor);
    this.db.raw
      .prepare(
        `INSERT INTO bookmarks (id, book_id, primary_locator, pos_spine, pos_page, pos_percent,
          label, chapter, created_at) VALUES (@id, @bookId, @primary_locator, @pos_spine, @pos_page,
          @pos_percent, @label, @chapter, @createdAt)`,
      )
      .run({ ...b, ...cols });
  }

  deleteBookmark(bookId: string, id: string): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    truth.bookmarks = truth.bookmarks.filter((b) => b.id !== id);
    writeTruth(this.bookDir(bookId), truth);
    this.db.raw.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  }

  // ---------- the archive ledger (L8's first camera, L11 deepens it) ----------

  /** every mark across every book, joined to its source, newest first.
   *  one query — the archive never pays n+1 for provenance. */
  listArchiveMarks(): ArchiveEntry[] {
    const rows = this.db.raw
      .prepare(
        `SELECT h.id, h.book_id, h.primary_locator, h.text_exact, h.text_prefix, h.text_suffix,
                h.pos_spine, h.pos_page, h.pos_percent, h.chapter, h.color, h.note, h.text,
                h.created_at, h.updated_at,
                b.title AS book_title, b.authors AS book_authors, b.format AS book_format
         FROM highlights h JOIN books b ON b.id = h.book_id
         WHERE b.file_missing = 0 OR b.file_missing IS NULL
         ORDER BY h.updated_at DESC`,
      )
      .all() as Array<HighlightRow & { book_title: string; book_authors: string; book_format: string }>;
    const marks: ArchiveEntry[] = rows.map((r) => ({
      id: r.id,
      kind: 'highlight',
      bookId: r.book_id,
      bookTitle: r.book_title,
      bookAuthors: JSON.parse(r.book_authors || '[]') as string[],
      bookFormat: (r.book_format === 'pdf' ? 'pdf' : 'epub') as 'pdf' | 'epub',
      text: r.text,
      note: r.note,
      color: r.color as HighlightColor,
      chapter: r.chapter,
      anchor: {
        format: (r.book_format === 'pdf' ? 'pdf' : 'epub') as 'pdf' | 'epub',
        primary: r.primary_locator,
        textRange: { exact: r.text_exact, prefix: r.text_prefix, suffix: r.text_suffix },
        position: {
          spineIndex: r.pos_spine ?? undefined,
          page: r.pos_page ?? undefined,
          percent: r.pos_percent ?? undefined,
        },
      },
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    const bookmarkRows = this.db.raw
      .prepare(
        `SELECT k.id, k.book_id, k.primary_locator, k.pos_spine, k.pos_page, k.pos_percent,
                k.label, k.chapter, k.created_at,
                b.title AS book_title, b.authors AS book_authors, b.format AS book_format
         FROM bookmarks k JOIN books b ON b.id = k.book_id
         WHERE b.file_missing = 0 OR b.file_missing IS NULL
         ORDER BY k.created_at DESC`,
      )
      .all() as Array<BookmarkRow & { book_title: string; book_authors: string; book_format: string }>;
    for (const r of bookmarkRows) {
      marks.push({
        id: r.id,
        kind: 'bookmark',
        bookId: r.book_id,
        bookTitle: r.book_title,
        bookAuthors: JSON.parse(r.book_authors || '[]') as string[],
        bookFormat: (r.book_format === 'pdf' ? 'pdf' : 'epub') as 'pdf' | 'epub',
        text: r.label ?? r.chapter ?? 'bookmark',
        note: null,
        color: null,
        chapter: r.chapter,
        anchor: {
          format: (r.book_format === 'pdf' ? 'pdf' : 'epub') as 'pdf' | 'epub',
          primary: r.primary_locator,
          textRange: null,
          position: {
            spineIndex: r.pos_spine ?? undefined,
            page: r.pos_page ?? undefined,
            percent: r.pos_percent ?? undefined,
          },
        },
        createdAt: r.created_at,
        updatedAt: r.created_at,
      });
    }
    marks.sort((a, b) => b.updatedAt - a.updatedAt);
    return marks;
  }

  // ---------- margin notes (thinking attached to a place) ----------

  listNotes(bookId: string): Note[] {
    const rows = this.db.raw
      .prepare('SELECT * FROM notes WHERE book_id = ? ORDER BY created_at DESC')
      .all(bookId) as NoteRow[];
    return rows.map(rowToNote);
  }

  createNote(bookId: string, n: Note): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    truth.notes.push(n);
    writeTruth(this.bookDir(bookId), truth); // truth first
    this.insertNoteRow(n);
  }

  private insertNoteRow(n: Note): void {
    const fts = this.nextSeq('note');
    const cols = anchorCols(n.anchor);
    this.db.raw
      .prepare(
        `INSERT INTO notes (id, book_id, primary_locator, text_exact, text_prefix, text_suffix,
          pos_spine, pos_page, pos_percent, chapter, body, question, created_at, updated_at, fts_row)
         VALUES (@id, @bookId, @primary_locator, @text_exact, @text_prefix, @text_suffix,
          @pos_spine, @pos_page, @pos_percent, @chapter, @body, @question, @createdAt, @updatedAt, @fts)`,
      )
      .run({ ...n, ...cols, question: n.question ? 1 : 0, fts });
    this.db.raw
      .prepare('INSERT INTO notes_fts(rowid, body, chapter) VALUES (?, ?, ?)')
      .run(fts, n.body, n.chapter ?? '');
  }

  updateNote(bookId: string, n: Note): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    const i = truth.notes.findIndex((x) => x.id === n.id);
    if (i !== -1) truth.notes[i] = n;
    writeTruth(this.bookDir(bookId), truth);
    const existing = this.db.raw
      .prepare('SELECT fts_row FROM notes WHERE id = ?')
      .get(n.id) as { fts_row: number } | undefined;
    const cols = anchorCols(n.anchor);
    if (existing) {
      this.db.raw.prepare('DELETE FROM notes_fts WHERE rowid = ?').run(existing.fts_row);
      this.db.raw
        .prepare(
          `UPDATE notes SET primary_locator = @primary_locator, text_exact = @text_exact,
            text_prefix = @text_prefix, text_suffix = @text_suffix, pos_spine = @pos_spine,
            pos_page = @pos_page, pos_percent = @pos_percent, chapter = @chapter, body = @body,
            question = @question, updated_at = @updatedAt WHERE id = @id`,
        )
        .run({ ...n, ...cols, question: n.question ? 1 : 0 });
      this.db.raw
        .prepare('INSERT INTO notes_fts(rowid, body, chapter) VALUES (?, ?, ?)')
        .run(existing.fts_row, n.body, n.chapter ?? '');
    } else {
      this.insertNoteRow(n);
    }
  }

  deleteNote(bookId: string, id: string): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    truth.notes = truth.notes.filter((n) => n.id !== id);
    writeTruth(this.bookDir(bookId), truth);
    const row = this.db.raw.prepare('SELECT fts_row FROM notes WHERE id = ?').get(id) as
      | { fts_row: number }
      | undefined;
    if (row) this.db.raw.prepare('DELETE FROM notes_fts WHERE rowid = ?').run(row.fts_row);
    this.db.raw.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  // ---------- desk documents (L10 — the workbench's papers) ----------

  listDeskDocs(bookId: string): DeskDoc[] {
    const rows = this.db.raw
      .prepare('SELECT * FROM desk_docs WHERE book_id = ? ORDER BY updated_at DESC')
      .all(bookId) as DeskDocRow[];
    return rows.map(rowToDeskDoc);
  }

  createDeskDoc(bookId: string, d: DeskDoc): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    truth.deskDocs.push(d);
    writeTruth(this.bookDir(bookId), truth); // truth first
    this.insertDeskDocRow(d);
  }

  private insertDeskDocRow(d: DeskDoc): void {
    const fts = this.nextSeq('deskdoc');
    this.db.raw
      .prepare(
        `INSERT INTO desk_docs (id, book_id, kind, title, body, source_refs, created_at, updated_at, fts_row)
         VALUES (@id, @bookId, @kind, @title, @body, @sourceRefs, @createdAt, @updatedAt, @fts)`,
      )
      .run({ ...d, sourceRefs: JSON.stringify(d.sourceRefs ?? []), fts });
    this.db.raw
      .prepare('INSERT INTO desk_docs_fts(rowid, title, body) VALUES (?, ?, ?)')
      .run(fts, d.title, d.body);
  }

  updateDeskDoc(bookId: string, d: DeskDoc): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    const i = truth.deskDocs.findIndex((x) => x.id === d.id);
    if (i !== -1) truth.deskDocs[i] = d;
    else truth.deskDocs.push(d);
    writeTruth(this.bookDir(bookId), truth);
    const existing = this.db.raw
      .prepare('SELECT fts_row FROM desk_docs WHERE id = ?')
      .get(d.id) as { fts_row: number } | undefined;
    if (existing) {
      this.db.raw.prepare('DELETE FROM desk_docs_fts WHERE rowid = ?').run(existing.fts_row);
      this.db.raw
        .prepare(
          `UPDATE desk_docs SET kind = @kind, title = @title, body = @body,
            source_refs = @sourceRefs, updated_at = @updatedAt WHERE id = @id`,
        )
        .run({ ...d, sourceRefs: JSON.stringify(d.sourceRefs ?? []) });
      this.db.raw
        .prepare('INSERT INTO desk_docs_fts(rowid, title, body) VALUES (?, ?, ?)')
        .run(existing.fts_row, d.title, d.body);
    } else {
      this.insertDeskDocRow(d);
    }
  }

  deleteDeskDoc(bookId: string, id: string): void {
    const truth = readTruth(this.bookDir(bookId), bookId);
    truth.deskDocs = truth.deskDocs.filter((d) => d.id !== id);
    writeTruth(this.bookDir(bookId), truth);
    const row = this.db.raw.prepare('SELECT fts_row FROM desk_docs WHERE id = ?').get(id) as
      | { fts_row: number }
      | undefined;
    if (row) this.db.raw.prepare('DELETE FROM desk_docs_fts WHERE rowid = ?').run(row.fts_row);
    this.db.raw.prepare('DELETE FROM desk_docs WHERE id = ?').run(id);
  }

  // ---------- collections ----------

  private collectionsFile(): string {
    return join(this.libraryRoot, 'library', 'collections.json');
  }

  private readCollections(): CollectionsTruth {
    const file = this.collectionsFile();
    if (!existsSync(file)) return { version: 1, collections: [], items: [] };
    try {
      return JSON.parse(readFileSync(file, 'utf-8')) as CollectionsTruth;
    } catch {
      return { version: 1, collections: [], items: [] };
    }
  }

  private writeCollections(c: CollectionsTruth): void {
    writeFileSyncAtomic(this.collectionsFile(), JSON.stringify(c, null, 2));
  }

  listCollections(): { collection: Collection; count: number }[] {
    const truth = this.readCollections();
    return truth.collections.map((c) => ({
      collection: c,
      count: truth.items.filter((i) => i.collectionId === c.id).length,
    }));
  }

  listCollectionBooks(collectionId: string): string[] {
    return this.readCollections()
      .items.filter((i) => i.collectionId === collectionId)
      .map((i) => i.bookId);
  }

  createCollection(name: string, description: string | null): Collection {
    const c: Collection = { id: uuidv7(), name, description, createdAt: Date.now() };
    const truth = this.readCollections();
    truth.collections.push(c);
    this.writeCollections(truth);
    this.db.raw
      .prepare('INSERT INTO collections (id, name, description, created_at) VALUES (?, ?, ?, ?)')
      .run(c.id, c.name, c.description, c.createdAt);
    return c;
  }

  /** rename — truth first, index second; a duplicate name throws honestly (UNIQUE) */
  renameCollection(id: string, name: string): void {
    const truth = this.readCollections();
    const c = truth.collections.find((x) => x.id === id);
    if (!c) return;
    c.name = name;
    this.writeCollections(truth);
    this.db.raw.prepare('UPDATE collections SET name = ? WHERE id = ?').run(name, id);
  }

  deleteCollection(id: string): void {
    const truth = this.readCollections();
    truth.collections = truth.collections.filter((c) => c.id !== id);
    truth.items = truth.items.filter((i) => i.collectionId !== id);
    this.writeCollections(truth);
    this.db.raw.prepare('DELETE FROM collections WHERE id = ?').run(id);
    this.db.raw.prepare('DELETE FROM collection_items WHERE collection_id = ?').run(id);
  }

  assignToCollection(collectionId: string, bookId: string): void {
    const truth = this.readCollections();
    if (!truth.items.some((i) => i.collectionId === collectionId && i.bookId === bookId)) {
      truth.items.push({ collectionId, bookId });
      this.writeCollections(truth);
    }
    this.db.raw
      .prepare('INSERT OR IGNORE INTO collection_items(collection_id, book_id) VALUES (?, ?)')
      .run(collectionId, bookId);
  }

  removeFromCollection(collectionId: string, bookId: string): void {
    const truth = this.readCollections();
    truth.items = truth.items.filter(
      (i) => !(i.collectionId === collectionId && i.bookId === bookId),
    );
    this.writeCollections(truth);
    this.db.raw
      .prepare('DELETE FROM collection_items WHERE collection_id = ? AND book_id = ?')
      .run(collectionId, bookId);
  }

  // ---------- search ----------

  search(query: string): SearchHit[] {
    const ftsQ = toFtsPrefixQuery(query);
    if (ftsQ === null) return [];
    const hits: SearchHit[] = [];

    const bookRows = this.db.raw
      .prepare(
        `SELECT rowid FROM books_fts WHERE books_fts MATCH ? ORDER BY rank LIMIT 25`,
      )
      .all(ftsQ) as { rowid: number }[];
    for (const r of bookRows) {
      const b = this.db.raw
        .prepare('SELECT * FROM books WHERE fts_row = ?')
        .get(r.rowid) as BookRow | undefined;
      if (b) {
        const book = rowToBook(b);
        hits.push({
          kind: 'book',
          id: book.id,
          title: book.title,
          context: book.authors.join(', ') || null,
          bookId: book.id,
          locator: null,
          highlightId: null,
        });
      }
    }

    const hlRows = this.db.raw
      .prepare(`SELECT rowid FROM highlights_fts WHERE highlights_fts MATCH ? ORDER BY rank LIMIT 50`)
      .all(ftsQ) as { rowid: number }[];
    for (const r of hlRows) {
      const h = this.db.raw
        .prepare('SELECT * FROM highlights WHERE fts_row = ?')
        .get(r.rowid) as HighlightRow | undefined;
      if (h) {
        hits.push({
          kind: 'highlight',
          id: h.id,
          title: h.text.slice(0, 80),
          context: (h.note ?? h.chapter ?? '').slice(0, 120) || null,
          bookId: h.book_id,
          locator: h.primary_locator,
          highlightId: h.id,
        });
      }
    }

    const noteRows = this.db.raw
      .prepare(`SELECT rowid FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT 50`)
      .all(ftsQ) as { rowid: number }[];
    for (const r of noteRows) {
      const n = this.db.raw
        .prepare('SELECT * FROM notes WHERE fts_row = ?')
        .get(r.rowid) as NoteRow | undefined;
      if (n) {
        hits.push({
          kind: 'note',
          id: n.id,
          title: n.body.slice(0, 80),
          context: n.chapter,
          bookId: n.book_id,
          locator: n.primary_locator,
          highlightId: null,
        });
      }
    }

    const docRows = this.db.raw
      .prepare(`SELECT rowid FROM desk_docs_fts WHERE desk_docs_fts MATCH ? ORDER BY rank LIMIT 50`)
      .all(ftsQ) as { rowid: number }[];
    for (const r of docRows) {
      const d = this.db.raw
        .prepare('SELECT * FROM desk_docs WHERE fts_row = ?')
        .get(r.rowid) as DeskDocRow | undefined;
      if (d) {
        hits.push({
          kind: 'deskdoc',
          id: d.id,
          title: (d.title || d.body).slice(0, 80),
          context: d.body.slice(0, 120) || null,
          bookId: d.book_id,
          locator: null,
          highlightId: null,
        });
      }
    }

    for (const { collection } of this.listCollections()) {
      if (collection.name.toLowerCase().includes(query.trim().toLowerCase())) {
        hits.push({
          kind: 'collection',
          id: collection.id,
          title: collection.name,
          context: 'collection',
          bookId: null,
          locator: null,
          highlightId: null,
        });
      }
    }
    return hits;
  }

  // ---------- export ----------

  exportNotes(bookId: string): string | null {
    const book = this.getBook(bookId);
    if (!book) return null;
    const highlights = this.listHighlights(bookId);
    const bookmarks = this.listBookmarks(bookId);
    const notes = this.listNotes(bookId);
    return exportReadingNotes(book, highlights, bookmarks, book.progress, notes);
  }

  // ---------- the portability law ----------

  /**
   * delete the index → rescan the truth → zero loss.
   * duplicate-safe: folders with the same content hash register oldest-first;
   * the loser is suppressed (marker in metadata.json), never a crash, never
   * data loss — the annotations of a suppressed folder stay in its folder.
   */
  rebuildIndex(): { books: number; highlights: number; bookmarks: number; suppressed: number } {
    this.db.raw.exec('DELETE FROM books');
    this.db.raw.exec('DELETE FROM tags');
    this.db.raw.exec('DELETE FROM progress');
    this.db.raw.exec('DELETE FROM highlights');
    this.db.raw.exec('DELETE FROM bookmarks');
    this.db.raw.exec('DELETE FROM notes');
    this.db.raw.exec('DELETE FROM desk_docs');
    this.db.raw.exec('DELETE FROM sessions');
    this.db.raw.exec('DELETE FROM collections');
    this.db.raw.exec('DELETE FROM collection_items');
    this.db.raw.exec('DELETE FROM books_fts');
    this.db.raw.exec('DELETE FROM highlights_fts');
    this.db.raw.exec('DELETE FROM notes_fts');
    this.db.raw.exec('DELETE FROM desk_docs_fts');
    this.db.raw.exec('DELETE FROM fts_seq');
    this.db.raw.exec(
      "INSERT INTO fts_seq(name, next) VALUES ('book', 1), ('highlight', 1), ('note', 1), ('deskdoc', 1)",
    );

    let books = 0;
    let highlights = 0;
    let bookmarks = 0;
    let suppressed = 0;
    const libDir = this.booksDir();
    if (existsSync(libDir)) {
      // deterministic order: oldest addedAt first, ties by id
      const metas: BookRecord[] = [];
      for (const entry of readdirSync(libDir)) {
        const dir = join(libDir, entry);
        try {
          if (!statSync(dir).isDirectory()) continue;
          const metaFile = join(dir, 'metadata.json');
          if (!existsSync(metaFile)) continue;
          metas.push(JSON.parse(readFileSync(metaFile, 'utf-8')) as BookRecord);
        } catch {
          continue; // unreadable folder: reconciliation reports it as CORRUPT
        }
      }
      metas.sort(
        (a, b) => (a.addedAt ?? Infinity) - (b.addedAt ?? Infinity) || (a.id < b.id ? -1 : 1),
      );
      for (const meta of metas) {
        const result = this.registerFromTruth(this.bookDir(meta.id));
        if (result.registered) {
          books += 1;
          highlights += result.highlights;
          bookmarks += result.bookmarks;
        } else if (result.duplicateOf) {
          suppressed += 1;
          try {
            const fresh = JSON.parse(
              readFileSync(join(this.bookDir(meta.id), 'metadata.json'), 'utf-8'),
            ) as BookRecord;
            fresh.duplicateOf = result.duplicateOf;
            writeFileSyncAtomic(
              join(this.bookDir(meta.id), 'metadata.json'),
              JSON.stringify(fresh, null, 2),
            );
          } catch {
            /* marker is best-effort; rebuild stays deterministic either way */
          }
        }
      }
    }
    return { books, highlights, bookmarks, suppressed };
  }

  close(): void {
    this.db.close();
  }
}

export { openDb, openMemoryDb, readTruth, writeTruth };

/** settings: ~/Arivo/config/settings.json — plain truth, no index needed */
export function readSettings(configDir: string, defaults: Record<string, unknown>): Record<string, unknown> {
  const file = join(configDir, 'settings.json');
  if (!existsSync(file)) return { ...defaults };
  try {
    return { ...defaults, ...(JSON.parse(readFileSync(file, 'utf-8')) as object) };
  } catch {
    return { ...defaults };
  }
}

export function writeSettings(configDir: string, settings: Record<string, unknown>): void {
  mkdirSync(configDir, { recursive: true });
  writeFileSyncAtomic(join(configDir, 'settings.json'), JSON.stringify(settings, null, 2));
}
