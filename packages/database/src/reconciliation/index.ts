/**
 * the reconciliation engine — OBSERVE → COMPARE → CLASSIFY → PLAN → APPLY →
 * VERIFY. running reconcileLibrary() must converge the library to a fixed
 * point: a second run reports all UNCHANGED (that is the test).
 */
import type { ArivoStore } from '../store.ts';
import { scanLibrary } from './scan.ts';
import { classifyLibrary } from './classify.ts';
import { planFromClassification } from './plan.ts';
import { applyActions } from './apply.ts';
import {
  emptyCounts,
  TERMINAL_STATES,
  type BookState,
  type ClassifiedBook,
  type IndexSnapshot,
  type PlanAction,
  type ReconciliationEvent,
  type ReconciliationReport,
} from './types.ts';

export * from './types.ts';

function indexSnapshot(store: ArivoStore): IndexSnapshot[] {
  return store.listBooks().map((b) => ({
    id: b.id,
    hash: b.hash,
    fileName: b.fileName,
    fileSize: b.fileSize,
    addedAt: b.addedAt,
    title: b.title,
  }));
}

function toEvents(books: ClassifiedBook[], at: number): ReconciliationEvent[] {
  return books
    .filter((b) => b.state !== 'UNCHANGED')
    .map((b) => ({
      event: `book.reconciliation.${b.state.toLowerCase()}`,
      bookId: b.id,
      state: b.state,
      reason: b.reason,
      at,
    }));
}

/**
 * one full reconciliation pass. safe to run at startup, on demand, or twice
 * in a row — the second run is a no-op report (fixedPoint === true).
 * counts describe what was FOUND (first classification); books + fixedPoint
 * describe the state AFTER applying (the verify pass).
 */
export function reconcileLibrary(store: ArivoStore): ReconciliationReport {
  const startedAt = Date.now();
  const libraryDir = store.booksDir();

  // OBSERVE
  const scan = scanLibrary(libraryDir);

  // COMPARE + CLASSIFY
  const index = indexSnapshot(store);
  const classified = classifyLibrary({ observed: scan.books, index });
  const found = emptyCounts();
  for (const b of classified) found[b.state] += 1;

  // PLAN
  const actions: PlanAction[] = planFromClassification(classified);

  // APPLY
  applyActions(store, actions);

  // VERIFY — re-observe + re-classify; the residual must be all terminal
  const scan2 = scanLibrary(libraryDir);
  const index2 = indexSnapshot(store);
  const residual = classifyLibrary({ observed: scan2.books, index: index2 });
  const fixedPoint = residual.every(
    (b) => TERMINAL_STATES.has(b.state) || b.state === 'UNCHANGED',
  );

  return {
    durationMs: Date.now() - startedAt,
    scanned: scan2.books.length,
    indexed: index2.length,
    counts: found,
    books: residual,
    actions,
    fixedPoint,
    events: [...toEvents(classified, startedAt), ...toEvents(residual, startedAt).filter(
      (e2) => !classified.some((b) => b.id === e2.bookId),
    )],
  };
}

/** classify without applying — for "what would change?" previews */
export function inspectReconciliation(store: ArivoStore): {
  counts: Record<BookState, number>;
  books: ClassifiedBook[];
} {
  const scan = scanLibrary(store.booksDir());
  const index = indexSnapshot(store);
  const classified = classifyLibrary({ observed: scan.books, index });
  const counts = emptyCounts();
  for (const b of classified) counts[b.state] += 1;
  return { counts, books: classified };
}
