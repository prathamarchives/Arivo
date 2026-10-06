/**
 * 002 — real referential integrity + reconciliation state columns.
 *
 * v0.1 had no FOREIGN KEY constraints — deletion correctness lived in
 * hand-written DELETE chains. this migration rebuilds every child table
 * with `REFERENCES books(id) ON DELETE CASCADE`, removes orphan rows the
 * old schema could have accumulated (unreachable garbage), and adds the
 * `file_missing` column reconciliation uses to surface ORPHANED_DATA books.
 */
import type { Migration } from './types.ts';

export const migration002: Migration = {
  version: 2,
  name: 'foreign-keys-and-reconciliation-state',
  up: (db) => {
    // 1. purge orphans the schemaless era may have left behind
    db.exec(`
      DELETE FROM highlights WHERE book_id NOT IN (SELECT id FROM books);
      DELETE FROM bookmarks WHERE book_id NOT IN (SELECT id FROM books);
      DELETE FROM progress WHERE book_id NOT IN (SELECT id FROM books);
      DELETE FROM sessions WHERE book_id NOT IN (SELECT id FROM books);
      DELETE FROM tags WHERE book_id NOT IN (SELECT id FROM books);
      DELETE FROM collection_items WHERE book_id NOT IN (SELECT id FROM books);
      DELETE FROM collection_items WHERE collection_id NOT IN (SELECT id FROM collections);
    `);

    // 2. books: + file_missing (reconciliation's ORPHANED_DATA flag)
    db.exec(`
      CREATE TABLE books_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subtitle TEXT,
        authors TEXT NOT NULL DEFAULT '[]',
        description TEXT,
        language TEXT,
        publisher TEXT,
        published_year TEXT,
        cover_path TEXT,
        format TEXT NOT NULL,
        hash TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        fts_row INTEGER NOT NULL DEFAULT 0,
        file_missing INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO books_new (id, title, subtitle, authors, description, language, publisher,
        published_year, cover_path, format, hash, file_name, file_size, added_at, updated_at, fts_row)
        SELECT id, title, subtitle, authors, description, language, publisher,
        published_year, cover_path, format, hash, file_name, file_size, added_at, updated_at, fts_row
        FROM books;
      DROP TABLE books;
      ALTER TABLE books_new RENAME TO books;
    `);

    // 3. child tables: real constraints, delete cascades
    db.exec(`
      CREATE TABLE highlights_new (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        primary_locator TEXT NOT NULL,
        text_exact TEXT NOT NULL DEFAULT '',
        text_prefix TEXT NOT NULL DEFAULT '',
        text_suffix TEXT NOT NULL DEFAULT '',
        pos_spine INTEGER,
        pos_page INTEGER,
        pos_percent REAL,
        chapter TEXT,
        color TEXT NOT NULL,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'resolved',
        text TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        fts_row INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO highlights_new SELECT * FROM highlights;
      DROP TABLE highlights;
      ALTER TABLE highlights_new RENAME TO highlights;
      CREATE INDEX IF NOT EXISTS ix_highlights_book ON highlights(book_id);
    `);

    db.exec(`
      CREATE TABLE bookmarks_new (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        primary_locator TEXT NOT NULL,
        pos_spine INTEGER,
        pos_page INTEGER,
        pos_percent REAL,
        label TEXT,
        chapter TEXT,
        created_at INTEGER NOT NULL
      );
      INSERT INTO bookmarks_new SELECT * FROM bookmarks;
      DROP TABLE bookmarks;
      ALTER TABLE bookmarks_new RENAME TO bookmarks;
      CREATE INDEX IF NOT EXISTS ix_bookmarks_book ON bookmarks(book_id);
    `);

    db.exec(`
      CREATE TABLE progress_new (
        book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
        locator TEXT NOT NULL,
        percent REAL NOT NULL DEFAULT 0,
        chapter TEXT,
        started_at INTEGER,
        last_read_at INTEGER NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO progress_new SELECT * FROM progress;
      DROP TABLE progress;
      ALTER TABLE progress_new RENAME TO progress;
    `);

    db.exec(`
      CREATE TABLE sessions_new (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        start_percent REAL NOT NULL DEFAULT 0,
        end_percent REAL
      );
      INSERT INTO sessions_new SELECT * FROM sessions;
      DROP TABLE sessions;
      ALTER TABLE sessions_new RENAME TO sessions;
    `);

    db.exec(`
      CREATE TABLE tags_new (
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        PRIMARY KEY (book_id, tag)
      );
      INSERT INTO tags_new SELECT * FROM tags;
      DROP TABLE tags;
      ALTER TABLE tags_new RENAME TO tags;
    `);

    db.exec(`
      CREATE TABLE collection_items_new (
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        PRIMARY KEY (collection_id, book_id)
      );
      INSERT INTO collection_items_new SELECT * FROM collection_items;
      DROP TABLE collection_items;
      ALTER TABLE collection_items_new RENAME TO collection_items;
    `);
  },
};
