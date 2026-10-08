/**
 * L10 — the desk's storage law: workbench documents follow the house
 * contract. truth file first (annotations.json), sqlite index second,
 * portability survives index death, provenance (source refs) round-trips,
 * and a v3 database migrates forward without guessing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { ArivoStore } from './store.ts';
import { openDb } from './db.ts';
import { migration001 } from './migrations/001_initial.ts';
import { migration002 } from './migrations/002_fks_and_state.ts';
import { migration003 } from './migrations/003_notes.ts';
import { uuidv7, type DeskDoc, type Note } from '@arivo/core';

let root: string;
let dbPath: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'arivo-l10-'));
  dbPath = join(root, 'index.db');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

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
  writeFileSync(
    join(dir, 'annotations.json'),
    JSON.stringify({ version: 1, id, highlights: [], bookmarks: [], progress: null }),
  );
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
    addedAt: 1,
    updatedAt: 1,
  });
  return id;
}

const mkDoc = (id: string, kind: DeskDoc['kind'], title: string, body: string): DeskDoc => ({
  id,
  bookId: 'x',
  kind,
  title,
  body,
  sourceRefs: [
    {
      quote: 'the palace of exhaustion',
      locator: 'epubcfi(/6/4!/x-quotes)',
      chapter: 'Prologue',
      highlightId: null,
      noteId: null,
    },
  ],
  createdAt: 100,
  updatedAt: 100,
});

describe('desk documents (L10 — the workbench storage law)', () => {
  it('create → listDeskDocs reads it back; annotations.json carries it (truth first)', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Worked Book');
    const d = { ...mkDoc('doc-1', 'research', 'burnout quotes', 'gathering the argument'), bookId: id };
    store.createDeskDoc(id, d);
    const listed = store.listDeskDocs(id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.kind).toBe('research');
    expect(listed[0]?.title).toBe('burnout quotes');
    // provenance round-trips — the quote + its place stay attached
    expect(listed[0]?.sourceRefs[0]?.locator).toBe('epubcfi(/6/4!/x-quotes)');
    const truth = JSON.parse(readFileSync(join(root, 'library', id, 'annotations.json'), 'utf-8')) as {
      deskDocs: { id: string }[];
    };
    expect(truth.deskDocs.map((x) => x.id)).toContain('doc-1');
  });

  it('update + delete flow through both stores', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Edited Desk');
    const d = { ...mkDoc('doc-2', 'reflect', 'reflection', 'first'), bookId: id };
    store.createDeskDoc(id, d);
    store.updateDeskDoc(id, { ...d, body: 'second', updatedAt: 200 });
    expect(store.listDeskDocs(id)[0]?.body).toBe('second');
    // an update for an unknown id inserts honestly (the renderer's
    // optimistic doc may outrun the create)
    store.updateDeskDoc(id, { ...mkDoc('doc-2b', 'make', 'artifact', 'composed'), bookId: id });
    expect(store.listDeskDocs(id).some((x) => x.id === 'doc-2b')).toBe(true);
    store.deleteDeskDoc(id, 'doc-2');
    store.deleteDeskDoc(id, 'doc-2b');
    expect(store.listDeskDocs(id)).toHaveLength(0);
    const truth = JSON.parse(readFileSync(join(root, 'library', id, 'annotations.json'), 'utf-8')) as {
      deskDocs: unknown[];
    };
    expect(truth.deskDocs).toHaveLength(0);
  });

  it('desk documents survive index death and are found by search (the full law)', () => {
    const db = openDb(dbPath);
    const store = new ArivoStore(db, root);
    const id = seedBook(store, uuidv7(), 'Immortal Desk');
    store.createDeskDoc(id, {
      ...mkDoc('doc-3', 'research', 'a very specific collection', 'searchable body'),
      bookId: id,
    });
    expect(store.search('specific').some((h) => h.kind === 'deskdoc' && h.id === 'doc-3')).toBe(true);
    db.raw.exec('DELETE FROM desk_docs');
    db.raw.exec('DELETE FROM books');
    db.raw.exec('DELETE FROM books_fts');
    db.raw.exec("UPDATE fts_seq SET next = 1 WHERE name = 'book'");
    store.rebuildIndex();
    const revived = store.listDeskDocs(id);
    expect(revived).toHaveLength(1);
    expect(revived[0]?.title).toBe('a very specific collection');
    expect(store.search('specific').some((h) => h.kind === 'deskdoc' && h.id === 'doc-3')).toBe(true);
  });

  it('removing the book cascades desk docs with it', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Leaving Desk');
    store.createDeskDoc(id, { ...mkDoc('doc-4', 'make', 'gone with the book', 'x'), bookId: id });
    store.removeBook(id, false);
    expect(store.listDeskDocs(id)).toHaveLength(0);
  });

  it('old truth files without deskDocs still parse (tolerant read)', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Old Shape Desk');
    // seedBook writes the v3 shape (no deskDocs key) — read + write must not crash
    const before = store.listDeskDocs(id);
    expect(before).toHaveLength(0);
    store.createDeskDoc(id, { ...mkDoc('doc-5', 'reflect', 'late arrival', 'x'), bookId: id });
    expect(store.listDeskDocs(id)).toHaveLength(1);
  });

  it('the question flag on margin notes round-trips', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const id = seedBook(store, uuidv7(), 'Asking Book');
    const n: Note = {
      id: 'q-1',
      bookId: id,
      anchor: { format: 'epub', primary: 'epubcfi(/6/4!/x-q)', textRange: null, position: { percent: 0.5 } },
      body: 'what does he mean by achievement here?',
      chapter: null,
      question: true,
      createdAt: 100,
      updatedAt: 100,
    };
    store.createNote(id, n);
    const back = store.listNotes(id)[0];
    expect(back?.question).toBe(true);
    // a plain note stays plain — undefined, not false
    store.createNote(id, { ...n, id: 'q-2', question: undefined, body: 'a statement' });
    expect(store.listNotes(id).find((x) => x.id === 'q-2')?.question).toBeUndefined();
  });
});

describe('migration 004 (v3 → v4, the desk)', () => {
  it('a real v3 database upgrades in place and takes desk writes + question notes', () => {
    const v3Path = join(root, 'v3-index.db');
    const raw = new Database(v3Path);
    raw.pragma('journal_mode = WAL');
    raw.pragma('foreign_keys = ON');
    // build exactly a schema-3 database: 001, 002, 003 applied in order
    for (const m of [migration001, migration002, migration003]) {
      raw.pragma('foreign_keys = OFF');
      const run = raw.transaction(() => {
        m.up(raw);
        raw
          .prepare(
            "INSERT INTO meta(key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          )
          .run(String(m.version));
      });
      run();
      raw.pragma('foreign_keys = ON');
    }
    raw.close();

    // open through the house door: migration 004 runs, validate passes
    const db = openDb(v3Path);
    expect(db.raw.prepare("SELECT value FROM meta WHERE key='schema_version'").get()).toEqual({
      value: '4',
    });
    // the notes table learned the question column with a default
    const cols = db.raw.prepare('PRAGMA table_info(notes)').all() as { name: string; dflt_value: string }[];
    const q = cols.find((c) => c.name === 'question');
    expect(q?.dflt_value).toBe('0');

    // the store works against the migrated database
    const store = new ArivoStore(db, root);
    const id = seedBook(store, uuidv7(), 'Migrated Desk');
    store.createDeskDoc(id, { ...mkDoc('doc-m', 'reflect', 'after migration', 'still here'), bookId: id });
    const listed = store.listDeskDocs(id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.title).toBe('after migration');
    db.close();
  });
});
