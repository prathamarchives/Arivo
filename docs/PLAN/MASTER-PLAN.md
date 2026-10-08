# arivo — the master plan (from "can read" to the product)

> status: PLAN MODE. nothing executed. sources: the shipped repo at
> `1a45778` / tag `v0.2.2` (30 commits, 161 tests, all 20 docs read),
> LAYER0-PLAN.md (the laws), and a full feature-surface inventory of
> every renderer/main/package file. the owner's word: "what we have
> proved is just book → can read. a lotta work is pending."

---

## 0. where we actually are — the honest position

**what is proven and shipped (v0.2.2, live, auto-updating):**

- the golden path, end to end, hardened: import (dialog + drag-drop)
  → validate → atomic staged commit → dual-write index → read (EPUB
  paginated via epub.js, PDF fixed-layout via pdf.js) → select →
  5-color highlight + note + bookmark → drift-repair on every reopen
  → notebook drawer → collections → palette FTS5 search → markdown
  reading-notes export → close → reopen → same spot, everything
  intact.
- the hardening campaign, **done**: 11 items — reconciliation engine
  (9 states, fixed-point, determinism), SIGKILL-proven persistence,
  migrations + real FKs, anchor confidence/ambiguity wall, hostile
  input validation (zip bombs, traversal, fuzz), IPC hardening,
  diagnostics with privacy scrub, query sanitizer, single-writer
  + single-instance, the destroy suite, measured budgets at 10k,
  executable architecture laws. 161 tests. the 11-question audit
  answered with evidence.
- the delivery loop: CI green on both gates (check + packaged-smoke
  boot with screenshot evidence), tag → windows release → sha256 +
  blockmap + latest.yml → feed verified end-to-end by the workflow
  itself. auto-update live in installed builds.

the summary above is the constitution's v0.1 promise, delivered.
**everything past this line is what "pending" means.**

## 1. the debt register — every gap, with its law citation

graded: **[honesty]** violates a stated law or ships a fake thing ·
**[promise]** layer-1 directive promised it · **[constitution]** the
12 laws demand it at its layer · **[scale]** the quality bar demands
it · **[deferred]** a documented scope decision, not an accident

