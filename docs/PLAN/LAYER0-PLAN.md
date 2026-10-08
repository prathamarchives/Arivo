# arivo — layer 0 plan (extracted from the owner's ChatGPT docs, oct 3-5 2026)

> source of truth for this extraction: the three uploaded exports
> (1719 = 1733 re-export; the Branch file holds the 10/3 deep-dives
> and the final layer directive). status: PLAN MODE — nothing executed.

## the directive (the owner's final word, branch tail)

```
LAYER 0 — repo, raw base, decisions locked. solid first.
LAYER 1 — the beautiful reader: library, themes, typography,
          highlights, notes, bookmarks, search.
          perfect before anything else exists.
built by 5-6 engineering/design departments working simultaneously
with an iterative end-to-end verification loop, delivered as one
long heavy package.
```

## locked laws (extracted, verbatim where it matters)

### product
- arivo. personal software first — the owner is user zero; sellable
  later (core / cloud / intelligence / pro split; never design around
  high-ticket; sell the license, separate infra costs).
- not a prettier Koodo — a reading environment:
  book → reading → annotation → thought → knowledge → connections.
- reading = experience; the reader is the dominant surface, chrome
  disappears; everything else appears contextually.
- optionality is a feature: paginated+continuous, grid+list,
  single+two-page, reading profiles (default/night/dense/research),
  per-book or global settings.
- v1 promise: import → open beautifully → read comfortably →
  annotate naturally → organize → search → build knowledge →
  preserve → reopen without friction.

