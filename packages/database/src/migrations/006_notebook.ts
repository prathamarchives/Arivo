/**
 * 006 — the notebook: the book of you.
 *
 * v0.3.3 gives the reader the notebook: the compounded record of every
 * learning — auto-generated pages from the annotation timeline (the
 * archive ledger IS the feed), freeform write-in pages, and the link
 * primitive (annotation ↔ annotation, with the one-line reason written
 * at link-time — the compounding layer).
 *
 * same dual-write law as collections: library/notebook.json is the
 * truth, this index is the rebuildable mirror. links + pages are small
 * enough to load whole; the index exists for the rebuild contract and
 * for the day search wants them.
 */
import type { Migration } from './types.ts';

export const migration006: Migration = {
  version: 6,
  name: 'notebook',
  up: (db) => {
    db.exec(`
      CREATE TABLE annotation_links (
        id TEXT PRIMARY KEY,
        from_kind TEXT NOT NULL,
        from_id TEXT NOT NULL,
        to_kind TEXT NOT NULL,
        to_id TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_links_from ON annotation_links(from_id);
      CREATE INDEX IF NOT EXISTS ix_links_to ON annotation_links(to_id);
    `);

    db.exec(`
      CREATE TABLE notebook_pages (
        id TEXT PRIMARY KEY,
        title TEXT,
        body TEXT NOT NULL DEFAULT '',
        strokes TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_notebook_pages_updated ON notebook_pages(updated_at);
    `);
  },
};
