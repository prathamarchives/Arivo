# FINAL_VERIFICATION — the release record

> no marketing prose. mechanisms, numbers, dates. this is the
> campaign's own closing gate, rerun against the final SHA.

## the baseline

- campaign start: `5c4d8d0` (L0–L18 complete; 447 passed / 2 skipped;
  18 commits unpushed; CSP + 3 docs uncommitted in the tree)
- campaign end: the HEAD of main at the time of this document's
  commit (see the git block below) — every closure wave pushed and
  remote-verified before the next began

## tests

| | before | after |
|---|---|---|
| suites | 36 files | 38 files |
| passed | 447 | **461** |
| skipped | 2 | 2 (honest: the real-book golden paths, armed only by the owner's genuine book) |

added by the closure: capture-wake (5), migration matrix (6),
data-integrity walk (3), design-law scope (APP_CSS joins the raw-hex
law), the stand-in hash guard. `pnpm check` = typecheck (7 projects)
+ eslint + vitest, all green on the final SHA.

## security

- secrets: 9 pattern classes (PAT, sk-, private keys, aws, google,
  slack, bearer literals, credential assignments, basic-auth urls)
  across source AND built output — **0 findings**; the push token was
  one-shot per command, never written to any file, grep of full
  history clean
- production CSP: rewritten at build time (dev allowances stripped,
  app origin added) — verified in the built index.html
- process boundary: contextIsolation on, nodeIntegration off, sandbox
  on; window-open denied; will-navigate denies off-origin
- IPC: 17 hostile-input validation laws + 500-run json fuzz; every
  payload schema-validated before any service
- documents: zip bombs, traversal names, size/ratio/metadata limits,
  200-run byte fuzz — typed rejections only
- SQL: 91 prepared statements, zero string interpolation
- renderer: no innerHTML / no dangerouslySetInnerHTML; no
  electron/node imports (architecture test)
- `pnpm audit --prod`: **0 vulnerabilities** (@xmldom 0.7.13 → 0.8.15
  override; the vulnerable path was unreachable regardless — the
  IE-fallback branch chromium never takes)
- dev-only accepted: vitest 3.2.7 mocker (moderate), sprintf-js
  (moderate, no patch exists) — recorded in the risk register
- environment: 3 env vars (ARIVO_NO_UPDATE, ELECTRON_RENDERER_URL ×2
  dev-gated); 0 console.log in production bundles; 0 source maps in
  the app build

## migrations

matrix verified with real fixtures: **v1→v4** (the v0.1 database with
data + a genuine orphan), **v2→v4**, **v3→v4**, v4 idempotent.
restart applies nothing; identical fixtures converge identically
(deterministic); malformed legacy rows preserved (no silent discard);
duplicates rejected by schema; the desk-doc lifecycle (truth-first →
fts → cascade) works on a migrated db. fresh install boots to schema
4 in one pass. downgrade refused, data untouched.

## storage / data integrity

the whole-system walk: every object family (highlight, bookmark,
note, question, research/make/reflect documents) writes through the
dual-write law, is searchable, and joins the archive ledger with the
full provenance chain (artifact → note → selection → chapter →
book). deleting a book cascades every family in db + ledger + search
with zero ghost entries; the sibling book pays nothing; rebuild after
deletion resurrects only the living. the destroy suite (real SIGKILL
crash points, corrupt/truncate/strand scenarios) and the portability
law (kill index → rebuild → zero loss) remain green.

## performance (bench, linux, node 24)

| scale | startup | search p95 | rebuild | ledger | annotation write | desk write |
|-------|---------|-----------|---------|--------|------------------|-----------|
| 100 | 0.7ms | 2.2ms | 77ms | 3.5ms (600 obj) | 0.5ms | 0.8ms |
| 1,000 | 2.5ms | 6.2ms | 741ms | 13.7ms (5,100 obj) | 0.6ms | 0.7ms |
| 10,000 | 21.1ms | 47.9ms | 8.32s | **311.6ms (50,100 obj)** | 0.5ms | 0.6ms |

all budgets met with an order of magnitude of headroom. the renderer
at 5,000 objects: 61fps scrolling, 8 cards rendered at a 709k-px
ledger's bottom (content-visibility). leak sweep: reader teardown
complete, blob urls revoked, timers disposed, canvases bounded by
the pdf window.

## accessibility

keyboard: tab order verified live; the ink focus ring (2px solid
`--ink`) fires on `:focus-visible` (live-checked); Alt+1..5 switch
desk modes (live, even mid-compose); escape closes panels → selection
→ workbench in order. 480px viewport: zero horizontal overflow
(live-measured). reduced-motion: every duration family carries a
twin (design-law tested); the page still turns with motion off.
screen-reader names: every icon-only button carries aria-label
(a11y suite + live snapshot).

## visual

capture matrix (den × paper/sepia/night, lab × paper/night; pdf +
epub + shelf + workbench + archive): **7/7 VLM-inspected CLEAN** —
no overlap, no clipping, no misalignment, no raw html, marks painted
on the text baseline. evidence: docs/screenshots/matrix-*, gold-*,
a11y-*.

## packaging

- the asar ships no dev files (27 @arivo tests + bench excluded at
  the builder level; the remaining "test" match is core-js's
  es.regexp.test.js polyfill — library code)
- packaged boot (dir target, real asar + node_modules): green ×3
  including after the exclusion — exit 0, smoke screenshot, font gate
  4/4 (helvetica 400/700, literata, mono)
- fresh install: app-data wiped → first launch creates index.db at
  schema 4
- upgrade path: install-over; the library folder is untouched;
  migrations run in place (the matrix above); v0.1.0/v0.2.0 installs
  predate the updater (documented one-time manual hop)
- update feed: release.yml emits + verifies latest.yml and
  app-update.yml end-to-end (downloads its own release back, checks
  version + assets + sha512)

## CI

both jobs on every push to main: `check` (typecheck + lint + tests +
build with the verify-bundle gate) and `packaged-smoke` (packages the
app, boots it headless, uploads the screenshot). green on three
consecutive closure pushes (3f191bd, b481110, 116c572); the final
SHA's run verified before this document's commit. the five red runs
of the L12–L18 era were the capturePage race — diagnosed, fixed,
unit-lawed (the capture-wake suite); the bug class cannot silently
return.

## the golden path (live, final)

EPUB: open → read → highlight → note → question → collect → research
document with provenance → reflect document through the draft engine
(draft → saved) → archive ledger → document click returns into the
desk (book + mode + exact document) → passage ref jumps to the
source page → restart: all data intact. PDF: drag-import → open (12
pages, 3 live canvases) → outline → page jump (chapter 2, 36%) →
zoom (5 bounded canvases) → highlight (11 rects) → close/reopen:
position + marks restored. reduced-motion and keyboard variants: the
twins are law (design-law suite); keyboard path live-verified.

## known accepted risks

1. vitest 3.2.7 mocker advisory — dev-only surface, never shipped
2. sprintf-js DoS advisory — no patched version exists; dev-only
3. upstream npm source maps inside node_modules — public library
   code, shipped by their authors
4. the dev:web HMR crash — dev server only, impossible in production
5. 50k/100k libraries — extrapolated within budget; real measurement
   belongs on real hardware with real libraries

## verification dates

- all automated gates: 2026-10-08 (the closure day), against HEAD
- CI: the same day, on the pushed SHAs, both jobs
- live sessions: the same day (dev:web + agent-browser; packaged
  boots under Xvfb)
