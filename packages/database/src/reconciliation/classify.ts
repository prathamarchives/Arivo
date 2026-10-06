/**
 * COMPARE + CLASSIFY — given the observed filesystem and the derived index,
 * assign every book exactly one state. the classification is pure: same
 * inputs, same states, every time.
 */

import type { ClassifiedBook, IndexSnapshot, ObservedBook } from './types.ts';

export interface ClassifyInput {
  observed: ObservedBook[];
  index: IndexSnapshot[];
}

export function classifyLibrary({ observed, index }: ClassifyInput): ClassifiedBook[] {
  const indexById = new Map(index.map((row) => [row.id, row]));
  const observedIds = new Set(observed.map((o) => o.id));
  // a row whose folder is gone is about to be dropped — its hash is NOT a
  // live duplicate target, and a marker pointing at it is dead
  const indexByHash = new Map<string, IndexSnapshot>();
  for (const row of index) {
    if (observedIds.has(row.id) && !indexByHash.has(row.hash)) indexByHash.set(row.hash, row);
  }

  const out: ClassifiedBook[] = [];
  const seenFolders = new Set<string>();

  for (const obs of observed) {
    seenFolders.add(obs.id);
    const row = indexById.get(obs.id);
    out.push(classifyOne(obs, row, indexByHash));
  }

  // index rows with no folder on disk → MISSING
  for (const row of index) {
    if (!seenFolders.has(row.id)) {
      out.push({
        id: row.id,
        state: 'MISSING',
        indexRow: row,
        reason: `folder gone from the library — "${row.title}"`,
      });
    }
  }
  return out;
}

function classifyOne(
  obs: ObservedBook,
  row: IndexSnapshot | undefined,
  indexByHash: Map<string, IndexSnapshot>,
): ClassifiedBook {
  const meta = obs.meta;

  // 1. metadata unreadable → CORRUPT (evidence only; never auto-delete)
  if (!meta) {
    return {
      id: obs.id,
      state: 'CORRUPT',
      observed: obs,
      indexRow: row,
      reason: 'metadata.json is missing or unreadable — the folder needs attention',
    };
  }

  // 2. a suppressed duplicate — valid while its original is registered
  if (meta.duplicateOf) {
    const original = indexByHash.get(meta.hash);
    const originalLive =
      original !== undefined && original.id !== meta.id;
    if (originalLive) {
      return {
        id: obs.id,
        state: 'SUPPRESSED',
        observed: obs,
        reason: `content duplicate of ${meta.duplicateOf} — files kept, not indexed`,
        duplicateOf: meta.duplicateOf,
      };
    }
    // the marker points at a book that no longer exists → re-evaluate
    return {
      id: obs.id,
      state: 'NEW',
      observed: obs,
      reason: 'its duplicate marker points at a missing book — re-evaluating',
    };
  }

  // 3. book file gone, truth remains → ORPHANED_DATA
  if (obs.bookFileName === null) {
    return {
      id: obs.id,
      state: 'ORPHANED_DATA',
      observed: obs,
      indexRow: row,
      reason: `the book file is gone but ${meta.fileName} metadata + annotations remain`,
    };
  }

  // 4. content hash known (fast path or freshly computed)
  const hash = obs.contentHash!;

  // 5. no index row for this id
  if (!row) {
    const other = indexByHash.get(hash);
    if (other && other.id !== meta.id) {
      return {
        id: obs.id,
        state: 'DUPLICATE',
        observed: obs,
        duplicateOf: other.id,
        reason: `same content already registered as ${other.id} (${other.title})`,
      };
    }
    return {
      id: obs.id,
      state: 'NEW',
      observed: obs,
      reason: 'on disk but not indexed',
    };
  }

  // 6. index row exists — compare against truth
  if (hash === meta.hash && hash === row.hash && !obs.renamed) {
    // content agrees everywhere; fingerprint may need a backfill (v0.1 folder)
    const fpStale =
      typeof meta.fileMtime !== 'number' ||
      meta.fileMtime !== obs.bookFileMtime ||
      meta.fileSize !== obs.bookFileSize;
    return {
      id: obs.id,
      state: 'UNCHANGED',
      observed: obs,
      indexRow: row,
      reason: fpStale
        ? 'content unchanged — fingerprint backfill'
        : 'fingerprint agrees',
    };
  }
  if (hash !== meta.hash) {
    // the file's bytes changed since the metadata was written → MODIFIED
    return {
      id: obs.id,
      state: 'MODIFIED',
      observed: obs,
      indexRow: row,
      reason: `the book changed outside arivo (hash ${meta.hash.slice(0, 8)} → ${hash.slice(0, 8)})`,
    };
  }
  // meta agrees with disk, the index row disagrees → STALE_INDEX
  return {
    id: obs.id,
    state: 'STALE_INDEX',
    observed: obs,
    indexRow: row,
    reason: 'the index row disagrees with metadata.json — rebuilding from truth',
  };
}
