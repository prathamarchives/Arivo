/**
 * WAVE 1's HONEST COMPLETION — the store surfaces that were missing:
 * tags (user-owned, dual-write), collection rename, and the reading
 * life (session stats). each proof follows the house style: mutate →
 * both stores agree → kill the index → rebuild → truth survives.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArivoStore } from './store.ts';
import { openDb, openMemoryDb } from './db.ts';
import { uuidv7, type Note } from '@arivo/core';

let root: string;
let dbPath: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'arivo-wave1-'));
  dbPath = join(root, 'index.db');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** a book folder on disk (the folder contract), registered via indexBook */
function seedBook(store: ArivoStore, id: string, title: string): string {
  const dir = join(root, 'library', id);
  mkdirSync(dir, { recursive: true });
  const hash = createHash('sha256').update(`${id}:${title}`).digest('hex');
  writeFileSync(
    join(dir, 'metadata.json'),
    JSON.stringify(
      {
        id,
        title,
        subtitle: null,
        authors: ['An Author'],
        description: null,
        language: 'en',
        publisher: null,
        publishedYear: null,
        coverPath: null,
        format: 'epub',
        hash,
        fileName: `${title}.epub`,
        fileSize: 1000,
        tags: [],
        addedAt: Date.now(),
        updatedAt: Date.now(),
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, 'annotations.json'), JSON.stringify({ version: 1, id, highlights: [], bookmarks: [], progress: null }));
  store.indexBook({
    id,
    title,
    subtitle: null,
    authors: ['An Author'],
    description: null,
    language: 'en',
    publisher: null,
    publishedYear: null,
    coverPath: null,
    format: 'epub',
    hash,
    fileName: `${title}.epub`,
    fileSize: 1000,
    tags: [],
    addedAt: Date.now(),
    updatedAt: Date.now(),
  });
  return id;
}

describe('tags get a face (the dead organ lives)', () => {
  it('setBookTags writes truth first, index second — listBooks agrees', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Tagged Book');
    store.setBookTags(id, ['philosophy', 'to-reread']);
    const listed = store.listBooks().find((b) => b.id === id);
    expect(listed?.tags).toEqual(['philosophy', 'to-reread']);
    // truth: metadata.json carries the tags (the portability law)
    const meta = JSON.parse(readFileSync(join(root, 'library', id, 'metadata.json'), 'utf-8')) as {
      tags: string[];
    };
    expect(meta.tags).toEqual(['philosophy', 'to-reread']);
  });

  it('clearing tags is honest: both stores agree on empty', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Untagged Book');
    store.setBookTags(id, ['temp']);
    store.setBookTags(id, []);
    const listed = store.listBooks().find((b) => b.id === id);
    expect(listed?.tags).toEqual([]);
  });

  it('tags survive index death (rebuild from truth)', () => {
    const db = openDb(dbPath);
    const store = new ArivoStore(db, root);
    const id = seedBook(store, uuidv7(), 'Immortal Tags');
    store.setBookTags(id, ['survivor']);
    db.raw.exec('DELETE FROM tags');
    db.raw.exec('DELETE FROM books');
    db.raw.exec('DELETE FROM books_fts');
    db.raw.exec("UPDATE fts_seq SET next = 1 WHERE name = 'book'");
    store.rebuildIndex();
    const listed = store.listBooks().find((b) => b.id === id);
    expect(listed?.tags).toEqual(['survivor']);
  });
});

describe('collections can be renamed (management is whole)', () => {
  it('rename — truth (collections.json) and index agree', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const c = store.createCollection('old name', null);
    store.renameCollection(c.id, 'new name');
    const listed = store.listCollections().find((x) => x.collection.id === c.id);
    expect(listed?.collection.name).toBe('new name');
    const truth = JSON.parse(
      readFileSync(join(root, 'library', 'collections.json'), 'utf-8'),
    ) as {
      collections: { id: string; name: string }[];
    };
    expect(truth.collections.find((x) => x.id === c.id)?.name).toBe('new name');
  });

  it('rename is honest about duplicates: the UNIQUE constraint surfaces as an error', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const a = store.createCollection('first-' + uuidv7(), null);
    store.createCollection('taken', null);
    expect(() => store.renameCollection(a.id, 'taken')).toThrow();
  });
});

