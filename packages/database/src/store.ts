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
  Highlight,
  Bookmark,
  ReadingProgress,
  Collection,
  SearchHit,
  Anchor,
  HighlightColor,
  ResolutionStatus,
} from '@arivo/core';
import { uuidv7, exportReadingNotes } from '@arivo/core';
import { writeFileSyncAtomic } from '@arivo/persistence';
import { openDb, openMemoryDb, type Db } from './db.ts';
import { readTruth, writeTruth } from './truth.ts';

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
  updateBookRow(id: string, patch: { hash: string; fileSize: number; fileName: string }): void {
    this.db.raw
      .prepare(
        'UPDATE books SET hash = @hash, file_name = @fileName, file_size = @fileSize, updated_at = @now WHERE id = @id',
      )
      .run({ ...patch, now: Date.now(), id });
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
    const q = query.trim();
    if (q.length < 2) return [];
    const ftsQ = `${q}*`; // prefix search
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

    for (const { collection } of this.listCollections()) {
      if (collection.name.toLowerCase().includes(q.toLowerCase())) {
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
    return exportReadingNotes(book, highlights, bookmarks, book.progress);
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
    this.db.raw.exec('DELETE FROM sessions');
    this.db.raw.exec('DELETE FROM collections');
    this.db.raw.exec('DELETE FROM collection_items');
    this.db.raw.exec('DELETE FROM books_fts');
    this.db.raw.exec('DELETE FROM highlights_fts');
    this.db.raw.exec('DELETE FROM fts_seq');
    this.db.raw.exec(
      "INSERT INTO fts_seq(name, next) VALUES ('book', 1), ('highlight', 1)",
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
