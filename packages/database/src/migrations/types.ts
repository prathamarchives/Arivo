/** the migration contract — deterministic, ordered, transactional */
import type Database from 'better-sqlite3';

export interface Migration {
  /** the schema version this migration produces */
  version: number;
  name: string;
  /** runs inside ONE transaction; the runner guards foreign_keys around it */
  up: (db: Database.Database) => void;
}

/** read the schema version from meta (0 = no schema / fresh or legacy-less) */
export function readSchemaVersion(db: Database.Database): number {
  const hasMeta = (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").get() as
      | { name: string }
      | undefined
  ) !== undefined;
  if (!hasMeta) return 0;
  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;
  return row ? Number(row.value) : 0;
}

export function writeSchemaVersion(db: Database.Database, version: number): void {
  db.prepare(
    "INSERT INTO meta(key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(String(version));
}