### tech
- Electron (rendering consistency beats Tauri's binary size) +
  React + TypeScript + Vite + SQLite + Electron Forge + GH Actions.
- local-first constitution: works with no account, no network, no
  Supabase; local DB is operational source; sync is a queue, never
  a blocker; tombstones; no service-role keys client-side; RLS
  `auth.uid() = user_id` on every table.
- layering: UI → application → domain → ports → infrastructure.
  repositories only; no supabase/sqlite calls inside components.
- import pipeline: validate → hash → parse → metadata → cover →
  copy into managed library → transaction → index. staged for large
  books; never half-imported; original file untouched.
- EPUB = untrusted input: contextIsolation, sandbox: true,
  nodeIntegration: false, scoped IPC, sanitized rendering.
- stable anchors: {href, cfi, progression} + selected_text +
  context_before/after → annotations survive re-import and reflow.
- sync (v0.2+): operation log + retry/backoff; conflicts per type —
  progress LWW, notes versioned, knowledge preserve-both-and-surface,
  book files immutable/versioned.
- AI (layer 3+): provider-neutral orchestrator; first provider =
  opencoredev/login-with-chatgpt (BYO ChatGPT account, server-side
  tokens, per-account model discovery); Context Engine builds explicit
  context packages (never the whole DB); AI suggests, the user promotes
  to canonical knowledge; ChatGPT login ≠ arivo identity.

### data model (v0.1 schema, small by law)
```
books            id, title, subtitle, description, language, publisher,
                 published_at, cover_path, created/updated/deleted_at
authors          id, name, sort_name
book_authors     book_id, author_id, role, position
book_files       id, book_id, content_hash, file_name, mime, size,
                 storage_path, format          (hash = identity)
reading_progress book_id, locator(json), progress, percentage,
                 started_at, last_read_at, completed_at
bookmarks        id, book_id, locator, label
highlights       id, book_id, locator_start, locator_end,
                 selected_text, color, note, chapter
notes            id, book_id, highlight_id?, locator, body
collections      id, name, description
collection_items collection_id, book_id, position
tags + junctions
sync_operations  entity, op, payload, attempt_count, status (v0.2)
reading_sessions book_id, started/ended, duration, progress delta
```
ids = UUIDv7 locally generated. soft delete everywhere. SQLite FTS5
for search (books, authors, chapters, notes, highlights, tags) →
typed SearchResult[] → ⌘K palette.

### design system (catalyst upstream + reader extensions)
- identity: "a printed object that became a piece of software."
  editorial software × physical book × modern desktop OS × subtle glass.
- materials: paper (ground) / ink (info) / glass (floating chrome ONLY:
  toolbar, palette, selection menu, drawers — 10/18/26px blur ladder) /
  light (restrained interaction response).
- dither = transformation (covers, reveals, loading). grain = ambient.
  particles = physics on meaningful moments only (micro 4-8, burst
  8-18, ambient <20, always die).
- type: app chrome = catalyst ladder; book content = its own controlled
  reading typography (16/18/20/22/24 steps, lh 1.65, measure 520-760,
  ideal 680, independent of window width).
- color: monochrome base; annotation colors are the only semantic
  layer (yellow=important, blue=question, green=connection, pink=
  striking, gray=reference), desaturated, paper-compatible.
- sizing: 4px base; spacing ladder 4..96; controls 28/32/36/40/44;
  icons 12-32 semantic; hit areas 32×32 min; covers 2:3 at
  180/200/240 (three sizes only).
- motion: catalyst beat scale (100ms press … 1400ms material sweep);
  page turns 250ms ±8px + 0→3→0 blur; drawers 400/350; press
  0.97-0.985; tooltip delayed-once-then-instant; value flash;
  nothing moves without a reason.
- interaction philosophy: physical. click responds, drag has weight,
  selection creates context, panels come from somewhere, errors explain
  themselves, destructive actions reversible. "coherent, not pretty."
- bans: no SaaS dashboard, no glass everywhere, no rainbow gradients,
  no cursor blob, no random bounce, no card-in-card, no magic numbers,
  no tilt beyond ±1.5°, no 20-item menus, no toolbar over reading text.
- QA: 6 passes per component (structure/design/interaction/motion/
  edge/consistency) + 8 passes per app (geometry/hierarchy/interaction/
  motion/content-stress/performance/a11y/code) + EPUB fixture corpus
  (tiny/large/broken/epub2/epub3/rtl/cjk/missing-cover) + B&W, squint,
  keyboard, reduced-motion, slow-machine tests.

## the reconciliations (my calls, flagged)

1. desktop, not web — the owner's 10/3 word is explicit. my earlier
   "web app + supabase" plan is dead.
2. catalyst-doc model, not 24 documents — same discipline, ~6 docs +
   AGENTS.md + machine-checkable specs, proven in catalyst.exe.
3. AI deferred to layer 3+ per the layer directive. provider interface
   stubbed in layer 0 so nothing rewires later.
4. supabase deferred to v0.2 (sync layer) per the local-first law —
   no cloud dependency on the critical path of layer 1.
5. packaging reality: full app + domain tests + renderer verification
   happen here (vite + electron + vitest + better-sqlite3). installers
   (.exe/.dmg) build on the owner's machine via `pnpm make` (forge
   config shipped) or CI. renderer-in-browser is the dev loop.
