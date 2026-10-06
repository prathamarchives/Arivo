# arivo — the failure model

> the matrix of things that will go wrong, what arivo must do when they do,
> and where the proof lives. this is the spec for reconciliation, recovery,
> and the destructive suite.

## the failure matrix

| # | failure | expected result | detection | proof |
|---|---------|-----------------|-----------|-------|
| 1 | sqlite deleted | rebuild from truth; zero data loss; recovery report | open + reconcile | tests/destroy + store.test |
| 2 | sqlite corrupted (garbage / truncated) | detect `DATABASE_CORRUPT`, move the file aside, rebuild, report | open pragma probe | tests/destroy |
| 3 | process killed during truth write | previous annotations.json intact; no partial file | atomic write + fsync | crash.test (real SIGKILL) |
| 4 | process killed during import | no partial book folder in library/; staging swept at startup | staging + atomic dir rename | crash.test |
| 5 | process killed between truth write and index write | index one mutation behind; reconciliation re-syncs from truth | journal + reconcile | crash.test |
| 6 | disk fills during write | old state remains intact; typed `STORAGE_UNAVAILABLE`; no corruption | write error path | tests/destroy |
| 7 | epub malformed / not a zip | import fails cleanly with `INVALID_DOCUMENT`; no folder, no index row | validation stage | inspect.test + fuzz |
| 8 | epub is a zip bomb | rejected before extraction by ratio + size limits | resource limits | security.test |
| 9 | epub contains path traversal names | never extracted to disk beyond the staging dir; rejected | zip entry check | security.test |
| 10 | epub modified externally after import | reconcile detects `MODIFIED` (hash), re-fingerprints, annotations preserved and re-resolved on open | fingerprint compare | reconciliation.test |
| 11 | book folder moved away | `MISSING` → index row removed + diagnostic; folder returns → same id, same annotations | scan | reconciliation.test |
| 12 | book file deleted, folder + annotations remain | `ORPHANED_DATA` → row marked `file_missing`, ui badge, export still works | scan | reconciliation.test |
| 13 | same book imported twice / duplicated folder | second copy suppressed by content hash with explicit diagnostic | hash identity | reconciliation.test |
| 14 | annotations.json corrupted | salvage from `.bak`; else empty truth + `DOCUMENT_CORRUPT` diagnostic; app never crashes on open | truth read | truth.test + destroy |
| 15 | annotation's text edited in the book | repair via text-range chain; if ambiguous → `ambiguous`, review required | anchor engine | anchor.test adversarial corpus |
| 16 | annotation's text gone | `orphaned` — note survives in notebook, never deleted silently | anchor engine | anchor.test |
| 17 | two app instances launched | second instance exits; single-writer discipline holds | instance lock | main smoke |
| 18 | concurrent mutations from ui | serialized through the write queue; no lost updates | single-writer queue | concurrency.test |
| 19 | schema older than code | migrations run in order, transactionally; version check passes | migration planner | migration.test |
| 20 | schema newer than code (downgrade) | refuse with `MIGRATION_FAILED`-style clear error; data untouched | version check | migration.test |
| 21 | failed / partial migration | transaction rolls back; original db intact | migration tx | migration.test |
| 22 | huge library (10k+) | budgets hold: startup / search / rebuild / scan | benchmarks | bench suite |
| 23 | unexpected error in a mutation | typed domain error; diagnostic event; ui message that names the failure; no silent swallow | error model | errors.test |

## states of the world

reconciliation classifies every book folder + index row into exactly one
state (see docs/RECONCILIATION.md):

```
NEW             on disk, not indexed → register (idempotent)
UNCHANGED       fingerprint matches → nothing to do
MODIFIED        content hash differs → re-fingerprint, keep annotations,
                mark needs_review, anchors re-resolve on next open
MISSING         folder gone → drop index row, diagnostic, returns with
                same id if the folder returns
ORPHANED_DATA   file gone but annotations remain → keep row, file_missing
CORRUPT         metadata/book unreadable → needs_review, never auto-delete
DUPLICATE       content hash already registered under another id → suppress
                (marker in metadata.json, diagnostic, files untouched)
STALE_INDEX     index row disagrees with truth → row rebuilt from truth
```

every state has one deterministic resolution. running reconciliation twice
must produce the same result as running it once (idempotence is a test).

## what arivo never does

- never guesses an ambiguous anchor into a wrong highlight.
- never deletes a book folder the user did not ask to delete.
- never writes a truth file non-atomically.
- never lets the renderer pass a raw filesystem path into a write primitive.
- never reports "something went wrong" when it can name the failure.
- never loses annotations to a crash, a corrupt index, or a rebuild.
