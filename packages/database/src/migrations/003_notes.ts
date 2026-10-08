/**
 * 003 — margin notes: thinking attached to a place, no highlight required.
 *
 * v0.1 folded every note into its highlight row (the kindle model). this
 * migration gives standalone notes their own home: same anchor contract
 * (primary + textRange + position), same dual-write law (annotations.json
 * first, this index second), same delete cascade. note text is searchable
 * like everything else.
 */
import type { Migration } from './types.ts';

export const migration003: Migration = {
  version: 3,
  name: 'margin-notes',
  up: (db) => {
    db.exec(`
      CREATE TABLE notes (
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
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        fts_row INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS ix_notes_book ON notes(book_id);
    `);

    db.exec(`
      CREATE VIRTUAL TABLE notes_fts USING fts5(
        body, chapter,
        content='', contentless_delete=1
      );
    `);

    // the fts rowid allocator starts at 1 for notes
    db.exec("INSERT INTO fts_seq(name, next) VALUES ('note', 1)");
  },
};