describe('margin notes (thinking attached to a place, D17)', () => {
  const mkNote = (id: string, body: string): Note => ({
    id,
    bookId: 'shared',
    anchor: {
      format: 'epub',
      primary: `epubcfi(/6/4!/x-${id})`,
      textRange: null,
      position: { spineIndex: 2, percent: 0.4 },
    },
    body,
    chapter: 'Chapter Two',
    createdAt: 100,
    updatedAt: 100,
  });

  it('create → listNotes reads it back; annotations.json carries it (truth first)', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Noted Book');
    const n = { ...mkNote('n-1', 'the achievement subject turns itself into itself'), bookId: id };
    store.createNote(id, n);
    expect(store.listNotes(id)).toHaveLength(1);
    expect(store.listNotes(id)[0]?.body).toBe(n.body);
    const truth = JSON.parse(readFileSync(join(root, 'library', id, 'annotations.json'), 'utf-8')) as {
      notes: { id: string }[];
    };
    expect(truth.notes.map((x) => x.id)).toContain('n-1');
  });

  it('update + delete flow through both stores', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Edited Notes');
    const n = { ...mkNote('n-2', 'first thought'), bookId: id };
    store.createNote(id, n);
    store.updateNote(id, { ...n, body: 'second thought', updatedAt: 200 });
    expect(store.listNotes(id)[0]?.body).toBe('second thought');
    store.deleteNote(id, 'n-2');
    expect(store.listNotes(id)).toHaveLength(0);
    const truth = JSON.parse(readFileSync(join(root, 'library', id, 'annotations.json'), 'utf-8')) as {
      notes: unknown[];
    };
    expect(truth.notes).toHaveLength(0);
  });

  it('notes survive index death and are found by search (the full law)', () => {
    const db = openDb(dbPath);
    const store = new ArivoStore(db, root);
    const id = seedBook(store, uuidv7(), 'Immortal Notes');
    store.createNote(id, { ...mkNote('n-3', 'a very specific searchable thought'), bookId: id });
    // search finds it while the index lives
    const live = store.search('specific');
    expect(live.some((h) => h.kind === 'note' && h.id === 'n-3')).toBe(true);
    // kill everything, rebuild from truth
    db.raw.exec('DELETE FROM notes');
    db.raw.exec('DELETE FROM books');
    db.raw.exec('DELETE FROM books_fts');
    db.raw.exec("UPDATE fts_seq SET next = 1 WHERE name = 'book'");
    store.rebuildIndex();
    const revived = store.listNotes(id);
    expect(revived).toHaveLength(1);
    expect(revived[0]?.body).toBe('a very specific searchable thought');
    expect(store.search('specific').some((h) => h.kind === 'note' && h.id === 'n-3')).toBe(true);
  });

  it('old truth files without notes still parse (tolerant read)', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Old Truth Shape');
    // rewrite annotations.json in the pre-003 shape: no notes key
    writeFileSync(
      join(root, 'library', id, 'annotations.json'),
      JSON.stringify({ version: 1, id, progress: null, highlights: [], bookmarks: [] }),
    );
    expect(store.listNotes(id)).toHaveLength(0);
    // and a fresh write adds the key
    store.createNote(id, { ...mkNote('n-4', 'backfill'), bookId: id });
    const truth = JSON.parse(readFileSync(join(root, 'library', id, 'annotations.json'), 'utf-8')) as {
      notes: unknown[];
    };
    expect(truth.notes).toHaveLength(1);
  });

  it('export includes the notes section', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Exported Notes');
    store.createNote(id, { ...mkNote('n-5', 'this thought exports'), bookId: id });
    const md = store.exportNotes(id);
    expect(md).toContain('## notes');
    expect(md).toContain('this thought exports');
  });
});

describe('the reading life (sessions become visible, quietly)', () => {
  it('stats: total, week, streak, days, and where the time went', () => {
    const db = openDb(dbPath);
    const store = new ArivoStore(db, root);
    const id = seedBook(store, uuidv7(), 'Read Deeply');

    const DAY = 86_400_000;
    const dayAt = (n: number, h = 20): number => {
      const d = new Date(Date.now() - n * DAY);
      d.setHours(h, 0, 0, 0);
      return d.getTime();
    };
    // a 3-day streak ending today: 20min, 30min, 25min; plus one old 2h session
    const rows: [string, number, number][] = [
      [id, dayAt(0), 20 * 60_000],
      [id, dayAt(1), 30 * 60_000],
      [id, dayAt(2), 25 * 60_000],
      [id, dayAt(30), 2 * 3_600_000],
      // an unfinished session (app killed) — must not count
      [id, dayAt(0, 9), 0],
    ];
    const insert = db.raw.prepare(
      'INSERT INTO sessions (id, book_id, started_at, ended_at, duration_ms, start_percent, end_percent) VALUES (?, ?, ?, ?, ?, 0, 0.5)',
    );
    for (const [bookId, started, dur] of rows) {
      insert.run(uuidv7(), bookId, started, dur > 0 ? started + dur : null, dur);
    }

    const stats = store.sessionStats();
    expect(stats.sessions).toBe(4); // the unfinished one is excluded
    expect(stats.totalMs).toBe(20 * 60_000 + 30 * 60_000 + 25 * 60_000 + 2 * 3_600_000);
    expect(stats.weekMs).toBe(20 * 60_000 + 30 * 60_000 + 25 * 60_000);
    expect(stats.streakDays).toBe(3);
    expect(stats.days.length).toBeGreaterThanOrEqual(3); // last 14 days, sparse
    expect(stats.books[0]?.bookId).toBe(id);
    expect(stats.books[0]?.title).toBe('Read Deeply');
  });

  it('empty library: zeros, no streak, no lies', () => {
    // isolated: a fresh memory index + a fresh root — the shared db carries
    // the previous blocks' sessions by design
    const emptyRoot = mkdtempSync(join(tmpdir(), 'arivo-wave1-empty-'));
    try {
      const store = new ArivoStore(openMemoryDb(), emptyRoot);
      const stats = store.sessionStats();
      expect(stats.totalMs).toBe(0);
      expect(stats.weekMs).toBe(0);
      expect(stats.streakDays).toBe(0);
      expect(stats.sessions).toBe(0);
      expect(stats.days).toEqual([]);
      expect(stats.books).toEqual([]);
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