| # | the gap | evidence | grade |
|---|---------|----------|-------|
| D1 | **the scroll toggle is a placebo.** the chips persist a `flow` setting that `EpubAdapter` never reads — it hard-codes `flow: 'paginated'`. README claims "paginated or scrolled." a fake control in a product whose constitution says "errors explain themselves" and bans silent dishonesty | `Reader.tsx` chips vs `packages/reader/epub.ts` open options | **[honesty]** |
| D2 | **tags are a dead organ.** modeled, stored, dual-written, FTS-searchable, client-filtered — but import always writes `tags: []` and no UI can ever set one. schema that lies about the product | `documents/write.ts`, `Library.tsx` search filter | **[honesty]** |
| D3 | **book metadata is invisible.** description, publisher, language, year, subtitle are extracted, migrated, indexed — and never rendered anywhere. no book detail view exists. "open beautifully" has no back half | `inspect.ts` writes it; no reader of it | **[promise]** |
| D4 | **no settings screen at all.** `booksDir` (where the library lives!) is settable only via IPC from code. docs reference a settings → export-diagnostics path that doesn't exist | `DIAGNOSTICS.md` vs renderer | **[honesty]** |
| D5 | **diagnostics has no face.** `api.diagnostics.report/export` is wired through preload, IPC, mock — zero renderer calls. the observability law built the instrument and hid it | `services/api.ts` unused methods | **[honesty]** |
| D6 | **sessions are recorded and never shown.** begin/end written to db, "behavior is data" is a constitutional law — no statistics surface exists anywhere | `session:begin/end` IPC vs renderer | **[constitution]** |
| D7 | **collections are half-managed.** create + assign + filter exist; rename, delete, unassign, reorder do not | `stores/library.ts` | **[promise]** |
| D8 | **search is split-brained.** library box = client substring over titles; palette = FTS5 remote. two search systems, one product, neither unified. **neither searches book content** — the constitution's FTS scope includes chapters | `Library.tsx` vs `CommandPalette.tsx` | **[constitution]** |
| D9 | **CJK search is prefix-only** (unicode61 tokenizer) — flagged by AUDIT.md itself as needing a trigram index | `AUDIT.md` "not yet done" | **[honesty]** |
| D10 | **PDF is breadth-thin.** renders ALL pages upfront (a 500-page pdf = 500 canvases — a perf cliff); TOC is "Page 1..N" (pdf.js `getOutline()` unused); no page-jump input; no cover or authors at import; zoom = full re-render; night = canvas invert | `packages/reader/pdf.ts` | **[promise]** |
| D11 | **PDF was never live-verified.** SESSIONS-0001's own next step — "pdf verification with a real research paper" — never happened; only EPUB got the golden-path live pass | `SESSIONS/0001` | **[honesty]** |
| D12 | **the reader package has zero tests.** `epub.ts`/`pdf.ts` are the product's namesake surface and the only untested source. the repagination proof ("a highlight survives a font-size change") exists at the anchor-engine level only — never proven end-to-end through a real re-render | test map | **[constitution]** |
| D13 | **the 50,000-book bar is unmeasured.** QUALITY-BAR's own headline scenario; benches stop at 10k. the grid has no virtualization — 50k book cards would kill the DOM | `bench/`, `QUALITY-BAR.md` | **[scale]** |
| D14 | **the catalyst material layer is half-landed.** glass ✓, type ✓, tokens ✓; dither ✗, grain ✗, particles ✗, motion beat-scale (page-turn 250ms ±8px, drawers 400/350, press 0.97–0.985, tooltip law, value flash) ✗ | styles + DESIGN laws | **[promise]** |
| D15 | **reading profiles don't exist** (default/night/dense/research). themes are 3; profiles were the law. no two-page spread (hardcoded `spread: none`); no explicit measure control (520–760, ideal 680) | laws vs `reader-themes.ts` | **[promise]** |
| D16 | **cover sizes drifted from law**: 160/200/240 shipped, 180/200/240 specified | design law | **[promise]** |
| D17 | **standalone notes don't exist** — plan schema had a `notes` table (locator + body, no highlight required); shipped schema folds notes into highlights only. margin-note thinking has no home | plan schema vs DOMAIN-MODEL | **[promise]** |
| D18 | **QA passes were never institutionalized.** the 6-pass (per component) and 8-pass (per app) gates, the EPUB fixture corpus (tiny/large/broken/epub2/epub3/rtl/cjk/missing-cover), B&W/squint/keyboard/reduced-motion/slow-machine — zero receipts in the repo | QA laws | **[promise]** |
| D19 | **sync (v0.2)** — operation log, per-type conflict laws, supabase + RLS, folder watching. deliberately deferred, constitutionally scheduled | CONSTITUTION v0.2 | **[deferred]** |
| D20 | **knowledge layer (v0.3)** — AI via login-with-chatgpt, context engine, two-brains + promotion gate + provenance, work/edition/asset model | CONSTITUTION v0.3 | **[deferred]** |
| D21 | **unsigned installer** — SmartScreen friction for every new user; code signing is an owner-money decision | release pipeline | **[deferred]** |

**the read:** the hardening campaign is finished — no more hardening
phases exist. what remains is (a) honesty debt on shipped surfaces,
(b) depth debt on the reader, (c) the constitutionally scheduled
layers. the order below is forced by the laws, not by taste.

---

## 2. the waves

each wave: one merge, full gates (`pnpm check` + smoke + the wave's
own proof), tagged release. nothing lands red.

### wave 1 — "the honest completion" (finish layer 1's back half)

zero schema changes, zero new packages. surface what already exists
and delete what lies.

