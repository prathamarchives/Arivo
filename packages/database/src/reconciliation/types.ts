/**
 * reconciliation types — the states, the plan, the report.
 * the engine answers: "given the filesystem and the derived index, what is
 * the correct state?" — never "what does sqlite currently say?"
 */
import type { BookFolderMeta } from '@arivo/core';

/** one observed book folder, before any comparison with the index */
export interface ObservedBook {
  /** the folder name — the book id */
  id: string;
  dir: string;
  /** null = metadata.json unreadable → CORRUPT */
  meta: BookFolderMeta | null;
  /** the book file named by metadata (or the single candidate found) */
  bookFileName: string | null;
  bookFileSize: number | null;
  bookFileMtime: number | null;
  /** content hash — computed only when the fast path disagrees */
  contentHash: string | null;
  /** metadata's fileName was not found but a same-hash candidate was */
  renamed: boolean;
}

/** what the index currently claims (the derived state) */
export interface IndexSnapshot {
  id: string;
  hash: string;
  fileName: string;
  fileSize: number;
  addedAt: number;
  title: string;
}

export type BookState =
  | 'NEW'
  | 'UNCHANGED'
  | 'MODIFIED'
  | 'MISSING'
  | 'CORRUPT'
  | 'DUPLICATE'
  | 'STALE_INDEX'
  | 'ORPHANED_DATA'
  | 'SUPPRESSED';

/** terminal states: reconciliation has nothing left to do about these */
export const TERMINAL_STATES: ReadonlySet<BookState> = new Set([
  'UNCHANGED',
  'SUPPRESSED',
  'CORRUPT',
  'ORPHANED_DATA',
]);

export interface ClassifiedBook {
  id: string;
  state: BookState;
  observed?: ObservedBook;
  indexRow?: IndexSnapshot;
  reason: string;
  /** for DUPLICATE: the id this folder duplicates */
  duplicateOf?: string;
}

export type PlanAction =
  /** NEW → register the book + its truth into the index (fingerprint backfilled) */
  | {
      kind: 'register';
      id: string;
      dir: string;
      hash: string;
      fileSize: number;
      fileMtime: number;
      fileName: string;
    }
  /** STALE_INDEX → the row disagrees with truth; rebuild the row */
  | {
      kind: 'rebuildRow';
      id: string;
      dir: string;
      hash: string;
      fileSize: number;
      fileMtime: number;
      fileName: string;
    }
  /** fingerprint drift without content change (mtime/size moved, hash same) */
  | {
      kind: 'refreshFingerprint';
      id: string;
      dir: string;
      hash: string;
      fileSize: number;
      fileMtime: number;
      fileName: string;
    }
  /** MODIFIED → content changed outside arivo: re-fingerprint, keep annotations */
  | {
      kind: 'markModified';
      id: string;
      dir: string;
      hash: string;
      fileSize: number;
      fileMtime: number;
      fileName: string;
    }
  /** ORPHANED_DATA → book file gone, truth remains: mark, keep row */
  | { kind: 'markFileMissing'; id: string; dir: string; missing: boolean }
  /** MISSING → folder gone: drop the index row (it returns with the folder) */
  | { kind: 'dropRow'; id: string; reason: string }
  /** DUPLICATE → write the marker, drop the row, keep files */
  | { kind: 'suppress'; id: string; dir: string; duplicateOf: string }
  /** the marker pointed at a book that is gone → clear it, re-evaluate */
  | { kind: 'unsuppress'; id: string; dir: string }
  /** CORRUPT / SUPPRESSED / ORPHANED_DATA-with-row — evidence only */
  | { kind: 'reportOnly'; id: string; state: BookState; reason: string };

export interface ReconciliationReport {
  /** wall clock duration of the whole run */
  durationMs: number;
  /** books scanned on disk */
  scanned: number;
  /** index rows compared */
  indexed: number;
  counts: Record<BookState, number>;
  /** classified books (post-apply states, from the verify pass) */
  books: ClassifiedBook[];
  /** actions executed */
  actions: PlanAction[];
  /** true when the verify pass found nothing left to do */
  fixedPoint: boolean;
  /** structured events — the diagnostics layer re-emits these */
  events: ReconciliationEvent[];
}

export interface ReconciliationEvent {
  event: string;
  bookId: string;
  state: BookState;
  reason: string;
  at: number;
}

export const emptyCounts = (): Record<BookState, number> => ({
  NEW: 0,
  UNCHANGED: 0,
  MODIFIED: 0,
  MISSING: 0,
  CORRUPT: 0,
  DUPLICATE: 0,
  STALE_INDEX: 0,
  ORPHANED_DATA: 0,
  SUPPRESSED: 0,
});
