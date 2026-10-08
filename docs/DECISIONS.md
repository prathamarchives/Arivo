# decisions — the record

every important architectural decision has a reason. full ADRs live in
`docs/DECISIONS/ADR-001-electron.md`; this is the index plus the
campaign's own decisions (L0–L18 and the final closure), each with its
reason and its evidence.

## the foundation ADRs

| adr | decision | the reason |
|-----|----------|-----------|
| 001 | electron over tauri/web | typescript everywhere, zero rust friction, consistent chromium rendering; pdf.js + epub.js run natively. the web alternative loses local-first on arrival |
| 002 | sqlite as index, json as truth | `~/Arivo/` is the complete export; the db is a cache. kill the index → rebuild → zero loss (the portability suite proves it) |
| 003 | the format plugin contract | reader/annotations/search/progress speak only to FormatReader; epub and pdf implement it. foliate-js is a contained swap |
| 004 | epub.js 0.3.93, wrapped | barely maintained, accepted for v0.1 behind the adapter; documented scars (css themes, fonts, factory); fallback named |
| 005 | app:// protocol | file:// blocks es modules (CORS); the shell serves the built renderer; book bytes stream over arivo:// |
| 006 | windows first | the owner reads on windows; nsis via electron-builder; mac/linux one flag away |

## the campaign's decisions (L0–L18)

- **tokens or nothing (L1/L6)** — one vocabulary in `packages/ui/src/
  tokens/`, enforced by 28 design-law checks. reason: closed systems
  age well; open ones rot. evidence: the checker's own seeded-violation
  proofs (L16).
- **dual-write, truth first (constitution law 11)** — every mutation
  writes `annotations.json` before sqlite. reason: a crash after the
  json write is a stale index (rebuildable); the reverse is silent
  data loss. evidence: the destroy suite, real SIGKILL crash points.
- **the anchor contract (law 3)** — primary + textRange + position,
  resolution ladder with visible orphaning. reason: formats drift;
  silent loss is the alternative. evidence: the adversarial corpus +
  4 property suites.
- **the desk as one entity, three kinds (L10)** — `DeskDoc` with kind
  research/make/reflect rather than three tables. reason: the kinds
  differ in instruments, not in storage; one persistence contract
  covers all writing surfaces. evidence: migration 004, the DraftEngine
  law (11 engine tests + regressions).
- **the DraftEngine owns the text (L10)** — never component state.
  reason: unmounts, mode switches, and crashes were the three ways
  user text could die. evidence: recovered-from-crash live proof; the
  no-raw-useState law.
- **provenance before presentation (L11)** — the archive stores the
  full chain (artifact → note → selection → chapter → book) and no
  graph/timeline/wall. reason: "a graph is not automatically the right
  UI" (the zip's own law); the relationships earn presentation later.
  evidence: ref-jump and archive→desk roundtrips, live.
- **the effect registry says NO (L12)** — no new effects, contracts +
  budgets + failure paths for the existing six. reason: the gatekeeper
  bar is profiling + visual proof of benefit. evidence: the rejected
  list, 8 registry laws, the glass @supports fallback.
- **plainError owns every surface (L13)** — coded errors speak,
  internals never. reason: epub.js parser messages in a user's face
  was the shipping reality. evidence: the voice suite (5 laws), the
  two fixed surfaces.
- **focus as foundation (L14)** — one universal `:focus-visible` rule,
  per-family hover. reason: per-class focus patches are the exception
  the constitution forbids. evidence: the a11y suite; the 480px live
  run.
- **measured, not vibes (L15)** — budgets in QUALITY-BAR, the bench
  extended, virtualization deferred with numbers. reason: "suspicious"
  is not a metric. evidence: 10k ledger 312ms, 61fps at 5k objects.
- **attack the system (L16)** — seeded violations prove the gates
  catch. reason: a checker that cannot catch is decoration. evidence:
  each family's seeded-catch test.
- **the yield, never the reflow (L17)** — transform slide, place
  sacred. reason: reflowing the reading column would cost position.
  evidence: the law + the live proof.
- **identity survives removal (L18)** — remove the wordmark, the
  motion, any decoration; the character must persist. reason:
  identity that depends on ornament is fragile. evidence: the removal
  A/B, VLM-read.

## the closure decisions (final campaign)

- **production CSP rewritten at build time** — one source of truth
  (the dev file), the build strips dev allowances. reason: two
  hand-maintained CSPs drift. evidence: the built index.html verified.
- **window-open denial + will-navigate guard in main** — defense in
  depth behind the renderer's own discipline. reason: books are
  untrusted input; a regression must never earn a window.
- **the packaged-launch gate in ci** — boots the real package. reason:
  v0.2.1 shipped an installer that crashed at first launch; dev and
  unit tests cannot see it. evidence: the v0.2.1 postmortem, the gate.
