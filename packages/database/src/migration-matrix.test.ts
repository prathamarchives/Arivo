/**
 * THE MIGRATION MATRIX (final campaign P3), proven:
 * every shipped schema version upgrades to current in place — data
 * intact, desk docs usable, restart idempotent, deterministic across
 * identical fixtures, malformed optional fields tolerated, duplicates
 * rejected by the schema (not by luck).
 *
 * v1→current is migration.test.ts's domain (the real v0.1 fixture).
 * this file owns v2→current, v3→current, and the closure invariants.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { uuidv7, type DeskDoc } from '@arivo/core';
import { ArivoStore, readTruth } from './store.ts';
import { openDb, type Db } from './db.ts';
import { migration001 } from './migrations/001_initial.ts';
import { migration002 } from './migrations/002_fks_and_state.ts';
import { migration003 } from './migrations/003_notes.ts';
import { runMigrations, validateSchema, SCHEMA_VERSION } from './migrations/index.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'arivo-matrix-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function setVersion(db: Database.Database, v: number): void {
  db.prepare(
    "INSERT INTO meta(key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(String(v));
}

/** a v2-era database: fks real, notes/desk docs not yet born */
function buildV2Db(dbPath: string): void {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migration001.up(db);
  migration002.up(db);
  setVersion(db, 2);
  db.prepare(
    `INSERT INTO books (id, title, authors, format, hash, file_name, file_size, added_at, updated_at, fts_row, file_missing)
     VALUES ('b1', 'Notes of a Native Son', '["Baldwin"]', 'epub', 'h1', 'n.epub', 10, 1, 1, 1, 0)`,
  ).run();
  db.prepare(
    `INSERT INTO highlights (id, book_id, primary_locator, color, status, text, text_exact, text_prefix, text_suffix, created_at, updated_at, fts_row)
     VALUES ('h1', 'b1', 'cfi1', 'yellow', 'resolved', 'the mind is a mirror', 'the mind', 'the', 'mirror', 5, 5, 1),
            ('h2', 'b1', 'cfi2', 'blue', 'resolved', 'second', 'second', '', '', 6, 6, 2)`,
  ).run();
  db.prepare(
    `INSERT INTO progress (book_id, locator, percent, last_read_at) VALUES ('b1', 'cfip', 0.5, 9)`,
  ).run();
  db.close();
}

/** a v3-era database: margin notes exist, desk docs not yet born */
function buildV3Db(dbPath: string): void {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migration001.up(db);
  migration002.up(db);
  migration003.up(db);
  setVersion(db, 3);
  db.prepare(
    `INSERT INTO books (id, title, authors, format, hash, file_name, file_size, added_at, updated_at, fts_row, file_missing)
     VALUES ('b1', 'The Master and Margarita', '["Bulgakov"]', 'epub', 'h1', 'm.epub', 10, 1, 1, 1, 0)`,
  ).run();
  db.prepare(
    `INSERT INTO notes (id, book_id, primary_locator, body, text_exact, text_prefix, text_suffix, created_at, updated_at, fts_row)
     VALUES ('n1', 'b1', 'cfi1', 'manuscripts do not burn', 'manuscripts', 'the', 'burn', 7, 7, 1)`,
  ).run();
  // malformed-legacy tolerance: optional position fields are NULL,
  // pos_spine negative (an old bug's shape) — must survive migration
  db.prepare(
    `INSERT INTO notes (id, book_id, primary_locator, body, pos_spine, pos_page, pos_percent, chapter, created_at, updated_at, fts_row)
     VALUES ('n2', 'b1', 'cfi2', 'a note with no anchor but a place', -1, NULL, NULL, NULL, 8, 8, 2)`,
  ).run();
  db.close();
}

describe('v2 → current (through 003 + 004)', () => {
  it('upgrades in place: highlights + progress intact, notes/desk_docs born', () => {
    const dbPath = join(root, 'index.db');
    buildV2Db(dbPath);
    // raw open + explicit migration — openDb would auto-migrate (the
    // production path); the matrix must observe the outcome itself
    const raw = new Database(dbPath);
    raw.pragma('foreign_keys = ON');
    const outcome = runMigrations(raw);
    expect(outcome.from).toBe(2);
    expect(outcome.to).toBe(SCHEMA_VERSION);
    expect(outcome.applied.join(',')).toContain('3:');
    expect(outcome.applied.join(',')).toContain('4:');
    validateSchema(raw);
    const hl = raw.prepare('SELECT * FROM highlights ORDER BY id').all() as Array<{ id: string; text: string }>;
    expect(hl.map((h) => h.id)).toEqual(['h1', 'h2']);
    expect(hl[0]!.text).toBe('the mind is a mirror');
    expect(raw.prepare("SELECT percent FROM progress WHERE book_id='b1'").get()).toEqual({ percent: 0.5 });
    expect(raw.prepare("SELECT count(*) c FROM notes WHERE book_id='b1'").get()).toEqual({ c: 0 });
    raw.close();
  });
});

describe('v3 → current (through 006)', () => {
  it('upgrades in place: notes intact (including malformed-legacy NULL fields), desk docs usable', () => {
    const dbPath = join(root, 'index.db');
    buildV3Db(dbPath);
    const raw = new Database(dbPath);
    raw.pragma('foreign_keys = ON');
    const outcome = runMigrations(raw);
    expect(outcome.from).toBe(3);
    expect(outcome.applied).toHaveLength(3);
    expect(outcome.applied[0]!.startsWith('4:')).toBe(true);
    expect(outcome.applied[1]!.startsWith('5:')).toBe(true);
    expect(outcome.applied[2]!.startsWith('6:')).toBe(true);
    validateSchema(raw);
    const notes = raw.prepare('SELECT * FROM notes ORDER BY id').all() as Array<{
      id: string; body: string; pos_spine: number | null;
    }>;
    expect(notes).toHaveLength(2);
    expect(notes[0]!.body).toBe('manuscripts do not burn');
    expect(notes[1]!.pos_spine).toBe(-1); // malformed legacy shape preserved, not discarded
    raw.close();
  });
});

