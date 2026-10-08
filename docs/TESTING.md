# testing — the pyramid, by evidence

> counts are cheap; what matters is what they protect. **447 tests
> across 36 files (plus 2 honest skips: the real-book golden paths
> that need a packaged app)**, each mapped to an invariant in
> docs/INVARIANTS.md.

## unit

anchors (adversarial corpus + 4 property suites), validation schemas,
path guards, search query layer, mutation journal, diagnostics privacy,
migration mechanics, security limits, reading profiles (ladder closure,
derivation truth), pdf-logic (the substrate's pure laws), the
DraftEngine (draft/saving/saved/modified/error/recovered), the room
store (spatial memory), motion twins, the effect registry.

## integration

the store's dual-write battery (portability law), reconciliation
convergence (16 scenarios), import pipeline (inspect + write + commit),
search end-to-end, migration upgrade with real v0.1 data.

## crash (real process kills)

`crash.test.ts` spawns child processes running the ACTUAL atomic-write
code with a crash point armed; they die by SIGKILL at four controlled
moments. the file on disk is always old-or-new. not a mock in sight.

## fuzz

- 200 runs: arbitrary bytes as epub + pdf — typed rejections only
- 500 runs: arbitrary json against ipc object schemas
- 500 runs: arbitrary strings through the anchor resolver
- 500 runs: arbitrary strings through the search query layer

## property (fast-check)

anchor round-trip fidelity, reflow invariance (whitespace-run rewrites),
offset sanity, write-queue ordering under 100 concurrent mutations.

## destroy — the proving ground

`destroy.test.ts`: delete/corrupt/truncate the index, corrupt truth
(with and without .bak), strand staging, 1,000-highlight rebuild storms,
200-book responsiveness, concurrent annotation storms, external library
emptying + return, wholesale tampering. the four closing assertions:
**no silent data loss · no invalid annotations · no impossible database
state · no unrecoverable derived state.**

## the law suites (the campaign's teeth)

- `tests/regression-laws.test.ts` (10) — every live-found bug as a
  permanent law: the menu z-layer, single-class annotations, the
  repagination trigger, the seed path, text-never-disappears, the
  mode-switch draft guarantee
- `tests/design-law.test.ts` (28) — raw color/spacing/radius/
  elevation/z/motion/typography scan, reduced-motion twins
- `tests/design-qa.test.ts` (11) — focus patterns, hover ownership,
  drawer bounds, empty/error/loading states, seeded-catch proofs
- `tests/voice.test.ts` (5) — banned vocabulary, the fixed nouns,
  error contracts, plainError
- `tests/effect-registry.test.ts` (8) — blur budgets, glass scarcity,
  the failure paths
- `tests/accessibility.test.ts` (6) — the a11y laws
- `tests/architecture.test.ts` (11) — purity, the bridge, the lock

## architecture (executable)

`tests/architecture.test.ts` scans every source file: core is pure,
persistence is a leaf, packages never import upward, the renderer never
imports electron/node, preload is the only bridge, the instance lock
precedes window creation.

## benchmarks

`pnpm bench` — measured budgets at 100/1k/10k books
(benchmarks/REPORT.md). all 10k budgets met with headroom.

## e2e smoke

headless electron run with a real screenshot (`pnpm smoke`) — the
app actually boots, and the font gate asserts all four families load
from bundled assets. ci additionally boots the *packaged* app (the
packaged-launch gate) because dev and unit tests cannot see
packaging failures — v0.2.1 shipped one.