- W1.1 **kill D1**: make the flow toggle real — `EpubAdapter` reads
  the persisted `flow` and re-opens with `scrolled` when set (epub.js
  supports both; the anchor engine is already reflow-immune, I-13).
  OR remove the control. recommendation: make it real — "optionality
  is a feature" is a law.
- W1.2 **book detail view** (D3): cover, title/subtitle, authors,
  description, publisher, language/year, format+size, progress,
  annotation counts, tags (sets up W1.5), "jump back in".
- W1.3 **collection management** (D7): rename, delete (books stay),
  unassign, reorder.
- W1.4 **settings screen** (D4): booksDir picker (path-guarded,
  migrates via reconciliation), theme, cover size, flow default,
  "check for updates" state, export diagnostics (kills D5).
- W1.5 **tags get a face or die** (D2): edit tags in the detail view,
  tag filter chips in the library bar. (if the owner vetoes tags:
  strip the schema + index — honest deletion.)
- W1.6 **reading statistics** (D6): one honest surface — this week,
  streak, total time, time-per-book, sessions sparkline. no gamified
  junk. quiet numbers, editorial typography.
- W1.7 **cover-size law fix** (D16): 160 → 180. one token.

**gate:** every screen × every state designed; 6-pass self-QA per new
component; `pnpm check` + packaged-smoke green; the state check pass
documented with receipts. est: 2–3 focused sessions. risk: low.

### wave 2 — "the reader, actually perfect" (depth before breadth)

- W2.1 **PDF quality pass** (D10): lazy page rendering (viewport-
  windowed canvas pool — renders only visible ±2 pages); real TOC via
  `pdf.js getOutline()` with fallback to page numbers; page-jump
  input; per-page zoom without global re-render; **cover + title +
  authors at import** (render page 1 → cover asset at import time;
  parse the info dict properly, not the tail-scan).
- W2.2 **PDF live verification** (D11): the real research paper pass
  — the owner drops one; it opens, reads, page-bookmarks, highlights
  when the text layer allows, exports. screenshot receipts.
- W2.3 **reading modes** (D15): real scrolled flow everywhere;
  two-page spread option; **reading profiles** (default/night/dense/
  research) as preset bundles persisted per-book-or-global (the law's
  exact wording).
- W2.4 **measure law** (D15): explicit measure (520–760, ideal 680)
  independent of window width; margins + leading within the ladder;
  the typography panel grows detents honestly.
- W2.5 **motion pass** (D14): page-turn 250ms ±8px + 0→3→0 blur;
  drawers 400/350; press 0.97–0.985; tooltip delayed-once-then-
  instant; value flash on settings changes. nothing moves without a
  reason. reduced-motion respected throughout.
- W2.6 **the reader test layer** (D12): epub/pdf adapter unit tests
  (fixture epubs + fixture pdfs in-repo) + **the repagination proof
  as an automated e2e** — create a highlight, change font size +
  flow, the highlight resolves to the same text. THE acceptance test
  the protocols gate demands.
- W2.7 **standalone margin notes** (D17): a `notes` surface on the
  book (locator + body, no highlight required), exported alongside
  highlights. small migration 003.

**gate:** repagination proof green in CI; PDF fixture corpus (1-page,
200-page, outline/no-outline, text/no-text-layer, hostile); keyboard-
only full read pass; reduced-motion pass. est: 3–4 sessions. risk:
medium (epub.js scrolled-mode + spread quirks; pdf.js lazy-render
rework).

### wave 3 — "one brain for search"

- W3.1 **unify** (D8): the library box hits the same FTS5 query layer
  as the palette. one search, two entry points.
- W3.2 **content in scope**: chapter text extracted at import
  (EPUB spine → plain text; PDF text layer → per-page) into the FTS
  index; backfill migration for existing libraries; hits jump to
  location with surrounding context in the palette.
- W3.3 **CJK trigram** (D9): migration 004 — trigram tokenizer for
  the FTS tables; CJK fixture corpus proves it.
- W3.4 result surfaces: books / highlights / notes / chapters /
  collections, typed, ranked, each with its own jump behavior.

