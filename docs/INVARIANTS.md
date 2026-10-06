# arivo — the invariants

> each subsystem's laws, phrased so a test can assert them. the file named
> after each invariant is its proof; the final audit verifies the map.
> an invariant without a test is a wish — treat it as a bug.

## data layer (truth)

- **I-01 truth before index.** every mutation writes `annotations.json`
  (or `metadata.json`) before the sqlite row. — *store.test.ts, crash tests*
- **I-02 atomic truth.** truth files are written temp → fsync → rename. a
  process kill at any point leaves the previous content valid. — *crash.test.ts*
- **I-03 index is disposable.** deleting `index.db` and rebuilding yields the
  same books, highlights, bookmarks, progress, collections. — *store.test.ts (portability)*
- **I-04 corrupt truth never crashes open.** garbage `annotations.json`
  falls back to `.bak`, else empty truth, plus a diagnostic. — *truth.test.ts*
- **I-05 no orphan truth.** a book folder contains book file + metadata.json
  + annotations.json or it is not a book. partial folders only ever exist in
  `.staging/`, which is swept at startup. — *reconciliation tests, crash tests*

## reconciliation

- **I-06 converge.** for any filesystem state, running reconciliation
  reaches a fixed point: a second run reports all `UNCHANGED`. — *reconciliation.test.ts*
- **I-07 idempotent.** applying the same plan twice equals applying it once.
  — *reconciliation.test.ts*
- **I-08 deterministic ordering.** duplicate resolution picks the oldest
  `addedAt`; ties broken by id. same input, same outcome, every time. — *reconciliation.test.ts*
- **I-09 no silent disappearance.** `MISSING` and `CORRUPT` outcomes emit
  diagnostics; the library list never silently shrinks. — *diagnostics wiring*
- **I-10 identity is content, not path.** a book's identity hash is sha256
  of its file bytes; moves/renames do not change identity. — *reconciliation.test.ts*
- **I-11 files are never auto-deleted.** destructive cleanup only ever
  touches `.staging/` (arivo's own scratch). — *reconciliation tests*

## anchors

- **I-12 never confidently wrong.** a repair below the confidence threshold
  or with tied candidates resolves to `ambiguous`, never to a guess. — *anchor.test.ts*
- **I-13 reflow-immune.** changing whitespace/fonts/line breaks never moves
  or breaks a resolved anchor. — *anchor.test.ts (property tests)*
- **I-14 drift is typed.** edit inside a highlight → `drifted` with a
  repaired range or `ambiguous`; delete the text → `orphaned`. — *anchor.test.ts*
- **I-15 resolution is explainable.** every outcome carries status,
  confidence, strategy, candidate count. — *anchor.test.ts*

## database

- **I-16 explicit version.** `meta.schema_version` always exists and equals
  the code's schema after open. — *migration.test.ts*
- **I-17 ordered migrations.** a v0.1 database upgrades through every
  migration in order, inside transactions, without data loss. — *migration.test.ts*
- **I-18 no downgrade silently.** a database newer than the code refuses to
  open with a clear error; the file is untouched. — *migration.test.ts*
- **I-19 referential integrity.** real fk constraints with cascade; book
  deletion leaves zero child rows. — *migration.test.ts*
- **I-20 corruption detected at open.** a garbage file is reported as
  `DATABASE_CORRUPT`, backed up, rebuilt. — *destroy tests*

## import / documents

- **I-21 validate before parse.** size, entry count, compression ratio, and
  traversal are checked before any extraction. — *security.test.ts*
- **I-22 import is atomic.** a book appears in `library/` only as a complete
  folder (atomic rename from staging); the index row appears only after. — *crash tests*
- **I-23 idempotent import.** same content twice → one book + one explicit
  duplicate result. — *store.test.ts / reconciliation tests*
- **I-24 hostile input is rejected, never fatal.** fuzzed garbage never
  crashes the pipeline; it produces typed `INVALID_DOCUMENT`. — *fuzz tests*

## ipc / security

- **I-25 every payload validated.** an ipc handler never touches a service
  with unvalidated arguments; malformed input gets a typed rejection. — *ipc tests*
- **I-26 renderer has no node.** no node/electron imports in renderer code;
  preload exposes a fixed api surface. — *architecture.test.ts*
- **I-27 no write primitive from the renderer.** no channel accepts a
  destination path for writes; exports go through main-side dialogs. — *ipc tests*
- **I-28 settings paths are guarded.** a library root that is a filesystem
  root or relative path is rejected. — *validation tests*

## concurrency

- **I-29 single writer.** all mutations serialize through one queue; no
  interleaved multi-step operation. — *concurrency.test.ts*
- **I-30 single instance.** the second process exits instead of racing the
  first. — *main smoke*

## observability

- **I-31 failures leave evidence.** every typed error also emits a
  structured diagnostic event with context. — *diagnostics tests*
- **I-32 diagnostics are exportable and private.** the export contains
  counts, versions, and event metadata — never book text or annotation
  bodies. — *diagnostics tests*

## performance

- **I-33 budgets hold at 10k books** (see docs/QUALITY-BAR.md numbers);
  regression beyond budget fails the benchmark gate. — *benchmarks/REPORT.md*

## release / delivery

- **I-34 updates never break the app.** the update check is packaged-only,
  error-swallowed, and kill-switchable; offline is a silent no-op; the
  recheck timer never keeps the process alive. — *updates.test.ts*
- **I-35 a release is a working feed.** every tag release ships
  `latest.yml` + blockmap, is verified end-to-end by the release workflow
  itself (version, assets, sha512 of the downloaded bits) — a green
  release run proves installed builds can update. — *release.yml final
  step, scripts/verify-update-feed.mjs*
- **I-36 the reader fetch chain is regression-gated.** the renderer's
  `arivo://` fetch (the "FAILED TO FETCH" failure mode) is asserted in
  every smoke run — status, CORS header, and byte count. — *smoke probe
  (smoke-fetch.json), commit 2ea230c*
