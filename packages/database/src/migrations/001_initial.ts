/**
 * 001 — the baseline: exactly the schema arivo v0.1.0 shipped.
 * a real v0.1 database already has this shape with schema_version=1; a fresh
 * database gets it created here so the whole chain runs identically from zero.
 */
import type { Migration } from './types.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fts_seq (
  name TEXT PRIMARY KEY,
  next INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
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
  fts_row INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  book_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (book_id, tag)
);

CREATE TABLE IF NOT EXISTS progress (
  book_id TEXT PRIMARY KEY,
  locator TEXT NOT NULL,
  percent REAL NOT NULL DEFAULT 0,
  chapter TEXT,
  started_at INTEGER,
  last_read_at INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS ix_highlights_book ON highlights(book_id);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  primary_locator TEXT NOT NULL,
  pos_spine INTEGER,
  pos_page INTEGER,
  pos_percent REAL,
  label TEXT,
  chapter TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_bookmarks_book ON bookmarks(book_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  start_percent REAL NOT NULL DEFAULT 0,
  end_percent REAL
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  PRIMARY KEY (collection_id, book_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
  title, subtitle, authors, description,
  content='', contentless_delete=1
);

CREATE VIRTUAL TABLE IF NOT EXISTS highlights_fts USING fts5(
  text, note, chapter,
  content='', contentless_delete=1
);
`;

export const migration001: Migration = {
  version: 1,
  name: 'initial-schema-v0.1',
  up: (db) => {
    db.exec(SCHEMA);
  },
};
