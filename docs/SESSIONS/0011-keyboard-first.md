# session 0011 — the keyboard is a first-class reader (L14)

> starting commit: 2599dd8 (L13 landed, 430/2 green)
> branch: campaign/experience-v0.9

## objective

L14 — the accessibility/responsive campaign: keyboard navigation,
visible focus, SR labels, drawers/menus/tools, small viewports, large
zoom — "not cosmetic CSS alone".

## what the audit found (and fixed)

**four inputs had invisible keyboard focus.** the search field, the
note composer's textarea, the palette input, and the tag input all
carried `outline: none` with no replacement — a keyboard user landing
there had no idea where they were. fixed: each gains a
`:focus-visible` rule with the same visible pattern the design
system's own inputs use (ink-2 border + selection shadow). the law
now forbids the pattern: an outline may only be replaced, never
silently removed — a resting rule may clean it only if a
`:focus-visible` sibling restores a visible indicator.

**the desk's title input killed the universal ring** (`.doc-title-
input:focus { outline: none }` out-specified the foundation's
`:focus-visible`). fixed: the rule keeps only its border emphasis; the
foundation ring shows.

**drawers could exceed small viewports** (fixed 320px/400px widths).
fixed: `min(320px, 100%)` / `min(400px, 100%)` — live-verified at
480px: the workbench drawer fits exactly, zero overflow, the mode
rail's right edge lands at 429px.

## what was already true (verified live)

- the foundation `:focus-visible` rule exists in base.css — every
  interactive element gets the ink ring (verified: computed `solid 2px
  rgb(43,33,24)` + 2px offset on a focused book button)
- **the keyboard-only golden path**: Tab through the shelf → Enter
  opens the book (desk + 5 mode chips) → Tab reaches the mode rail →
  Enter switches the mode (mark) → Alt+3 → the research workbench →
  Escape → drawer closed, mode back to read. every step reachable,
  every exit works
- the shell's responsive identity: at ≤1043px the rail goes slim —
  labels leave, the furniture (structure) persists — never a
  disappearance
- the reduced-motion twins: the foundation collapses the whole
  duration ladder (design-law tested); the files defining motion
  beyond tokens carry their own twin blocks
- SR labels: the mode rail is a toolbar, the drawers name themselves
  (`research workbench`), the archive groups label their days, every
  IconButton carries its aria-label

## the law

`tests/accessibility.test.ts` (6 laws):

1. the foundation focus rule exists (ink ring, token-based)
2. outlines are replaced, never silently removed (with the twin-block
   pattern recognized)
3. drawers are bounded by their room (min() widths)
4. the shell persists at small widths (labels leave, furniture stays)
5. reduced-motion twins live where motion is defined
6. landmarks and instruments are labeled

## verification

- **P2**: typecheck + lint clean; **436 passed / 2 skipped** (+6 laws)
- **P3 live**: the keyboard golden path above; 480px viewport zero
  overflow; evidence l14-01 (keyboard rail)

## next

L15 — performance/reliability at scale (the bench exists; extend it
to the new surfaces: desk docs, the archive ledger at 1k/10k).
