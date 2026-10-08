# session 0004 — the pdf substrate becomes first-class (W2.1 + W2.2)

> starting commit: 23130cc (the reconciled main, 331/2 green)
> ending commit: (this commit)
> branch: campaign/experience-v0.4

## objective

the campaign's wave 2 opener: make pdf a first-class reading substrate
instead of an auxiliary viewer (D10), and prove it live — open → read →
mark → save → close → reopen → restart (D11, never done before this
session). the reader package also got its first tests ever (D12's pdf
half).

## what changed

**packages/reader/src/pdf-logic.ts (new)** — the substrate's pure laws,
extracted so they are testable without a DOM: page clamping, target
parsing (`page:N`), the render window (current ± 2), zoom ladder
(fit-width / fit-page / numeric, 0.5–4, 1.25 steps), outline → chapter
tree mapping with unresolvable-destination dropping, page-sorted leaf
flattening, chapter-for-page lookup, plain-language pdf.js error
mapping, and normalized (0-1) anchor rect math.

**packages/reader/src/pdf.ts (rewritten)** —
- lazy rendering: every page is a sized placeholder; only the window
  around the current page holds canvases + text layers (a 12-page
  fixture renders 3–5 canvases; the old path rendered all 12 — a
  500-page pdf was 500 canvases). pages leaving the window give back
  their pixels and keep their geometry + painted marks.
- the real outline: `getOutline()` + destination resolution →
  hierarchical `ChapterNode` tree; flat "Page N" is now the fallback,
  never the ceiling. progress chapter labels come from the outline
  (nearest heading at or before the page).
- zoom re-renders only the visible window, cancels in-flight page
  renders, and keeps the reading spot anchored (ratio-preserving
  scroll restore). fit modes track window resizes; explicit zooms are
  the reader's own geometry.
- page-jump: `display('page:N')` from the drawer's new page input.
- failures speak plainly: password-protected / damaged / unreadable /
  no-pages each get a sentence, not a stack trace. per-page render
  failures mark the page (`N — failed`), never a silent hole.
- teardown through the loading task (v6 removed `doc.destroy`).
- selection now carries a viewport rect so the menu positions at the
  passage, not screen center.

**packages/documents/src/inspect.ts** — pdf import reads the `/Info`
object precisely (via the trailer's `/Info N 0 R` reference — outline
items also carry `/Title` and must never be mistaken for the
document's). authors (semicolon-split) + subject (description) joined
the title. no info dict → filename stays the honest title.

**apps/desktop (Reader.tsx + app.css)** — the contents drawer gained
the hierarchical outline (children indented, `--s2` per depth) and a
page jump input (`of N pages`); the type panel gained a zoom stepper
(− / readout / +) with active fit-mode chips; keyboard `+`/`-` steps
zoom for pdf (font steps for epub); the duplicate zoom icon button
was removed (the type panel owns it). css: pending pages carry a
quiet paper sheet (inverted in night), failed pages say so.

**test-fixtures/fixture.pdf (new, committed)** — a deterministic
12-page letter pdf with real selectable text, a real outline (2 parts,
2 chapters), and an info dict — written byte-by-byte by
`scripts/make-pdf-fixture.mjs` (no generator dependency). the pdf twin
of fixture.epub.

## verification

- **P2 engineering**: typecheck clean, lint clean, **370 passed / 2
  skipped** (was 331/2; +39: pdf-logic 24, pdf-fixture 5+1, inspect 4,
  design-law +2 substrate laws).
- **P3 live** (dev:web + agent-browser + the fixture): import → open
  (3 canvases for 12 pages) → real outline drawer → page jump →
  select → menu → blue highlight painted on page 2 → zoom ladder
  (fit-width/fit-page/125%/156%) → scroll → chapter label follows the
  outline (Part One → Part Two) → margin note at position → night →
  reload → **reopened at page 10, 81.8%, mark + note restored, window
  centered 8–12**. screenshots w21-0…w21-8.
- **P4 adversarial**: corrupt pdf (garbage bytes, .pdf extension) →
  "this book won't open — this file is damaged — it is not a readable
  pdf" with a way back; rapid zoom (9 clicks, no waits) → bounded
  canvases, marks intact; viewport resize during explicit zoom →
  stable geometry by design.
- **P5 creative (VLM-read)**: paper render + night reviewed. one real
  artifact found: the text layer's 0.2 opacity ghost-doubled the
  canvas glyphs. fixed: the layer is now a fully transparent selection
  proxy with amber `::selection` ink (the signature moment works).

## bugs found → fixed → lawed

1. **collapsed pending pages** — column-flex scrollers shrink
   auto-min-height items to zero; placeholders (only absolutely
   positioned children) collapsed to 0px, wrecking scroll geometry.
   the old render-all-upfront code masked this for years. fix:
   `flex-shrink: 0` on `.pdf-page`. now a design-law test.
2. **silent initial relocation** — `display()` set `currentPage`
   before the scroll handler's change-guard, so opening a book never
   emitted position/percent (0% + empty chapter until first scroll).
   fix: `emitProgress()` is the one writer; display/jump/scroll all
   speak it.
3. **ghost text** — see P5 above. the selection proxy is not ink.
   now a design-law test.
4. en route: the fixture generator's first drafts had plain-dict
   content streams (pdf.js parsed zero operators) and cumulative `Td`
   lines (text ran off-page); both fixed by stream-wrapping +
   per-line `Tm` placement. the fixture is proven by its own test.

## honest limits (recorded, not hidden)

- the chapter label at a page where two headings coincide shows the
  container (Part One) rather than the deepest child — tie-break is
  alphabetical, not depth-aware. cosmetic; noted for L17.
- pdf cover extraction at import remains unimplemented (no xobject
  mining) — pdfs keep the typographic book object.
- the web mock's import validates extension only; the real electron
  pipeline's header validation is covered by inspect tests, not live
  (the packaged smoke owns that path).

## remaining debt from this wave's register

D10 closed (pdf breadth: lazy render, outline, jump, zoom, metadata,
errors). D11 closed (the live proof, first time ever). D12 half-closed
(pdf-logic + fixture tests; the epub adapter's DOM paths remain
live-proven only). next: W2.3 reading profiles + dual page, W2.4
measure law, W2.5 motion, W2.6 golden-path harness.
