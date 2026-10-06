/**
 * the database opener — corruption is DETECTED, versions are EXPLICIT,
 * migrations run before anyone touches a table.
 * sqlite is disposable; that is no excuse for being casual about it.
 */
import Database from 'better-sqlite3';
import { ArivoError } from '@arivo/core';
import { runMigrations, validateSchema, SCHEMA_VERSION } from './migrations/index.ts';

export { SCHEMA_VERSION };

export interface Db {
  raw: Database.Database;
  close(): void;
}

/** probe for corruption before any table is trusted */
function probeIntegrity(raw: Database.Database): void {
  try {
    // a garbage file fails here ("file is not a database")
    const check = raw.pragma('quick_check', { simple: true }) as string;
    if (check !== 'ok') {
      throw new ArivoError('DATABASE_CORRUPT', `the index failed its integrity check: ${check}`, {
        quickCheck: check,
      });
    }
  } catch (err) {
    if (ArivoError.is(err)) throw err;
    throw new ArivoError(
      'DATABASE_CORRUPT',
      `the index file is damaged: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function openDb(path: string): Db {
  const raw = new Database(path);
  try {
    // a garbage/truncated file fails on the first pragma — that IS the probe
    raw.pragma('journal_mode = WAL');
    raw.pragma('synchronous = FULL'); // crash-safe commits; the index is cheap, trust is not
    raw.pragma('foreign_keys = ON');
    probeIntegrity(raw);
    runMigrations(raw);
    validateSchema(raw);
    return {
      raw,
      close: () => raw.close(),
    };
  } catch (err) {
    try {
      raw.close();
    } catch {
      /* already closed */
    }
    if (ArivoError.is(err)) throw err; // typed errors pass through untouched
    // anything else at open = the file is damaged, not "wrong schema"
    throw new ArivoError(
      'DATABASE_CORRUPT',
      `the index file is damaged: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** in-memory db for tests + browser dev mock */
export function openMemoryDb(): Db {
  return openDb(':memory:');
}
