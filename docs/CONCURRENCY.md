# concurrency — one writer, explicitly

## the model

- **single instance:** `requestSingleInstanceLock` before anything else;
  the second process exits (architecture test asserts the order)
- **single writer:** multi-step mutations (import, rebuild, reconcile)
  serialize through the write queue (`packages/core/src/mutex.ts`) —
  strictly ordered, failures never block the queue, depth observable
- **statement-level writes:** better-sqlite3 is synchronous — single
  statement writes (annotations, progress) are serialized by
  construction; the 100-concurrent-write test proves zero lost updates
- **readers:** unaffected — wal mode + the disposable index make reads
  cheap and always-consistent snapshots

## proof

`mutex.test.ts` (ordering, error resilience, 100 concurrent ops),
`destroy.test.ts` (concurrent annotation storm with dual-write intact).
