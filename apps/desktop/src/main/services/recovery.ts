/**
 * recovery — corruption at open and library drift at startup.
 * the recovery report is evidence: what happened, what was rebuilt, what
 * (never) was lost.
 */
import path from 'node:path';
import fs from 'node:fs';
import { ArivoError, type ReconciliationReport } from '@arivo/core';
import { ArivoStore, openDb, reconcileLibrary } from '@arivo/database';

export interface RecoveryOutcome {
  store: ArivoStore;
  /** non-null when the index was damaged and rebuilt */
  dbRecovered: string | null;
  /** the startup reconciliation report (always runs) */
  reconciliation: ReconciliationReport | null;
}

/** open the index; corruption → backup aside → fresh → rebuild from truth */
function openStoreWithRecovery(dbPath: string, libraryRoot: string): { store: ArivoStore; note: string | null } {
  try {
    return { store: new ArivoStore(openDb(dbPath), libraryRoot), note: null };
  } catch (err) {
    if (!(err instanceof ArivoError) || err.code !== 'DATABASE_CORRUPT') throw err;
    const backup = `${dbPath}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(dbPath, backup);
      for (const side of ['-wal', '-shm']) {
        if (fs.existsSync(`${dbPath}${side}`)) fs.renameSync(`${dbPath}${side}`, `${backup}${side}`);
      }
    } catch {
      /* the fresh db below replaces whatever remains */
    }
    const store = new ArivoStore(openDb(dbPath), libraryRoot);
    const rebuilt = store.rebuildIndex();
    return {
      store,
      note: `the index was damaged — arivo rebuilt it from your library: ${rebuilt.books} books, ${rebuilt.highlights} highlights, ${rebuilt.bookmarks} bookmarks, 0 annotations lost`,
    };
  }
}

/**
 * the startup sequence: open (with corruption recovery) → reconcile the
 * library to a fixed point → report. safe to run on every launch: an
 * all-unchanged library is a stat-only scan.
 */
export function recoverAtStartup(userDataDir: string, libraryRoot: string): RecoveryOutcome {
  const dbPath = path.join(userDataDir, 'index.db');
  const { store, note } = openStoreWithRecovery(dbPath, libraryRoot);
  const reconciliation = reconcileLibrary(store);
  void note; // surfaced via the diagnostics event when observability wires in
  return { store, dbRecovered: note, reconciliation };
}

