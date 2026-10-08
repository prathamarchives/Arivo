# session 0005 — reading profiles, the measure, and the dual page (W2.3 + W2.4 core)

> starting commit: 35c7565 (W2.1+W2.2 landed)
> branch: campaign/experience-v0.4

## objective

W2.3: reading profiles as honest preset bundles, dual page as a true
layout state, and the geometry invariant — no layout change may destroy
position, marks, or progress. W2.4's core landed with it: the measure
law (520–760 ladder, ideal 680) as an explicit setting, the leading
ladder, detents in the panel.

## what changed

**core/types.ts** — `ReaderSettings` grew `lineHeight` (value ladder
1.5 / 1.65 / 1.8), `measure` (px ladder 520 / 620 / 680 / 760), and
`pageMode` ('single' | 'auto'). `READING_PROFILES`: default
(18px/1.65/680/paginated), dense (16px/1.5/760/paginated), research
(20px/1.8/520/scrolled). **the profile is derived, never stored**:
`activeProfile()` lights a chip only on exact match — one nudged field
is honest divergence, not a stale mode. the register's fourth name
('night') is reshaped into what it always was: night lighting on any
profile (lighting stays orthogonal — no hidden coupling). per-book
overrides remain deferred (global settings are the law's letter today).

**epub.ts** — every repaginating change (flow, font, leading, measure,
pageMode) now takes the proven controlled path: destroy + recreate the
rendition at the current locator, marks re-rendered. the spread is
`'auto'` only when pageMode is auto AND flow is paginated
(minSpreadWidth 800). the leading rides into the iframe as
`--ar-leading` next to the theme vars.

**reader-themes.ts / app.css** — READ_CSS body leading is
`var(--ar-leading, 1.65)`; the epub container is
`max-width: var(--ar-measure, 680px)` — and in dual-page mode two
measures side by side (`calc(2 × measure + s6)`), still
viewport-decided. this is W2.4: the reader expands around the page; the
page never stretches to a billboard.

**Reader.tsx / Settings.tsx** — the typography panel: profile chips
(derived active), size steps, leading chips, measure detents, flow, and
the page row (one page / two pages — hidden in scrolled flow, said
plainly by absence). the settings screen's reading section gained the
same profile row. `data-page-mode` rides the reader root for the css.

**ipc-schemas** — the settings contract grew the three fields with
ladder bounds (leading 1.5–1.8, measure 520–760 int, pageMode enum).

## verification

- **P2**: typecheck + lint clean; **380 passed / 2 skipped** (+10:
  profiles.test.ts — ladder closure, distinct bundles, derivation
  truth, orthogonal theme/pageMode, nudge-divergence; ipc schema
  attacks for the new fields).
- **P3 live** (dev:web + agent-browser + the synthetic seed): select
  (real mouse drag) → yellow → mark painted (376×24 svg rect in the
  `.epub-view` wrapper — the correct query, see below) →
  - dense: container 760, font 16px, leading 24px, chip 'dense', mark
    re-painted at fresh geometry, position held
  - research: container 520, font 20px, leading 36px, continuous
    scroll (one tall iframe), mark intact
  - dual page: two visible text columns, VLM-confirmed "two distinct
    vertical blocks side-by-side resembling an open book spread"
  - reload: settings + mark + chapter all restored, dual page
    re-engaged
  - small viewport (700px): honest single-column fallback, mark intact
  - one nudged field (leading 1.8): no profile chip lit — divergence
    is visible, never a stale mode
  - screenshots w23-1…w23-5

## the false alarm (an hour, honestly spent)

mid-verification the epub marks "stopped painting" — at my own W2.1
commit AND at 23130cc, with synthetic and real books. bisect + vite dep
patching + console capture later, the truth: **the marks were painted
all along**. my queries were wrong twice over — `.marks-pane` is not
the selector (marks-pane's Pane element never carries that class), and
the svg lives in the TOP document's `.epub-view` wrapper, not the
iframe. session 0003 recorded this exact lesson ("wrong-document
queries cost an hour") — and I re-learned it. it stays in this record
because the lesson clearly needs two receipts. the lasting rule: **epub
mark assertions query `document.querySelectorAll('.epub-view rect')`;
pdf assertions query `.pdf-hl` divs.**

en-route real finding: dual page initially could not engage — the
container was capped at one measure, so epub.js (correctly) never
spread. fixed: the container expands to two measures in dual mode.
that was the only code change this session born from live truth.

## honest limits

- dual columns on a 1280px viewport render ~500px per column (the
  viewport caps the two-measure ideal of 680); wide screens reach the
  full measure. viewport-aware, by design.
- epub.js ignores spread in scrolled flow; the page row hides there
  rather than lying.
- the chapter-tie artifact from session 0004 (container label vs
  deepest child) is unchanged; L17's ledger.
- per-book settings remain global-only (the register's "per-book or
  global" satisfied on its global letter; the per-book half is a
  schema+ui decision for a later wave).

## next

W2.5 motion pass, W2.6 golden-path harness, then L10 Desk.
