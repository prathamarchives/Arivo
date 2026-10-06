# arivo — the quality bar

> what "production ready" means here. if a line below has no test proving it,
> it is a plan, not a property. the final audit (docs/AUDIT.md) maps every
> claim to its evidence.

the bar is not "features work". the bar is:

> **arivo remains correct when the disk is messy, the epub is hostile, the
> database disappears, the process crashes, the book changes, the library has
> 50,000 books, and something unexpected happens.**

## DATA

- canonical user data never depends on sqlite. `annotations.json` per book is
  the truth; it is written before any index row exists.
- sqlite can be deleted at any moment. rebuild produces equivalent derived
  state. the portability test proves zero loss.
- no mutation silently loses user data. every write is atomic
  (temp + fsync + rename); a crash at any point leaves the previous state
  intact or a recoverable journal entry — never a half-written truth file.
- deleting a book folder and returning it later converges to the same book id
  with the same annotations.

## IMPORT

- import is idempotent: importing the same file twice registers one book and
  reports the second as a duplicate (explicit result, not an error).
- interrupted import is recoverable: a crash at any import step leaves either
  a complete book folder or nothing; staging leftovers are swept at startup.
- corrupt documents never become partially registered: the folder commit is
  an atomic rename, the index row appears only after the commit.
- duplicate documents are detected by content hash, never by filename.

## ANNOTATIONS

- stable anchors survive ordinary document changes (reflow, font, whitespace).
- drift is detectable and typed: `resolved | drifted | ambiguous | orphaned`.
- repair confidence is measurable: every resolution carries a confidence
  number, a strategy, and a candidate count.
- ambiguous repair is never silently accepted: below threshold the highlight
  is marked `ambiguous` and surfaces as "review required", never guessed.
- an unresolved annotation is acceptable. a silently wrong annotation is not.

## DATABASE

- schema version is explicit in `meta.schema_version`.
- migrations are deterministic, ordered, transactional, and tested against a
  real v0.1 database.
- foreign-key behavior is enforced with real `REFERENCES ... ON DELETE`
  constraints — deleting a book cannot leave orphan rows.
- every logical mutation has one transaction boundary; the write order is
  truth first, index second.
- corruption at open is detected and reported, not limped through.

## SECURITY

- the renderer has no node access: `contextIsolation`, `sandbox`,
  `nodeIntegration: false`, and an architecture test that greps the renderer
  for node imports.
- ipc validates every request with runtime schemas before it touches a
  service. typescript disappears at runtime; validation does not.
- documents are hostile input: size, entry count, compression ratio, and
  path traversal are checked before parsing.
- paths from renderer input are validated (absolute, real extension, no
  escape into the library internals); the library root is never writable by
  the renderer except through domain commands.

## PERFORMANCE

budgets are measured, not guessed — see benchmarks/REPORT.md. current bar at
10,000 books on commodity hardware:

- startup (library ready to render): < 800 ms
- search p95: < 100 ms
- rebuild index from truth: < 60 s
- reconciliation scan (all unchanged): < 5 s
- annotation create (dual-write): < 10 ms
- import (typical epub): < 2 s

if a budget regresses, that is a bug, not a rounding error.

## OBSERVABILITY

- every significant failure emits a structured diagnostic event (ring
  buffer, capped, exportable).
- recovery decisions are explainable: the rebuild report says what was lost
  and what was restored — in numbers.
- users can export a diagnostics report from settings. it never contains
  book contents or annotation text.

## TESTING

- core invariants have automated tests. failure paths are tested, not only
  happy paths.
- the hardest algorithms (anchor resolution, reconciliation) have property
  tests and adversarial corpora.
- crash safety is proven by real process kills at controlled points, not
  only mocked failures.
- architecture rules (layering, renderer isolation) are executable tests.
- the destructive suite (tests/destroy/) is the proving ground: delete,
  corrupt, kill, move, duplicate — then reconcile and assert convergence.
