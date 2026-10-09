/**
 * MIGRATIONS, proven:
 * a REAL v0.1 database (schema 1, no fks, with data) upgrades in place —
 * zero data loss, orphan purge, cascading deletes enforced afterwards.
 * downgrade is refused. failed migrations roll back. corruption is typed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { ArivoError } from '@arivo/core';
import { openDb, openMemoryDb, SCHEMA_VERSION } from './db.ts';
import { migration001 } from './migrations/001_initial.ts';
import { runMigrations, validateSchema } from './migrations/index.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'arivo-migrate-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** build a database exactly as arivo v0.1.0 shipped it, with real data */
function buildV01Db(dbPath: string): void {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migration001.up(db); // the v0.1 schema, byte-for-byte
  db.prepare(
    "INSERT INTO meta(key, value) VALUES ('schema_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run();
  // a v0.1-shaped library: 2 books, 3 highlights, a bookmark, progress, a tag,
  // a collection + item — and ONE orphan highlight the old schema allowed
  db.prepare(
    `INSERT INTO books (id, title, authors, format, hash, file_name, file_size, added_at, updated_at, fts_row)
     VALUES ('b1', 'Burnout', '["Han"]', 'epub', 'hash-aaa', 'b.epub', 100, 1, 1, 1),
            ('b2', 'Fixture', '["Fix"]', 'epub', 'hash-bbb', 'f.epub', 200, 2, 2, 2)`,
  ).run();
  db.prepare(
    `INSERT INTO highlights (id, book_id, primary_locator, color, status, text, created_at, updated_at, fts_row)
     VALUES ('h1', 'b1', 'cfi1', 'yellow', 'resolved', 'one', 10, 10, 1),
            ('h2', 'b1', 'cfi2', 'green', 'resolved', 'two', 11, 11, 2),
            ('h3', 'b2', 'cfi3', 'pink', 'resolved', 'three', 12, 12, 3),
            ('h-orphan', 'b-gone', 'cfi9', 'gray', 'orphaned', 'garbage', 13, 13, 4)`,
  ).run();
  db.prepare(
    `INSERT INTO bookmarks (id, book_id, primary_locator, created_at) VALUES ('bm1', 'b2', 'cfib', 20)`,
  ).run();
  db.prepare(
    `INSERT INTO progress (book_id, locator, percent, last_read_at) VALUES ('b1', 'cfip', 0.42, 30)`,
  ).run();
  db.prepare(`INSERT INTO tags (book_id, tag) VALUES ('b1', 'philosophy')`).run();
  db.prepare(
    `INSERT INTO collections (id, name, created_at) VALUES ('c1', 'shelf', 40)`,
  ).run();
  db.prepare(
    `INSERT INTO collection_items (collection_id, book_id) VALUES ('c1', 'b1')`,
  ).run();
  db.close();
}

describe('the upgrade path (I-17, I-19)', () => {
  it('a real v0.1 database migrates to the current schema with zero data loss', () => {
    const dbPath = join(root, 'index.db');
    buildV01Db(dbPath);

    const db = openDb(dbPath);
    const version = db.raw
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(Number(version.value)).toBe(SCHEMA_VERSION);
    expect(Number(version.value)).toBe(5); // migration 005 (the page objects) is current

    // data survived
    const books = db.raw.prepare('SELECT id FROM books ORDER BY id').all();
    expect(books).toHaveLength(2);
    const highlights = db.raw.prepare('SELECT id FROM highlights ORDER BY id').all();
    expect(highlights).toHaveLength(3); // the orphan was purged, the real ones kept
    expect(
      db.raw.prepare("SELECT id FROM highlights WHERE id = 'h-orphan'").get(),
    ).toBeUndefined();
    expect(db.raw.prepare("SELECT id FROM bookmarks WHERE id = 'bm1'").get()).toBeDefined();
    const progress = db.raw.prepare('SELECT percent FROM progress WHERE book_id = ?').get('b1') as {
      percent: number;
    };
    expect(progress.percent).toBeCloseTo(0.42);
    expect(db.raw.prepare('SELECT tag FROM tags').all()).toHaveLength(1);
    expect(db.raw.prepare('SELECT * FROM collection_items').all()).toHaveLength(1);
    db.close();
  });

  it('fks are real: deleting a book cascades every child row (I-19)', () => {
    const dbPath = join(root, 'index.db');
    buildV01Db(dbPath);
    const db = openDb(dbPath);
    // a note rides along post-003 — it must cascade too
    db.raw
      .prepare(
        `INSERT INTO notes (id, book_id, primary_locator, body, created_at, updated_at)
         VALUES ('n1', 'b1', 'cfi-n1', 'a thought', 50, 50)`,
      )
      .run();
    db.raw.prepare("DELETE FROM books WHERE id = 'b1'").run();
    expect(db.raw.prepare('SELECT id FROM highlights WHERE book_id = ?').all('b1')).toHaveLength(0);
    expect(db.raw.prepare('SELECT id FROM notes WHERE book_id = ?').all('b1')).toHaveLength(0);
    expect(db.raw.prepare('SELECT * FROM progress WHERE book_id = ?').all('b1')).toHaveLength(0);
    expect(db.raw.prepare('SELECT * FROM tags WHERE book_id = ?').all('b1')).toHaveLength(0);
    expect(db.raw.prepare('SELECT * FROM collection_items WHERE book_id = ?').all('b1')).toHaveLength(
      0,
    );
    // b2's rows are untouched
    expect(db.raw.prepare('SELECT id FROM highlights').all()).toHaveLength(1);
    db.close();
  });

  it('fks are real: inserting a highlight for a missing book is rejected', () => {
    const db = openDb(join(root, 'index.db'));
    expect(() =>
      db.raw
        .prepare(
          `INSERT INTO highlights (id, book_id, primary_locator, color, status, text, created_at, updated_at)
           VALUES ('h-x', 'b-missing', 'cfi', 'yellow', 'resolved', 'x', 1, 1)`,
        )
        .run(),
    ).toThrow();
    db.close();
  });

  it('a fresh database runs the full chain and validates', () => {
    const db = openDb(join(root, 'fresh.db'));
    const version = db.raw
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(Number(version.value)).toBe(SCHEMA_VERSION);
    validateSchema(db.raw);
    expect((db.raw.pragma('foreign_keys', { simple: true }) as unknown) === 1).toBe(true);
    db.close();
  });

  it('opening an already-current database applies nothing (idempotent)', () => {
    const dbPath = join(root, 'index.db');
    buildV01Db(dbPath);
    const db = openDb(dbPath);
    db.close();
    const again = openDb(dbPath); // second open: no migrations pending
    const version = again.raw
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(Number(version.value)).toBe(SCHEMA_VERSION);
    again.close();
  });
});

describe('downgrade and failure paths', () => {
  it('a database from a newer arivo is refused — data untouched (I-18)', () => {
    const dbPath = join(root, 'index.db');
    const db = openDb(dbPath);
    db.close();
    const rogue = new Database(dbPath);
    rogue.prepare("UPDATE meta SET value = '99' WHERE key = 'schema_version'").run();
    rogue.close();
    expect(() => openDb(dbPath)).toThrow(ArivoError);
    try {
      openDb(dbPath);
    } catch (err) {
      expect(ArivoError.is(err) && err.code).toBe('MIGRATION_FAILED');
    }
    // the file keeps its newer version marker — nothing was touched
    const check = new Database(dbPath);
    const v = check
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(v.value).toBe('99');
    check.close();
  });

  it('a failed migration rolls back completely — version and data intact (I-21)', () => {
    const dbPath = join(root, 'index.db');
    buildV01Db(dbPath);
    // poison: a leftover table from an interrupted migration attempt makes 002 fail
    const poison = new Database(dbPath);
    poison.exec('CREATE TABLE highlights_new (id TEXT)');
    poison.close();

    let thrown: unknown;
    try {
      openDb(dbPath);
    } catch (err) {
      thrown = err;
    }
    expect(ArivoError.is(thrown) && thrown.code).toBe('MIGRATION_FAILED');

    // rollback proof: still version 1, original data intact, poison table remains
    const check = new Database(dbPath);
    const v = check
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(v.value).toBe('1');
    expect(check.prepare('SELECT id FROM highlights').all()).toHaveLength(4); // incl. the orphan
    expect(check.prepare('SELECT id FROM books').all()).toHaveLength(2);
    check.close();
  });

  it('a garbage index file is detected as DATABASE_CORRUPT (I-20)', () => {
    const dbPath = join(root, 'index.db');
    writeFileSync(dbPath, Buffer.from('this is not a database at all, just bytes'));
    try {
      openDb(dbPath);
      expect.unreachable('openDb must throw');
    } catch (err) {
      expect(ArivoError.is(err) && err.code).toBe('DATABASE_CORRUPT');
    }
  });

  it('a truncated index file is detected as DATABASE_CORRUPT', () => {
    const dbPath = join(root, 'index.db');
    buildV01Db(dbPath);
    const bytes = readFileSync(dbPath);
    writeFileSync(dbPath, bytes.subarray(0, Math.floor(bytes.length / 3)));
    try {
      openDb(dbPath);
      expect.unreachable('openDb must throw');
    } catch (err) {
      expect(ArivoError.is(err) && err.code).toBe('DATABASE_CORRUPT');
    }
  });
});

describe('the runner on a raw connection', () => {
  it('reports the applied chain', () => {
    const raw = new Database(':memory:');
    const outcome = runMigrations(raw);
    expect(outcome.applied).toHaveLength(5);
    expect(outcome.from).toBe(0);
    expect(outcome.to).toBe(SCHEMA_VERSION);
    expect(existsSync(':memory:')).toBe(false); // sanity: no fs footprint
    raw.close();
  });

  it('openMemoryDb works (tests + dev mocks)', () => {
    const db = openMemoryDb();
    expect(db.raw.prepare('SELECT 1 AS one').get()).toEqual({ one: 1 });
    db.close();
  });
});
