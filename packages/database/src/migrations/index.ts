/**
 * THE MIGRATION PLANNER — explicit, ordered, transactional, testable.
 *
 *   open db → probe (corruption?) → read schema_version →
 *   refuse downgrade → apply pending in order (one tx each, FKs guarded) →
 *   validate → run
 */
import type Database from 'better-sqlite3';
import { ArivoError } from '@arivo/core';
import { migration001 } from './001_initial.ts';
import { migration002 } from './002_fks_and_state.ts';
import { migration003 } from './003_notes.ts';
import { readSchemaVersion, writeSchemaVersion, type Migration } from './types.ts';

export const MIGRATIONS: readonly Migration[] = [migration001, migration002, migration003];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export interface MigrationOutcome {
  from: number;
  to: number;
  applied: string[];
}

/** plan + apply every pending migration. throws typed errors, never guess. */
export function runMigrations(db: Database.Database): MigrationOutcome {
  const current = readSchemaVersion(db);
  if (current > SCHEMA_VERSION) {
    throw new ArivoError(
      'MIGRATION_FAILED',
      `this database was written by a newer arivo (schema ${current}, this build supports ${SCHEMA_VERSION}). update arivo — your data is untouched.`,
      { found: current, supported: SCHEMA_VERSION },
    );
  }
  const pending = MIGRATIONS.filter((m) => m.version > current);
  const applied: string[] = [];
  for (const migration of pending) {
    // fk pragma cannot change inside a transaction — guard around it
    db.pragma('foreign_keys = OFF');
    const run = db.transaction(() => {
      migration.up(db);
      writeSchemaVersion(db, migration.version);
    });
    try {
      run();
    } catch (err) {
      // the transaction rolled back — the db is exactly as it was
      throw new ArivoError(
        'MIGRATION_FAILED',
        `migration ${migration.version} (${migration.name}) failed and rolled back: ${err instanceof Error ? err.message : String(err)}`,
        { version: migration.version, name: migration.name },
      );
    } finally {
      db.pragma('foreign_keys = ON');
    }
    applied.push(`${migration.version}:${migration.name}`);
  }
  return { from: current, to: SCHEMA_VERSION, applied };
}

/** the schema contract holds: version is current + no fk violations */
export function validateSchema(db: Database.Database): void {
  const version = readSchemaVersion(db);
  if (version !== SCHEMA_VERSION) {
    throw new ArivoError('MIGRATION_FAILED', `schema version ${version} ≠ ${SCHEMA_VERSION}`, {
      found: version,
    });
  }
  const violations = db.pragma('foreign_key_check') as unknown[];
  if (violations.length > 0) {
    throw new ArivoError('MIGRATION_FAILED', `foreign key violations remain: ${violations.length}`, {
      violations: violations.length,
    });
  }
}
