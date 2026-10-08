# the reader system — shipped behavior

two substrates, one contract. the book is the source; everything
geometric serves it. this documents what ships, mechanism first.

## the format contract

reader, annotations, search, and progress speak only to the
`FormatReader` interface (`packages/reader`). no format-specific code
exists above that package — enforced by `tests/architecture.test.ts`
and eslint. a new format is a plugin, never a fork (ADR-003).

| | epub | pdf |
|---|---|---|
| engine | epub.js 0.3.93 behind `EpubAdapter` | pdfjs-dist v6, canvas + text layer |
| flow | paginated / scrolled (setting) | fixed layout, vertical scroll |
| anchor | CFI primary + textRange fallback | `{page, offsets, rects}` normalized |
| themes | `<style>` per rendered section (epub.js's css-string path is broken — ADR-004) | css on chrome; canvas inversion in night |
| fonts | data-embedded @font-face (blob iframes don't inherit) | ui fonts only |

## geometry — the invariant

**any geometry-changing action preserves valid source position and
re-renders annotation geometry.** this is the law the campaign's worst
bugs broke, and each is now an automated regression
(`tests/regression-laws.test.ts`):

- font size / leading / measure / flow / page-mode changes take the
  controlled **destroy + recreate at the current locator** path; marks
  re-render at fresh geometry (the stale-geometry bug, dead twice)
- zoom re-renders only the visible pdf window, cancels in-flight page
  renders, and keeps the reading spot ratio-anchored
- `emitProgress()` is the one writer of position/percent — the silent
  initial relocation bug (0% until first scroll) is lawed away

## the pdf render window

every page is a sized placeholder; only current ± 2 hold live canvases
+ text layers. a 12-page document renders 3–5 live canvases during the
verified golden path; a 500-page pdf is never 500 canvases. pages
leaving the window return their pixels and keep geometry + painted
marks. the placeholder law: `.pdf-page` is `flex-shrink: 0` (a
regression caught live when lazy rendering collapsed placeholders to
0px).

## reading profiles (derived, never stored)

`READING_PROFILES` in `packages/core`: default (18px / 1.65 / 680 /
paginated), dense (16px / 1.5 / 760), research (20px / 1.8 / 520 /
scrolled). the active chip lights only on exact match — one nudged
field is honest divergence, never a stale mode. lighting (paper /
sepia / night) is orthogonal to profile. leading and measure are
ladders (1.5–1.8; 520–760, ideal 680) enforced at the ipc schema.

## the page modes

- single / auto ('dual'): the container expands to two measures
  (`calc(2 × measure + s6)`, minSpreadWidth 800) — the page never
  stretches to a billboard; the reader expands around it
- dual page hides in scrolled flow (epub.js ignores spread there) —
  absence, not a lie
- page turn: 8px drift + 3px blur at `--dur-turn`, twin-collapsed
  under reduced motion; the turn still turns (state, not animation)

## annotations, both substrates

- selection → the menu (five highlight colors, note, question,
  bookmark, collect, copy) — the menu sits at `--z-overlay` beside its
  own scrim (the beneath-scrim unclickability bug, lawed)
- epub marks paint as svg rects in `.epub-view` in the top document;
  pdf marks are `.pdf-hl` divs at normalized rects — each is
  single-class, repagination-triggered (the multi-class failure law)
- the anchor engine resolves drift: primary → text → position →
  visible orphan; a highlight surviving a font change is the test
- questions are margin notes with `question: true`
- collect (MARK → RESEARCH) drops quote + locator + origin into the
  open research document

## position and restart

closing writes reading position (locator / page + percent + chapter)
through the dual-write path; reopening a book restores the exact spot
— live-proven for both substrates (reopen at page 10, 81.8%, marks and
notes restored; epub at its CFI with marks re-painted).

## failures speak plainly

password-protected / damaged / unreadable / no-pages each get a
sentence and a way back; per-page render failures label the page
(`N — failed`), never a silent hole. the text layer is a transparent
selection proxy with amber `::selection` ink (the ghost-glyph bug,
lawed) — the selection signature works without doubling the canvas.

## honest limits (documented divergences)

- pdf cover extraction at import is unimplemented (no xobject mining)
  — pdfs keep the typographic book object
- the pdf chapter label at coincident headings shows the container,
  tie-break alphabetical (cosmetic, L17's ledger)
- per-book settings are global-only today; per-book overrides are a
  schema+ui decision for a later wave
