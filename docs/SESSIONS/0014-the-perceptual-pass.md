# session 0014 — the perceptual pass (L17)

> starting commit: 0262611 (L16 landed, 446/2 green)
> branch: campaign/experience-v1.2

## objective

L17 — optical correction after structural QA: measured geometry +
trained-eye review. "mathematical correctness does not override
optical correctness; document every intentional exception."

## the measured pass

- **icon centering**: measured on the live shelf — every icon sits at
  dx=0, dy=0 in its button. nothing to correct.
- **mode rail**: chips optically centered in the rail (dy=0); the
  rail was 2px INTO the bottom chrome's top edge — crowded. fixed:
  the rail now rides 12px clear (bottom: 44px).
- **the epub page**: the container clips exactly at the measure
  (680px, verified geometrically) — the "clipped text" the VLM saw
  was the workbench drawer covering 212px of the reading column.

## the real correction — the source yields to the workbench

the L10 workbench (400px drawer) overlaid half the reading column:
text ran under the drawer — the VLM caught it, the geometry proved
it (the column spanned 412–1092; the drawer began at 880).

the fix honors the highest law first: **the place is sacred** —
shrinking the column would repaginate the book and move the page. so
the column YIELDS, it does not reflow:

- `.reader[data-workbench='open'] .epub-container` slides left by
  200px (half the drawer) on the shift easing — a transform; the
  column keeps its exact width, the page its exact pagination, the
  CFI its exact place. closing returns it the same way.
- pdf pages yield identically (the scroll's centering padding
  shifts; the canvases never resize).

live-verified: the column moves 412→212 and returns 212→412, the
drawer opens and closes beneath it; VLM on the yielded state: "fully
clear of the drawer, well-balanced, intentional; no optical defects."
lawed (design-qa #11): the yield rule must be a transform, never a
width.

## the documented exception

below ~1306px of viewport, the visible region (work region minus the
drawer) can no longer hold the 680px measure; the column yields as
far as its geometry allows and the remainder (≤ 24px) sits under the
drawer's edge. the alternatives are all worse: shrinking the column
repaginates (the place is sacred), and narrowing the drawer starves
the work surface. recorded here as the intentional exception L17
demands.

## verification

- **P2**: typecheck + lint clean; **447 passed / 2 skipped** (+1 yield
  law)
- **P3 live**: the yield geometry above + VLM's clean verdict;
  evidence l17-01..03
- the mode-rail spacing fix + the optical measurements

## next

L18 — final art direction: treat the product as a new user would,
then REMOVE unnecessary things.
