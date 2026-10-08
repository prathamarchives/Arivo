# session 0016 — the final closure (the release campaign)

> starting commit: 5c4d8d0 (L0–L18 complete, 447/2 green, 18 commits
> unpushed + uncommitted CSP/doc work in the tree)
> branch: main (the closure campaign runs on main — every wave pushed
> and verified before the next)

## objective

the final campaign set: finish the documentation, deep security,
migration/storage audits, live regressions, the design-law attack,
packaging, and close git — the release invariant, not a milestone.

## what the campaign found and fixed (each with a law)

1. **five red packaged-smoke CIs** (L12/L14/L16/L17/L18 + the first
   closure push) — the app booted, fonts gated 4/4, dev-tree smoke
   passed locally; only `capturePage()` rejected on runners (software
   GL, setuid sandbox: no BeginFrame inside the 3.5s beat). the plain
   smoke path had no wake, no retry, and swallowed the error.
   **fix:** `smoke-capture.ts` — captureWithWake (bounded wake+retry,
   empty-frame guard, real error surfaced), 5 unit laws, wired live.
   CI green on the fix commit and every one after.
2. **the supply chain** — prod audit carried 15 advisories, all
   `@xmldom/xmldom@0.7.13` via epubjs (a dead IE fallback: chromium's
   native XMLSerializer always wins; our own XML parsing is
   jszip+regex). overridden to 0.8.15 anyway — audit --prod now 0
   findings. tinypool's 2 criticals (vitest's pool) overridden to
   2.1.2, suite green. pnpm 12 ignored package.json's pnpm field —
   the dead block removed, overrides live in pnpm-workspace.yaml.
   accepted dev moderates, recorded: vitest 3.2.7 mocker (dev-only),
   sprintf-js (no patched version exists).
3. **the design-law attack found a real gate gap** — app.css (the
   reader's largest skin file) was outside the raw-hex law: a planted
   `#ff00ff` passed silently. the theme-preview swatches migrated to
   `--preview-*` tokens; APP_CSS joined the scan; 28/28 green.
4. **the stand-in false-arm** — a dev seed (fixture copied to the
   seed path) armed the real-book inspect suite and failed it
   honestly. existence is not identity: the guard now hashes the
   fixture — a stand-in can never arm the suite.
5. **dev files shipped in the asar** — 27 @arivo test files + the
   bench harness. excluded at the builder level; repackaged; booted
   green (exit 0, fonts 4/4) — only a real boot proves an exclusion
   (v0.2.1's lesson, applied).

## the audits (P1–P14, each closed)

- **docs**: 5 new shipped-behavior documents (READER_SYSTEM,
  DESIGN_CONSTITUTION, EXPERIENCE_SYSTEM, RELEASE, DECISIONS) + 4
  updated (SECURITY/PERFORMANCE/TESTING/ARCHITECTURE) + the 3 from
  the interrupted pass committed (DESK/ARCHIVE/ACCESSIBILITY)
- **security**: 9-pattern secret sweep over source + build output —
  clean; token never persisted (history grep clean); 0 source maps in
  the app build; 0 dev urls; CSP verified in the built html; 17 ipc
  hostile-input laws (the reported 12 was undercounted); 91 prepared
  statements, zero interpolation; no innerHTML in the renderer;
  navigation + window-open denied at the process level
- **migrations**: the matrix lawed — v1→v4 (existing), v2→v4, v3→v4
  (new, 6 laws), restart no-op, determinism on identical fixtures,
  malformed-legacy preservation, PK guards; the full desk-doc
  lifecycle on a migrated db
- **storage**: the whole-system walk (3 laws) — every family writes,
  searches, joins the ledger with provenance; deleting a book
  cascades everything and costs the sibling nothing; rebuild after
  deletion keeps the dead dead
- **the live golden path** (dev:web + agent-browser, fresh profile):
  epub (highlight → note → question → collect → reflect → archive →
  provenance → ref jump → return to desk → restart: data intact) and
  pdf (import → 3/12 canvases → outline → jump → zoom → 11 marks →
  reopen: position + marks restored); Alt+1..5 live; the focus ring
  live; 480px zero overflow; one dev-only HMR crash, honestly
  recorded (no product path; the console log is the receipt)
- **performance**: bench regenerated — 10k books: startup 21.1ms,
  search p95 47.9ms, rebuild 8.32s, ledger (50,100 objects) 311.6ms,
  desk write 0.6ms; all budgets green with an order of magnitude of
  headroom
- **visual**: the capture matrix (den×paper/sepia/night + lab×
  paper/night × pdf; epub/shelf/workbench/archive) — 7/7 VLM-read
  CLEAN (docs/screenshots/matrix-*, gold-*, a11y-*)
- **packaging**: dev files excluded; fresh install (wiped app-data →
  boot → index.db at schema 4); upgrade = install-over, migrations
  in place (the matrix); packaged boots green ×3
- **CI**: check + packaged-smoke both jobs green on three
  consecutive pushes; the capture fix is the difference

## verification

- **P2**: typecheck + lint clean; **461 passed / 2 skipped** (was
  447/2; +5 capture, +6 matrix, +3 integrity, +1 design-law scope)
- **P3 live**: the packaged boot, the fresh-install db, the CI runs
- evidence: docs/screenshots/ (17 captures)

## honest limits (the accepted-risk register)

- vitest 3.2.7's mocker advisory: dev-only surface (the runner, never
  shipped); the 4.x major bump mid-closure is the wrong risk trade
- sprintf-js (eslint transitive): no patched version exists
- upstream npm packages ship their own public source maps inside
  node_modules — left as their authors shipped them
- the dev:web HMR crash: dev-server-only, unreproducible in clean
  sessions, impossible in production builds (no HMR)
- 50k/100k library scale: extrapolated within budget, measured on
  the owner's hardware when real
