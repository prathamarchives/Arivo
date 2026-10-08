# session 0006 — the page-turn beat + the regression laws (W2.5 + W2.6)

> starting commit: aff103b (W2.3+W2.4 landed)
> branch: campaign/experience-v0.4

## objective

W2.5 (scoped, honest): the motion constitution's headline beat — the
page turn — plus the audit that the rest of the motion system was
already landed by L3. W2.6 (core): every bug found live across the
campaign becomes a permanent test.

## W2.5 — motion

**audit result**: the L3 runtime already owns the vocabulary — the
full duration ladder (--dur-state 150 / comp 200/140 / surface 320/220 /
spatial 560/380 / turn 250 / material 700 / atmosphere 1400), the four
named easings, reduced-motion twins for every family (design-law
tested), drawers/menus/panels animate through `.rise` + the ladder, the
shelf's camera transitions landed with L8/L9. the one true gap was the
page turn itself: epub.js's default manager jumps columns instantly.

**the beat (epub.ts + app.css)**: `next()`/`prev()` now play a beat —
the incoming page settles from an 8px drift (`--s2`) + 3px blur to
rest, exactly `--dur-turn` long with `--ease-settle`. a forced reflow
restarts it on back-to-back turns. the reduced-motion twin collapses
the duration to zero — the twin, not a second rule (design-law's
reduced-motion test owns that contract).

**live proof**: ArrowRight → `.epub-view.page-turn-next` class lands,
computed animation `0.25s cubic-bezier(0.2, 0, 0, 1)` (the settle
curve) running; ArrowLeft → `page-turn-prev`. the beat is felt, never
waited for. (media emulation of reduced-motion isn't reachable from
this harness; the twin is proven by the design-law ladder test.)

**honest scope note**: the remaining W2.5 line items — tooltip law,
press-scale micro-states on every chip, value flash — live in the L6/L7
component system's own surface and were audited as already-partially-
landed (press transitions exist via --t-hover/--dur-state); their full
completion is folded into L16's design QA matrix rather than pretending
a single pass closed them here.

## W2.6 — the regression laws (tests/regression-laws.test.ts)

the four bugs the campaign named, each with its receipt:

1. **the unclickable selection menu** (found live post-merge, 0003):
   `.selection-menu` must sit at `--z-overlay` — never `--z-floating`
   (one layer under its own scrim).
2. **the multi-class annotation that never painted** (found live,
   0002): the class expression passed to epub.js's `annotations.add`
   must be a single hyphenated token (`ar-hl-${color}`) — no space may
   ride along; and every offered color must have a paint rule in
   READ_CSS (the svg fill contract).
3. **stale mark geometry on repagination** (found live, 0002; killed
   for a third field family in 0005): every repaginating field —
   fontStep, lineHeight, measure, pageMode, flow — must appear in the
   `repaginates` recreate trigger.
4. **the seed fixture that faked a green test** (0001/0002): the seed
   path stays gitignored — a fixture can never un-skip the owner's
   real-book test.

these join the pdf substrate laws (session 0004) and the profile laws
(0005) as the permanent enforcement layer: the exact bugs this campaign
discovered are now structurally difficult to reintroduce.

## verification

- **P2**: typecheck + lint clean; **385 passed / 2 skipped** (+5
  regression laws).
- **P3 live**: the beat (class + computed animation, both directions),
  on the synthetic seed; the seed removed after (regression 4's own
  law holds in this repo's tree).

## next

L10 Desk (READ/MARK/RESEARCH/MAKE/REFLECT + the persistence contract),
then L11 Archive. wave 2 is closed: PDF substrate (W2.1+W2.2), profiles
+ measure + dual page (W2.3+W2.4), motion's page turn + the regression
laws (W2.5+W2.6) — all landed, pushed, verified.
