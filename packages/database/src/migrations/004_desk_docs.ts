/**
 * 004 — the desk: workbench documents + the question mark.
 *
 * L10 makes the desk a source-centered workbench. two additions:
 *
 * 1. desk_docs — the workbench's papers. one entity, three kinds
 *    (research / make / reflect) because the persistence contract is
 *    identical for all three; kinds differ in instruments, not storage.
 *    same dual-write law as every mark: annotations.json first, this
 *    index second. source refs (collected quotes + their locators) live
 *    inside the doc row as JSON — provenance is part of the document,
 *    not a join.
 *
 * 2. notes.question — a margin note that asks rather than asserts.
 *    additive column, default 0, tolerated absent by the truth reader.
 */
import type { Migration } from './types.ts';

export const migration004: Migration = {
  version: 4,
  name: 'desk-docs',
  up: (db) => {
    db.exec(`
      CREATE TABLE desk_docs (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        source_refs TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        fts_row INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS ix_desk_docs_book ON desk_docs(book_id);
    `);

    db.exec(`
      CREATE VIRTUAL TABLE desk_docs_fts USING fts5(
        title, body,
        content='', contentless_delete=1
      );
    `);

    // the fts rowid allocator starts at 1 for desk docs
    db.exec("INSERT INTO fts_seq(name, next) VALUES ('deskdoc', 1)");

    // margin notes learn to ask
    db.exec('ALTER TABLE notes ADD COLUMN question INTEGER NOT NULL DEFAULT 0');
  },
};