6. Work/Edition/Asset folded into books + book_files for v0.1 (the
   docs' own "first schema stays small" law); the work abstraction is
   a v0.3 migration, not a v0.1 table.

## layer 0 — what gets built (repo: prathamarchives/Arivo, currently empty)

```
monorepo (pnpm)
├── apps/desktop        electron main + preload (isolated) + forge
├── packages/
│   ├── domain          entities + repository interfaces (pure)
│   ├── database        sqlite impl + migrations + FTS
│   ├── documents       epub import pipeline + document model
│   ├── reader          reader engine adapter (epub.js behind it)
│   ├── ui              catalyst-derived design system + components
│   └── sync            stub + interface (v0.2)
├── docs/
│   ├── CONSTITUTION.md     product laws + bans + philosophy
│   ├── ARCHITECTURE.md     layering, boundaries, data flow
│   ├── DATA-MODEL.md       schema v1 + locator law
│   ├── DESIGN-SYSTEM.md    catalyst port + reader extensions
│   ├── AGENTS.md           the department + QA gates + worklog law
│   └── decisions/ADR-001..006  (runtime, local-first, storage,
│       locator, sync, epub engine)
├── supabase/           migrations + config (empty, deferred)
└── CI                  lint / typecheck / test / build
```
done = `git clone && pnpm i && pnpm dev` opens arivo (empty library
state, design system live, import pipeline stubbed).

## layer 1 — the reader, perfect

library (grid+list, search/sort, collections, currently-reading rail)
→ import (drag-drop epub → metadata+cover, transactional) → reader
(paginated+continuous, themes: paper/sepia/night, typography
controls with detents, TOC, progress, keyboard-complete, hidden
chrome) → marks (select → glass popover → 5-color highlights with
notes, bookmarks, the notebook panel, re-anchoring) → search (⌘K
palette, typed results, jump-to-location).

## the department (the owner's 5-6 simultaneous teams)

```
            ARCHITECT (me — owns contracts, merges, gates)
   ┌──────────┬──────────┬──────────┬──────────┬──────────┐
  CORE/DATA   DOCUMENTS   DESKTOP     UI/UX      TYPOGRAPHY
  domain, db,  epub pipe,  electron,  components  reading type,
  repos, FTS   anchoring   ipc, perf  interaction  themes, measure
              └──────── every workstream: build → 6-pass self-QA →
                 architect review → integration → verification →
                 repeat until the receipts pass ┘
```

## decisions for the owner (the only ones that matter)

1. EPUB ENGINE — my call: epub.js behind a documents-package adapter
   (annotations + CFI built in, fastest to layer-1-perfect; adapter
   keeps foliate-js swappable for v0.2+). veto or bless.
2. PACKAGING — forge config ships; you run `pnpm make` on your
   machine for .exe/.dmg (or we wire GH Actions CI to build both).
   windows-first or mac-first?
3. the plan package — want the "long heavy .zip" (docs + scaffold +
   ADRs) as the layer-0 deliverable to review before any feature code,
   or straight to a running app?

status: PLAN MODE. awaiting "push" — nothing executed, repo untouched.

---

# addendum — the fourth doc (the pasted lineage, oct 5)

> source: `upload/Pasted Content_1791204112319.txt` (~2,000 lines).
> this is the OTHER ai's planning line, parallel to the chatgpt line:
> 14 questions (tauri, epub-only, 13 sessions) → owner's raw answers →
> 35-department reverse-engineering tree → "master blueprint locked"
> (tauri v2, format plugins, 11 sessions) → "THE LOCKED ARCHITECTURE"
> (electron flip, three-layer product, two-brains, 12 laws).
> processed with the same 8-pass loop. everything below is what
> SURVIVES reconciliation with the plan above.

## what it confirms (both lineages agree → high confidence)
- electron over web and over tauri (the paste flips tauri→electron
  mid-history; the chatgpt line said electron from the start)
- local-first, supabase deferred to v0.2, ai deferred to layer 3+
- epub.js + pdf.js, fts5 + cmd-k, zustand domain + react interaction
- reading sessions as first-class behavioral data
- catalyst-derived design system (covers 2:3 at 180/200/240 match
  exactly; the 5-layer component law matches the 6-pass QA)

## what it adds (absorbed into the plan)
1. **law 11 — the format contract**: reader, annotations, search,
   progress speak ONLY to the plugin interface
   (parse/render/locate/extractAnchor/resolveAnchor/search/
   getChapterList/getProgress). no format-specific code above
   `packages/documents`. a new format = a new plugin, never a fork.
   lives in the documents package + ADR-007.
2. **universal anchor, sharper naming**: anchor = primary (cfi /
   page+offset) + textRange {exact, prefix, suffix} + position
   {chapter, percent}. resolution outcomes are UI states:
   resolved / drifted / orphaned — never silent loss, drift is
   visible and honest. drift + orphan become reader UX states.
3. **two brains as constitutional law**: deterministic brain never
   hallucinates; generative output is always derived, labeled, and
   promotion-gated; accepted items carry provenance
   `[ai: model, date]` forever. goes into CONSTITUTION.md.
4. **the repagination proof test** (session 5's ship criterion):
   a highlight survives a font-size change. this becomes THE
   acceptance test for the anchor engine in AGENTS.md QA gates.
5. **empty states are product moments**: first-run library = arivo's
   "hello" — same design care as hero screens.
6. **book-card contract** (anatomy, 10 states, motion, a11y,
   failure cases incl. missing cover / long title / corrupt image)
   folds into the ui package's component contracts.
7. **constitution v2 merge**: the 12 laws (local-first, two brains,
   portability, anchor contract, promotion gate, experience before
   intelligence, work model, domain purity, closed vocabularies,
   reading is quiet, behavior is data, nothing paywalled the user
   made) + the existing design bans = one CONSTITUTION.md.

## my architect calls (the conflicts, resolved — flagged for veto)
1. **truth direction** — the paste says filesystem is truth, sqlite
   rebuildable; the chatgpt line said local db is operational
   source. synthesis (three roles, no conflict): **json = durable
   truth** (annotations + metadata per book, write json FIRST),
   **sqlite = operational index** (fast path + fts + telemetry,
   rebuild command restores it from json), **cloud = optional
   mirror** (v0.2). sessions/events/fts are telemetry — sqlite-only
   in v0.1, loss tolerable, jsonl mirror later if it matters.
2. **index.db location** — os app-data dir, NOT inside ~/Arivo/
   (users will dropbox the library folder; a cloud-synced sqlite
   file corrupts). ~/Arivo/ holds only sync-safe formats:
   epubs, covers, json.
3. **forge stays** (over the paste's electron-builder) — makers
   cover dmg/msi/appimage for v0.1; electron-builder is the v0.3+
   option if auto-update ever demands it.
4. **pdf is in v0.1** (owner's explicit word: "epub/pdf or any
   possible type") — but LAST (session-8 slot, after the epub
   golden path is perfect) and fixed-layout only: render, zoom/fit,
   navigate, page bookmarks, text-layer highlights when the text
   layer exists. scanned pdfs (no text layer) = page bookmarks
   only, stated honestly. no reflow.
5. **folder-watching auto-import → v0.2** (the paste called it
   "cheap and magical" — it's watchers + debounce + pipeline-on-
   random-drop; not cheap on top of v0.1). drag-drop covers the
   golden path.
6. **the 35-department tree = a review checklist, not an org
   chart**. "send swarms into each branch" = 35 parallel agents =
   integration hell. the 5-6 departments + architect gate stay.
   each of the 35 becomes a question asked during review, not a
   team that builds.
7. **work/edition/asset is already structurally satisfied** by the
   v0.1 schema: books = work, book_files = editions/assets,
   annotations hang off books. one row per work, files per edition
   under it. the full model (knowledge objects, ai threads) is
   documented as the v0.3 target shape in DATA-MODEL.md, built
   only after the usage month.
8. **phase 2/3 (brain + companion) are direction, not commitment**
   — the doc's own law (experience before intelligence) + the
   owner's own pacing ("very very very side project") gate them
   behind a usage month. no knowledge tables in v0.1.

## the golden path (unchanged, now proven twice)
download → pick folder → drag epub in → cover + metadata appear →
open → read beautifully → select → highlight + note → close →
reopen → same spot, highlights intact → export markdown reading
notes. plus: a pdf opens, reads, page-bookmarks, highlights when
the text layer allows. a highlight survives a font-size change.

## owner decisions still open
1. epub engine — epub.js behind the adapter (bless/veto)
2. packaging — windows-first or mac-first; `pnpm make` locally vs
   gh actions ci
3. layer-0 deliverable — docs+scaffold zip for review, or straight
   to a running app
4. (new, minor) pdf slot at session 8 — confirm or push to v0.2

"the sends still own the day. fire when ready." — awaiting fire.
