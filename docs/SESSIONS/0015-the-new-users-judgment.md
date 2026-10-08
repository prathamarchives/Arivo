# session 0015 — the new user's judgment (L18)

> starting commit: 9fe31a6 (L17 landed, 447/2 green)
> branch: campaign/experience-v1.3

## objective

L18 — final art direction: treat the finished product as a new user
would, ask the constitution's questions, then REMOVE unnecessary
things. identity must survive the removal of the wordmark, the
decorative graphics, the motion.

## the new-user walkthrough (VLM, blind to implementation)

three fresh captures — first open (the shelf), reading, the research
workbench — put to the constitution's questions:

- **one place?** "a single, dimly lit study where the shelf, desk,
  and text are fixed furniture in one quiet room."
- **furniture?** "the sidebar is a solid bookcase, the reading pane
  a clean desk, and the research panel slides out like a physical
  workbench."
- **UI disappears?** "mostly yes — the dark background recedes
  completely, letting the white serif text breathe," with the note
  that the bottom mode rail and top headers "still read as interface
  rather than air" (see the verdict below).
- **swiss underneath, warm on top?** "swiss discipline with warm,
  literary restraint — sophisticated, adult, anti-corporate; a tool
  for thinkers, not a gamified product."

## the removal test (L18's own exit criterion)

**the wordmark removed** (live, hidden in the rail): "the product
retains a distinct, sophisticated identity rather than becoming
anonymous — its character is defined by contrast, whitespace, and a
refined typographic hierarchy." **identity survives.**

**decorative graphics**: there are none to remove — the effect
registry's rejected list (L12) is the prior proof; the materials that
remain (grain, glass instruments, booklight) each carry a semantic
job by law.

**motion removed**: the reduced-motion twin collapses every duration
family to zero (design-law tested, W2.5 + L12) — the structure,
identity, and function are identical with motion off; the beat is
enhancement, never a dependency.

## the removal pass — one candidate, judged

the VLM's single removal candidate: the **bottom mode rail** — "it
interrupts the text." the judgment, with the behavior a static
capture cannot show: the rail already withdraws with the chrome —
after 2.8s of reading attention it fades to nothing (pointer-events
none), and Alt+1..5 reach every mode without it. it is an instrument
that obeys the attention law, not persistent chrome — a keyboard
reader and a mouse reader both reach it exactly when they reach for
it. **kept, with the judgment recorded.**

beyond it: the removal sweep found nothing that exists merely to fill
space — no debug instrumentation, no decorative placeholder, no
vanity surface. the campaign's whole arc (L12's gatekeeper, L13's
voice, L16's audit) removed decoration BEFORE it could ship.

## verification

- **P2**: 447/2 green (no code change required — the layer's work is
  judgment + evidence; the yield law from L17 already shipped)
- **P3**: the walkthrough captures + the wordmark-removal A/B
  (l18-01..04, VLM-read)

## the layers' state

L0–L18 are complete and verified: the thesis, the constitution, the
perceptual foundations, motion, space, interaction, primitives,
composites, the shell, the shelf, the desk, the archive, creative
graphics, voice, accessibility, performance, design QA, optical
correction, art direction. what remains is the final campaign set:
deep debug, security, migrations, packaging, the golden paths, the
full visual matrix, the permanent documentation, and release
verification.
