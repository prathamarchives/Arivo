# session 0013 — attack the system (L16)

> starting commit: c75b2d6 (L15 landed, 446/2 green... after this wave's additions)
> branch: campaign/experience-v1.1

## objective

L16 — the design QA campaign: automated audit (raw values, forbidden
primitives), state audit (every device truth + authored state), the
seeded-violation proof for the NEW law families, and the capture
matrix.

## part 1 — the seeded-violation proof

design-law's own pattern ("a checker that cannot catch is a failure")
extends to every law family added since W2.6:

- **voice**: SaaS copy seeded into a literal scan is caught;
  plainError refuses an uncoded internal even when it fakes a
  code-shaped property
- **accessibility**: an outline removal without a visible twin is
  caught; an unbounded drawer width is caught
- **effects**: a raw `blur(22px)` is caught by the budget law

## part 2 — the state audit

the honest architecture assertion: **focus is a foundation, not a
patch** — the universal `:focus-visible` ink ring (base.css) is the
ONE rule; per-class focus rules would be the exception the
constitution forbids. what each interactive family OWNS is its hover.
the audit found one real gap: the archive card's button (`.archive-
mark-open`) had no hover of its own — the parent card changed, the
button didn't. fixed.

authored states verified present across every surface: empty states
(the shelf's owned room, the archive's "your work will gather here",
the workbench's honest hints, the notebook's "nothing marked yet"),
error states with ways out (reader + archive), loading states that
speak quietly ("reading the ledger…", "opening the workbench…").

## part 3 — the capture matrix

den × paper / sepia / night, lab × paper / night — five captures on
the live reader (docs/screenshots/l16-*.png). VLM-read: "two distinct
authored temperaments of the same product — identical layout, the
material character shifts clearly… no visual defect."

## verification

- **P2**: typecheck + lint clean; **446 passed | 2 skipped** (+10 QA
  laws: 5 seeded-catch proofs, hover coverage, input focus patterns,
  empty/error/loading states)
- the seed never shipped (removed before commit, law 4)
- design-law's existing 28 checks all green across the matrix — the
  L10–L15 css additions were already law-compliant (the gates ran on
  every wave)

## next

L17 — optical correction: the perceptual pass (alignment, weights,
spacing rhythm) after structural QA.
