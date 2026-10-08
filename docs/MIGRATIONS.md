# migrations — deterministic, transactional, tested

## the planner

`packages/database/src/migrations/` — ordered registry, one transaction
per migration, foreign keys guarded around each (the pragma cannot
change mid-transaction):

```
open → probe (corruption?) → read meta.schema_version
  ├─ version > SCHEMA_VERSION → refuse (downgrade), data untouched
  ├─ version < current      → apply pending in order
  └─ version == current     → validate, run
validate: version current + zero foreign_key_check violations
```

## versions

| version | migration | what it does |
|---------|-----------|--------------|
| 1 | `001_initial` | the v0.1.0 baseline, byte-for-byte (fresh dbs get it created) |
| 2 | `002_fks_and_state` | rebuilds every child table with real `REFERENCES ... ON DELETE CASCADE`, purges orphan rows the schemaless era allowed, adds `books.file_missing` |
| 3 | `003_notes` | margin notes: a `notes` table (same anchor contract, `REFERENCES books(id) ON DELETE CASCADE`) + `notes_fts`; the truth file `annotations.json` gains an optional `notes` array — old files parse unchanged |

## proof (`migration.test.ts`)

- a REAL v0.1 database upgrades with zero data loss (books, highlights,
  bookmarks, progress, tags, collections intact; the orphan purge is
  explicit and counted)
- cascade: deleting a book removes every child row — sqlite enforces it
- inserting a highlight for a missing book is rejected
- notes cascade with book deletion, pre-003 truth files parse without
  the `notes` key (tolerant read), and notes survive index death
- downgrade (schema 99 on a v2 db) is refused, version marker untouched
- a poisoned migration rolls back completely — version and data intact
- garbage + truncated files → typed `DATABASE_CORRUPT`
