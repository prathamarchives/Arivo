# reconciliation — the engine

> the filesystem is the truth; the index is derived. the engine answers
> "given the disk and the index, what is the correct state?" — never
> "what does sqlite currently say?"

## the pipeline

```
OBSERVE    scan library/: fingerprint fast path (mtime + size agree with
           metadata → no hashing), staging + temp-litter sweep, junk
           detection, rename adoption by content hash
COMPARE     index rows ↔ observed folders
CLASSIFY    one state per book (pure, deterministic)
PLAN        drops first, registrations oldest-first, then the rest
APPLY       live duplicate guards, truth-first metadata writes
VERIFY      re-observe + re-classify → fixedPoint boolean
```

code: `packages/database/src/reconciliation/` — `scan.ts`, `classify.ts`,
`plan.ts`, `apply.ts`, `index.ts` (orchestrator: `reconcileLibrary(store)`).

## the states

| state | meaning | action |
|-------|---------|--------|
| `NEW` | on disk, not indexed (crash between folder-write and index) | register book + truth |
| `UNCHANGED` | fingerprint agrees | nothing (backfill `fileMtime` once for v0.1 folders) |
| `MODIFIED` | content hash differs — the book changed outside arivo | re-fingerprint metadata + row, **annotations untouched**, anchors re-resolve on next open |
| `MISSING` | folder gone | drop index row + diagnostic; the folder returns with the **same id** and annotations |
| `ORPHANED_DATA` | book file gone, annotations remain | keep row, `fileMissing` flag, ui badge, export still works |
| `CORRUPT` | metadata unreadable | report only — arivo never auto-deletes user files |
| `DUPLICATE` | same content hash registered elsewhere | suppress (marker in metadata.json, files kept) |
| `STALE_INDEX` | row disagrees with truth | rebuild row from truth |
| `SUPPRESSED` | duplicate marker valid | nothing |

## the guarantees (each proven by a test)

- **converge:** a second run reports all `UNCHANGED` / terminal —
  `reconciliation.test.ts`, `destroy.test.ts`
- **idempotent + deterministic:** duplicate winner = oldest `addedAt`,
  ties by id — the determinism test runs two identical libraries
- **identity is content:** sha256 of file bytes; moves and renames don't
  change identity; a renamed file is adopted when the hash matches
- **files are never auto-deleted:** destructive cleanup only touches
  `.staging/` and hidden `*.tmp-*` scratch — arivo's own
- **startup cost:** an all-unchanged scan is stat-only — 10,000 books in
  ~2.2s (`benchmarks/REPORT.md`)

## the report

`reconcileLibrary` returns counts (what was found), actions (what ran),
books (post-apply states), `fixedPoint`, and structured events — the
diagnostics recorder re-emits them (`book.reconciliation.*`), and the ui
shows recovery notes + missing-file badges.
