/**
 * 005 — the page objects: sticky notes + sketches.
 *
 * v0.3.1 makes the page itself markable: a sticky note is a small paper
 * pinned to the visible page (spatial x/y fractions + the page anchor);
 * a sketch is freehand ink laid on the page (tool strokes, fractional
 * points). same dual-write law as every mark: annotations.json first,
 * this index second. one sketch row per page — the anchor's primary is
 * the page key, so saving is an upsert by (book, page).
 */
import type { Migration } from './types.ts';

export const migration005: Migration = {
  version: 5,
  name: 'page-objects',
  up: (db) => {
    db.exec(`
      CREATE TABLE stickies (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        format TEXT NOT NULL DEFAULT 'epub',
        primary_locator TEXT NOT NULL,
        pos_spine INTEGER,
        pos_page INTEGER,
        pos_percent REAL,
        chapter TEXT,
        body TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT 'yellow',
        x REAL NOT NULL DEFAULT 0.5,
        y REAL NOT NULL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_stickies_book ON stickies(book_id);
    `);

    db.exec(`
      CREATE TABLE sketches (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        format TEXT NOT NULL DEFAULT 'epub',
        primary_locator TEXT NOT NULL,
        pos_spine INTEGER,
        pos_page INTEGER,
        pos_percent REAL,
        chapter TEXT,
        strokes TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_sketches_book ON sketches(book_id);
    `);
  },
};