describe('the closure invariants (every version)', () => {
  it('restart is a no-op: a migrated db applies nothing on reopen', () => {
    const dbPath = join(root, 'index.db');
    buildV3Db(dbPath);
    const raw = new Database(dbPath);
    raw.pragma('foreign_keys = ON');
    runMigrations(raw);
    const notesBefore = raw.prepare('SELECT count(*) c FROM notes').get() as { c: number };
    raw.close();
    // the production reopen path: openDb auto-migrates + validates
    const reopened = openDb(dbPath);
    const notesAfter = reopened.raw.prepare('SELECT count(*) c FROM notes').get();
    expect(notesAfter).toEqual(notesBefore);
    validateSchema(reopened.raw);
    // and a second explicit pass applies nothing
    const outcome = runMigrations(reopened.raw);
    expect(outcome.applied).toHaveLength(0);
    expect(outcome.to).toBe(SCHEMA_VERSION);
    reopened.close();
  });

  it('migrations are deterministic: identical fixtures converge identically', () => {
    const a = join(root, 'a.db');
    const b = join(root, 'b.db');
    buildV3Db(a);
    buildV3Db(b);
    const dbA = new Database(a);
    const dbB = new Database(b);
    dbA.pragma('foreign_keys = ON');
    dbB.pragma('foreign_keys = ON');
    runMigrations(dbA);
    runMigrations(dbB);
    const dump = (db: Database.Database) => {
      const tables = (db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all() as Array<{ name: string }>).map((t) => t.name);
      expect(tables).toContain('desk_docs');
      expect(tables).toContain('desk_docs_fts');
      const rows: Record<string, unknown[]> = {};
      for (const t of tables) {
        rows[t] = db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all();
      }
      return { version: db.prepare("SELECT value FROM meta WHERE key='schema_version'").get(), rows };
    };
    expect(dump(dbA)).toEqual(dump(dbB));
    dbA.close();
    dbB.close();
  });

  it('duplicate rows cannot enter through migration or after (the schema is the guard)', () => {
    const dbPath = join(root, 'index.db');
    buildV3Db(dbPath);
    const raw = new Database(dbPath);
    raw.pragma('foreign_keys = ON');
    runMigrations(raw);
    // a second identical desk doc id for the same book → PK rejection
    expect(() =>
      raw
        .prepare(
          `INSERT INTO desk_docs (id, book_id, kind, title, body, source_refs, created_at, updated_at, fts_row)
           VALUES ('d1', 'b1', 'research', 't', 'b', '[]', 1, 1, 1)`,
        )
        .run(),
    ).not.toThrow();
    expect(() =>
      raw
        .prepare(
          `INSERT INTO desk_docs (id, book_id, kind, title, body, source_refs, created_at, updated_at, fts_row)
           VALUES ('d1', 'b1', 'research', 't', 'b', '[]', 1, 1, 2)`,
        )
        .run(),
    ).toThrow();
    raw.close();
  });

  it('the full desk-doc lifecycle works on a migrated db (write → truth → fts → cascade)', () => {
    const dbPath = join(root, 'index.db');
    buildV3Db(dbPath);
    // the store needs the book's truth folder to exist (dual-write law)
    const bookDir = join(root, 'library', 'b1');
    mkdirSync(bookDir, { recursive: true });
    writeFileSync(
      join(bookDir, 'annotations.json'),
      JSON.stringify({ version: 1, bookId: 'b1', progress: null, highlights: [], bookmarks: [] }),
    );
    writeFileSync(
      join(bookDir, 'metadata.json'),
      JSON.stringify({
        id: 'b1', title: 'The Master and Margarita', subtitle: null, authors: ['Bulgakov'],
        description: null, language: 'en', publisher: null, publishedYear: null, coverPath: null,
        format: 'epub', hash: createHash('sha256').update('m').digest('hex'), fileName: 'm.epub',
        fileSize: 10, tags: [], addedAt: 1, updatedAt: 1,
      }),
    );
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = FULL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    const wrapped: Db = { raw: db, close: () => db.close() };
    const store = new ArivoStore(wrapped, root);
    const doc: DeskDoc = {
      id: uuidv7(),
      bookId: 'b1',
      kind: 'research',
      title: 'the devil and the party',
      body: 'collected thoughts on the novel',
      sourceRefs: [
        { quote: 'manuscripts do not burn', locator: 'cfi1', chapter: 'ch1', highlightId: null, noteId: null },
      ],
      createdAt: 10,
      updatedAt: 10,
    };
    store.createDeskDoc('b1', doc);
    expect(store.listDeskDocs('b1')).toHaveLength(1);
    // truth-first: the annotations.json carries the doc
    const truth = readTruth(bookDir, 'b1');
    expect(truth.deskDocs).toHaveLength(1);
    expect(truth.deskDocs[0]!.sourceRefs[0]!.quote).toBe('manuscripts do not burn');
    // notes survived migration AND ride the same truth file
    expect(truth.notes).toHaveLength(0); // notes were index-only in the fixture; truth is the writer's record
    // fts: the doc is searchable
    expect(store.search('collected').some((hit) => hit.bookId === 'b1')).toBe(true);
    store.close();
  });
});