**gate:** search p95 < 100ms at 10k books *with content indexed*;
hostile-query suite extended to content hits; CJK fixtures green.
est: 2–3 sessions. risk: medium (FTS size at content scale; the
budget is the wall — bench before/after).

### wave 4 — "the material layer" (catalyst, fully)

- W4.1 dither on cover reveals + loading; ambient grain (one shader,
  cheap, dies when reading — "reading is quiet"); particles only on
  meaningful moments (highlight creation micro-burst 4–8; book
  completion 8–18; always die).
- W4.2 **the book-card contract** (the addendum's 10 states incl.
  missing cover / long title / corrupt image / missing file).
- W4.3 **institutionalize the QA passes** (D18): the EPUB fixture
  corpus (tiny/large/broken/epub2/epub3/rtl/cjk/missing-cover) in
  repo; B&W + squint + slow-machine receipts; an 8-pass app audit
  documented per release.
- W4.4 a11y pass: contrast, focus order, screen-reader labels on
  every control, full keyboard traversal.

**gate:** QA receipts per component; a11y audit clean; particle
budget enforced (nothing ambient survives into reading state). est:
2–3 sessions, design-heavy. risk: low-median (taste, not correctness).

### wave 5 — "50,000 books, proven" (the bar's own headline)

- W5.1 virtualized book grid (windowed rendering — the DOM never
  holds more than a screen of cards); cover thumbnail cache with
  bounded LRU; list-virtualization for the notebook at storm scale.
