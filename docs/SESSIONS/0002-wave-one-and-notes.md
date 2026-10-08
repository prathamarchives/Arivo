# session 0002 — wave 1 + margin notes + the repagination proof

branch: `campaign/experience-v0.3` (from `1a45778`, v0.2.2)
commits: `3e6652e` (wave 1) · `4d27319` (margin notes) · `65413b8`
(repagination proof + the highlight paint fix)

## what this session proved

### wave 1 — the honest completion (MASTER-PLAN debt D1–D7, D16)

- **D1 the flow placebo is dead.** `EpubAdapter` honors `settings.flow`:
  the rendition is recreated at the exact cfi when flow changes, marks
  re-render, the position is preserved. settings land BEFORE the first
  render (boot order fixed). live-verified: paginated ↔ scrolled
  round-trip, overflow geometry + persistence evidence.
- **D3 book details view.** drawer from the book menu: cover, subtitle,
  description, publisher/year/language/format facts, mark counts,
  jump-back-in.
- **D2 tags have a face.** `setBookTags` dual-writes (metadata.json
  first, index second); editor in the detail drawer; filter chips in the
  library bar. tags survive index death (proven by test).
- **D7 collections are whole.** rename (double-click or context menu),
  delete, unassign via the detail drawer's membership chips.
- **D4/D5 settings exists.** library folder (validated at pick, applied
  at next launch — the live-root switch was a latent split-brain, now
  structurally impossible), reading defaults, diagnostics summary +
  export.
- **D6 the reading life.** `sessions.stats()`: total / week / streak /
  14-day bars / time-per-book, from finished sessions only. one honest
  surface, no gamification.
- **D16 cover law.** s = 180.

### D17 — margin notes (`4d27319`)

thinking attached to a place, no highlight required. migration 003
(`notes` table + `notes_fts`, delete cascade), tolerant truth read
(pre-003 `annotations.json` parses unchanged), notes in rebuild/search/
export, the notebook composer (anchored at the current position), note
cards with jump/edit/remove. live-verified: compose → persist → reload
→ restored.

### D12 (partial) — the repagination proof + A REAL SHIPPED BUG (`65413b8`)

**the found bug:** highlights never painted in the reader. marks-pane
applies the annotation class via `classList.add` — a single token; our
multi-class string threw `InvalidCharacterError`, the adapter's catch
swallowed it, and the mark silently never rendered. the v0.2.2
"highlights work" claim covered persistence + the notebook — the visual
painting was broken all along. **the fix:** one class token per mark;
the color is the svg `fill` through READ_CSS (css overrides
presentation attributes; rects inherit). the pdf twin got its colors
too (they were never styled).

**the proof (live, evidence `docs/screenshots/w26-repagination-proof.png`):**
select → highlight → paint · font 18→24px → mark survives, cfi stable ·
flow paginated→scrolled → mark re-renders at fresh geometry, cfi stable ·
full reload → mark + flow + font all restored.

## verification state

- `pnpm check` green: typecheck, lint, **177 passed / 2 skipped** (161
  baseline + 16 new: dual-write proofs, index-death proofs, hostile
  schema attacks, migration 003 chain, note search revival)
- live dev-loop verification with screenshots for: flow round-trip,
  tag editor, settings, book detail, margin note, repagination proof

## found-not-fixed (honest register)

- epub.js font-size changes reflow the text without re-rendering the
  view, so svg mark geometry is stale until the next re-render (page
  turn / flow switch / resize). the anchor is stable; the pixels lag.
  candidate fix (next wave): force a view re-render on font change.
- the epub mark's `fill-opacity: 0.75` + `mix-blend-mode: multiply` is
  visually close to spec but not optically tuned (L17's job).

## blocked (external)

- `git push` — no credentials in this sandbox (the previously pasted
  PAT was revoked, correctly). branch + commits are local; the owner
  pushes or supplies a token.

## next (wave 2 remainder)

W2.1 pdf quality (lazy render, real toc, page jump, import metadata) ·
W2.2 pdf live verification · W2.3 reading profiles + two-page spread ·
W2.4 measure law · W2.5 motion pass · W2.6 remainder (adapter unit
tests, the e2e as a CI-runnable harness)
