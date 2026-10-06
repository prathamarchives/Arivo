/**
 * APPLY — execute the plan. every mutation is idempotent and flows through
 * the store (dual-write law: metadata.json changes land before index rows).
 * apply performs LIVE duplicate checks: the snapshot may be stale the moment
 * a register lands.
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BookFolderMeta } from '@arivo/core';
import type { PlanAction } from './types.ts';

/** the store surface apply needs — ArivoStore implements it */
export interface ReconcileStore {
  registerFromTruth(bookDir: string): {
    registered: boolean;
    duplicateOf?: string;
    highlights: number;
    bookmarks: number;
  };
  updateBookRow(id: string, patch: { hash: string; fileSize: number; fileName: string }): void;
  removeIndexRow(id: string): void;
}

export interface AppliedAction {
  action: PlanAction;
  outcome: 'applied' | 'converted' | 'skipped' | 'reported';
  detail?: string;
}

/** atomic metadata write (upgraded to the shared persistence layer in the crash-safety pass) */
function writeMetaFile(dir: string, meta: BookFolderMeta): void {
  const file = join(dir, 'metadata.json');
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(meta, null, 2), 'utf-8');
  renameSync(tmp, file);
}

function readMetaFile(dir: string): BookFolderMeta | null {
  try {
    return JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf-8')) as BookFolderMeta;
  } catch {
    return null;
  }
}

export function applyActions(store: ReconcileStore, actions: PlanAction[]): AppliedAction[] {
  const applied: AppliedAction[] = [];
  for (const action of actions) {
    applied.push({ action, outcome: applyOne(store, action) });
  }
  return applied;
}

function applyOne(store: ReconcileStore, action: PlanAction): AppliedAction['outcome'] {
  switch (action.kind) {
    case 'register':
    case 'rebuildRow': {
      const meta = readMetaFile(action.dir);
      if (!meta) return 'skipped';
      // clear a stale suppression marker whose original has vanished
      if (meta.duplicateOf) delete meta.duplicateOf;
      // backfill the fingerprint so every later scan takes the fast path
      meta.hash = action.hash;
      meta.fileSize = action.fileSize;
      meta.fileMtime = action.fileMtime;
      meta.fileName = action.fileName;
      delete meta.fileMissing;
      writeMetaFile(action.dir, meta); // truth first
      if (action.kind === 'rebuildRow') store.removeIndexRow(action.id);
      const result = store.registerFromTruth(action.dir);
      if (result.registered) return 'applied';
      // live duplicate check tripped → convert to suppression
      if (result.duplicateOf) {
        const fresh = readMetaFile(action.dir);
        if (fresh) {
          fresh.duplicateOf = result.duplicateOf;
          writeMetaFile(action.dir, fresh);
          store.removeIndexRow(action.id);
        }
        return 'converted';
      }
      return 'skipped';
    }
    case 'refreshFingerprint': {
      const meta = readMetaFile(action.dir);
      if (!meta) return 'skipped';
      meta.hash = action.hash;
      meta.fileSize = action.fileSize;
      meta.fileMtime = action.fileMtime;
      meta.fileName = action.fileName;
      delete meta.fileMissing;
      writeMetaFile(action.dir, meta); // truth first
      store.updateBookRow(action.id, {
        hash: action.hash,
        fileSize: action.fileSize,
        fileName: action.fileName,
      });
      return 'applied';
    }
    case 'markModified': {
      const meta = readMetaFile(action.dir);
      if (!meta) return 'skipped';
      // THE RULE: re-fingerprint, never touch annotations
      meta.hash = action.hash;
      meta.fileSize = action.fileSize;
      meta.fileMtime = action.fileMtime;
      meta.fileName = action.fileName;
      delete meta.fileMissing;
      writeMetaFile(action.dir, meta); // truth first
      store.updateBookRow(action.id, {
        hash: action.hash,
        fileSize: action.fileSize,
        fileName: action.fileName,
      });
      return 'applied';
    }
    case 'markFileMissing': {
      const meta = readMetaFile(action.dir);
      if (!meta) return 'skipped';
      if (Boolean(meta.fileMissing) !== action.missing) {
        meta.fileMissing = action.missing;
        writeMetaFile(action.dir, meta);
      }
      return 'applied';
    }
    case 'dropRow': {
      store.removeIndexRow(action.id);
      return 'applied';
    }
    case 'suppress': {
      const meta = readMetaFile(action.dir);
      if (!meta) return 'skipped';
      if (meta.duplicateOf !== action.duplicateOf) {
        meta.duplicateOf = action.duplicateOf;
        writeMetaFile(action.dir, meta); // the marker is the convergence memory
      }
      store.removeIndexRow(action.id);
      return 'applied';
    }
    case 'unsuppress': {
      const meta = readMetaFile(action.dir);
      if (!meta) return 'skipped';
      delete meta.duplicateOf;
      writeMetaFile(action.dir, meta);
      return 'applied';
    }
    case 'reportOnly': {
      return 'reported';
    }
  }
}