- W5.2 the 50k + 100k bench campaign: startup, search, reconcile
  scan, import, rebuild — every QUALITY-BAR number measured at 50k on
  CI + a real machine. every regression fixed ("a budget regression
  is a bug, not a rounding error").

**gate:** 50k numbers published in PERFORMANCE.md with receipts; all
budgets green. est: 2 sessions + fix time. risk: medium (reconcile
scan at 50k is the honest unknown; mtime fast-path should carry it —
prove it).

### wave 6 — v0.2: sync (the constitutional second layer)

- W6.1 `sync_operations` + operation log; the queue never blocks a
  read or a write (offline-first law proven by test: UI responsive
  with the network dead); retry/backoff; tombstones.
- W6.2 supabase: schema + RLS `auth.uid() = user_id` on every table;
  no service keys client-side; arivo identity = supabase auth
  (≠ chatgpt login, which is wave 7's AI provider).
- W6.3 conflict laws per type: progress LWW; highlights/notes
  versioned (last-writer-wins-per-field with server timestamps);
  collections preserve-both-and-surface; book files immutable,
  content-addressed, versioned.
- W6.4 folder watching auto-import (the v0.2 law): watcher +
  debounce → the existing import pipeline → reconcile.
- W6.5 calibre import: one decision + one adapter (folder scan +
  metadata map) — the owner's call whether it's in 6 or deferred.

**gate:** the conflict-injection suite (two clients, offline edits,
reconnect — every type lands per its law); kill-network-mid-sync
suite; **the portability law re-proven with sync on** (kill index,
rebuild, zero loss, sync state reconstructed); tombstone correctness
(deleting on A deletes on B, never resurrects). est: 4–6 sessions —
the biggest engineering lift in this plan; the tests are the product.
risk: high (that's why it's its own wave, after everything local is
provably done).

### wave 7 — v0.3: the knowledge layer (layer 3, the reason arivo exists)

- W7.1 work/edition/asset migration (books → works; the v0.3 shape
  DOMAIN-MODEL already documents).
- W7.2 the AI orchestrator, provider-neutral; first provider
  login-with-chatgpt (BYO account, server-side tokens, per-account
  model discovery). no keys in the client, ever.
- W7.3 the context engine: explicit context packages (selection +
  surrounding chapter + related highlights + user intent) — never the
  whole library. bounded, inspectable, logged.
- W7.4 two-brains as law: deterministic brain (search, anchors,
  stats) never hallucinates; generative output is derived, labeled,
  **promotion-gated** — nothing enters canonical knowledge without a
  user action; provenance `[ai: model, date]` carried forever,
  survives export.
- W7.5 knowledge surfaces: connections across highlights and books;
  ai-threads; notes → knowledge objects. the "annotation → thought →
  knowledge → connections" ladder the thesis names.

**gate:** promotion gate proven (no ai-originated row without a user
action in the log); provenance end-to-end; context package size
bounds enforced; **the app fully works with ai off** (local-first
re-proven). est: research-grade; multiple sessions; gated behind the
usage month by the constitution itself. risk: high (product
definition risk more than engineering).

---

## 3. the pacing law (already in the constitution — we follow it)

SESSIONS-0001's directive: **the usage month, then the annoyance log
drives v0.2.** run it now, in parallel: the owner reads real books in
arivo daily and logs friction. that log triages waves 1–3 and may
reorder W2 items (if the annoyances scream about X, X jumps the
queue). the constitution's own law, not a nice-to-have.

## 4. decisions for the owner (only these matter)

1. **wave order** — laws force honesty-first (wave 1). veto: you can
   pull wave 2 (reader depth) ahead of 1.3–1.6 if you want.
2. **tags** — give them a face (recommended) or delete them from the
   schema honestly.
3. **content search scope** (W3.2) — chapters in FTS now, or
   annotations-only until sync ships? (recommendation: now — it's the
   constitution's own scope, and the bench is the guardrail.)
4. **calibre import slot** — wave 6 or later.
5. **code signing** (D21) — an ~$100–500/yr decision that kills the
   SmartScreen wall; pure owner call, whenever you're ready.
6. **reading profiles** — confirm the four (default/night/dense/
   research) or reshape.

## 5. what i recommend fires first

**wave 1, whole.** it's pure honesty debt: every item surfaces work
that already exists or deletes a lie, no schema risk, and every one
of them is a constitution violation living in the shipped app today.
2–3 sessions to a v0.3.0 tag. then wave 2 while the usage month runs.

---

status: PLAN MODE. awaiting fire.

---

## execution log (this file travels with the repo now)

- **wave 1 — the honest completion: DONE** (branch campaign/experience-v0.3)
  - D1 flow placebo KILLED: EpubAdapter honors settings.flow — the switch
    recreates the rendition at the same cfi, marks re-rendered; live-verified
    in the dev loop (overflow geometry + persistence evidence)
  - D16 cover law: s = 180
  - D3 book details view: drawer from the book menu — cover, subtitle,
    description, publisher/year/language/format facts, mark counts,
    jump-back-in
  - D2 tags have a face: editor in the detail drawer + filter chips in the
    library bar; store.setBookTags dual-writes (metadata.json first)
  - D7 collection management: rename (double-click or context menu), delete,
    unassign via the detail drawer's list membership
  - D4 settings screen: library folder (validated at pick, applied at next
    launch — no live split-brain), reading defaults, diagnostics export
  - D5 diagnostics has a face: summary + export button in settings
  - D6 reading life: sessions.stats (total / week / streak / 14-day bars /
    time-per-book) — finished sessions only, honest
  - tests: +9 (store dual-write proofs, index-death proofs, schema attacks);
    full check green at 170 passed / 2 skipped
- next: wave 2 (reader depth: PDF quality, reading profiles, measure law,
  motion pass, reader test layer, standalone margin notes)
- **W2.7 margin notes: DONE** (4d27319) — migration 003, dual-write,
  search, export, notebook composer; live-verified compose→reload
- **W2.6 (partial) the repagination proof: DONE live** (65413b8) — and
  it found a real shipped bug: highlights never painted (marks-pane
  classList.add rejects multi-class strings; our catch swallowed it).
  fixed: single-token classes + svg fill via READ_CSS; pdf colors too.
  proof: font 18→24, flow switch, reload — mark + cfi stable.
  session log: docs/SESSIONS/0002-wave-one-and-notes.md
- **the reconciliation: DONE** (04e9205, 2b8aae7, bdf885c) — axs/world
  (L8+L9) and the v0.2.2 feature line merged into one main; two
  live-found bugs fixed (the unclickable selection menu — z-under-scrim;
  stale mark geometry on font change). 331/2 skipped green, live
  evidence m001-m008. session log:
  docs/SESSIONS/0003-the-great-reconciliation.md
- **W2.1 + W2.2 pdf substrate: DONE** (this commit) — lazy windowed
  rendering (12-page fixture = 3-5 canvases, not 12; the 500-canvas
  cliff is dead), real outline TOC + page jump + outline-driven
  chapter labels, zoom that re-renders only the visible window and
  keeps the reading spot, plain-language failures, info-dict import
  (authors/description via the /Info object reference, never an
  outline item's /Title). the reader package got its first tests
  (pdf-logic 24 + fixture 5). D11 closed: the first live pdf proof
  ever — open → mark → save → reopen → restart at the exact page, 3
  live bugs found+fixed+lawed (flex-collapse, silent relocation, ghost
  text layer). 370/2 green. session log:
  docs/SESSIONS/0004-pdf-substrate.md
- **W2.3 + W2.4 core: DONE** (this commit) — reading profiles as
  derived preset bundles (default/dense/research; night reshaped into
  orthogonal lighting — no hidden coupling), leading + measure ladders
  (the 520-760 law, ideal 680) as live settings with panel detents,
  dual page as a true layout state (two measures side by side,
  viewport-decided, honest single-column fallback), and every
  repaginating change through the proven controlled re-render path —
  marks + position survive everything. 380/2 green (+10 profile-law
  tests). one false alarm honestly spent (wrong-document mark queries —
  the 0003 lesson, re-learned with receipts). session log:
  docs/SESSIONS/0005-profiles-measure-dual-page.md
- **W2.5 + W2.6: DONE** (this commit) — the page-turn beat (8px drift +
  3px blur, one --dur-turn long, twin-collapsed under reduced motion;
  live-proven in both directions) closes motion's true gap — the L3
  runtime already owned the rest of the vocabulary. the campaign's four
  named bugs became permanent regression laws (menu z-layer, single-
  token annotation classes, the complete repaginates trigger, the
  gitignored seed path). 385/2 green. session log:
  docs/SESSIONS/0006-motion-and-regression-laws.md
- **WAVE 2 CLOSED**: the reader substrate is first-class on both
  formats. next: L10 Desk.

## execution log — L10 (the desk becomes a workbench)

- **L10: DONE** (this commit) — the five attention modes live as
  instruments, not routes: READ/MARK kept sacred (the attention law
  untouched, regression 6), the workbench drawer hosts RESEARCH/MAKE/
  REFLECT (one DeskDoc entity, three kinds, sourceRefs carrying
  provenance — quote + locator + origin). the mark menu gained
  question (a margin note that asks) and collect (the MARK→RESEARCH
  bridge). THE PERSISTENCE CONTRACT is a real state machine
  (DraftEngine: draft/saving/saved/modified/error/recovered) — every
  keystroke mirrors synchronously, confirmation retires the mirror, a
  death mid-write resurrects as recovered and the text reaches the
  display. migration 004 (desk_docs + notes.question) follows the
  dual-write law; rebuild survives index death; v3→v4 proven in place.
  three live-found bugs fixed + lawed (recovered-text display, the
  stale-snapshot duplicate doc, the seed that un-skipped the real-book
  test — regression 4 caught it live a third time). 414/2 green.
  session log: docs/SESSIONS/0007-desk-the-workbench.md
- next: L11 Archive — provenance-first (artifact → note → selection →
  chapter → book), then presentation.

## execution log — L11 (the archive becomes evidence)

- **L11: DONE** (this commit) — the archive's object model + provenance
  first, presentation only where it earned its keep: ArchiveEntry grows
  to note (questions flagged) + deskdoc (kind, title, snippet,
  sourceRefs — the artifact → note → selection → chapter → book chain),
  the ledger joins all four families in one pass per family, and the
  room's cards return into the desk exactly (book + mode + workbench +
  the document). 1,000-object pass tested; content-visibility carries
  the ledger at scale. NOT a graph, NOT a dashboard — the zip's own
  law. 417/2 green. session log:
  docs/SESSIONS/0008-archive-evidence.md
- next: L12 — creative graphics, semantic jobs only.

## execution log — L12 (the effect registry)

- **L12: DONE** (this commit) — the gatekeeper's ledger shipped: every
  live effect carries a written contract (purpose/budget/twin/fallback/
  failure) in docs/EFFECTS.md, enforced by 8 executable laws. the real
  holes fixed: glass's missing @supports failure path (readable solid
  instrument without backdrop-filter), the scrim's raw blur(6px) →
  --scrim-blur token. the design-law gates caught the fixes' side
  effects and were sharpened (laws intact). nothing new was added —
  the first shipped act of the effect gatekeeper is a documented NO.
  425/2 green. session log: docs/SESSIONS/0009-effect-registry.md
- next: L13 — content/voice audit.

## execution log — L13 (the voice becomes law)

- **L13: DONE** (this commit) — the sweep found the voice already
  honest (zero banned vocabulary in user-facing strings); the real
  gaps fixed: plainError (lib/voice.ts) is the only error translator
  (coded errors speak, parser internals never do — both leak points
  closed + lawed), the archive's error state gained its way out, and
  VOICE_NOUNS fixes the dictionary. 5 executable voice laws. 430/2
  green. session log: docs/SESSIONS/0010-voice-becomes-law.md
- next: L14 — accessibility/responsive.

## execution log — L14 (the keyboard is a first-class reader)

- **L14: DONE** (this commit) — four inputs had invisible keyboard
  focus (lawed: outlines are replaced, never removed); the title
  input's ring-killer fixed; drawers bounded by their viewport (live
  at 480px: zero overflow); the keyboard golden path proven live
  (tab → enter → rail → modes → escape); the shell's responsive
  identity verified (labels leave, furniture persists); 6 a11y laws.
  436/2 green. session log: docs/SESSIONS/0011-keyboard-first.md
- next: L15 — performance/reliability at scale.

## execution log — L15 (measured, not vibes)

- **L15: DONE** (this commit) — the bench extended with the new
  surfaces: desk doc write 0.6ms, the archive ledger 312ms @10k-scale
  (50,100 objects, budget 2s — green with headroom); the renderer at
  5,000 objects: 61fps scrolling, the containment law's extreme proof
  (8 cards render at the bottom of a 709k-px ledger). the leak sweep
  found one: mock blob urls on removal — revoked now. the 5k mount
  cost is measured + documented (virtualization deferred until real
  libraries justify it). 436/2 green; REPORT.md regenerated.
  session log: docs/SESSIONS/0012-measured-not-vibes.md
- next: L16 — design QA.

## execution log — L16 (attack the system)

- **L16: DONE** (this commit) — the seeded-violation proof extended to
  every new law family (voice, a11y, effects — each checker proven to
  catch); the state audit's honest assertion lawed (focus is a
  foundation, not a per-class patch; each family owns its hover — one
  real gap found + fixed on the archive card button); authored
  empty/error/loading states verified across every surface; the
  capture matrix (den×3 lights + lab×2) VLM-read clean. 446/2 green.
  session log: docs/SESSIONS/0013-attack-the-system.md
- next: L17 — optical correction.

## execution log — L17 (the perceptual pass)

- **L17: DONE** (this commit) — measured geometry (icons perfectly
  centered; the rail was 2px into the bottom chrome — fixed to 12px
  clear) + the real correction: the reading column YIELDS to the
  workbench (a 200px transform slide, never a reflow — the place is
  sacred, lawed) and the documented sub-1306px exception. pdf pages
  yield identically. VLM-verified clean. 447/2 green. session log:
  docs/SESSIONS/0014-the-perceptual-pass.md
- next: L18 — final art direction.
