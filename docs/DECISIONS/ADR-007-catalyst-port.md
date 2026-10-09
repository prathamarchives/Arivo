# ADR-007 — the catalyst port: arivo speaks the catalyst.exe2 design system

status: accepted (v0.5.0)

## context

pratham's site, catalyst.exe2 (github.com/prathamarchives/catalyst.exe2),
was rebuilt from scratch on a locked system: neutral paper (#fafaf8) and
one ink (#0a0a0a), inter 400/500 + jetbrains mono, hairline rules instead
of elevation, near-flat radius, motion that settles (200ms state, 400ms
surface). the owner asked for arivo's whole ui to be rebuilt on the same
system — one voice across the products.

arivo's own room was the warm paper den: cream (#f4eee2), warm brown ink
(#2b2118), a leather accent, helvetica 400/700 with a light wordmark cut,
paper grain, contact/ambient elevation, glass instruments with light
catches, and a rounded radius grammar (4/8/12/14/16).

## decision

port the catalyst system into arivo's token layer, keeping every variable
name so 3.7k lines of component css restyle by inheritance:

- **light**: paper #fafaf8 / raised #ffffff / sunken #f2f2ef; dark is the
  night room (#0c0c0c / #151514 / #090909), ink #f2f2f0. the ink ladder
  steps one ink by opacity (62% / 45%), never a second gray.
- **type**: helvetica is retired; inter 400/500 self-hosted (the wordmark
  is the name in 500). emphasis is 500 — 700 is retired, a new law. the
  reading surface (literata) and the mono voice survive untouched.
- **geometry**: radius nearly retired — 2/3/4px grammar, instruments stay
  pills. hairlines (1px rules) do the work elevation used to do; shadows
  survive at a whisper for floating instruments only.
- **motion**: the catalyst beat ladder — state 200ms, surface 400ms,
  enter/rest share the catalyst settle curve (0.22, 1, 0.36, 1), moves
  speak the ink ease (0.4, 0, 0.2, 1), exits keep arivo's brisk retreat.
  three distinct curves, four addresses.
- **material**: paper grain retired (opacity 0, layer stays wired); glass
  quiets to paper-tint, one hairline rim, no light catch.
- **the one spent color**: --accent is a muted brick (#B4443E) reserved
  for error/needs-attention (the failure-path law needs a signal); the
  old leather accent is gone. modified/unsaved states signal in ink, not
  hue.
- **app icon**: the "a." monogram is retired; the new mark is the
  catalyst grammar's own glyph — a white circle with a couple of very
  small punched holes on a hairline ink ring.

what is deliberately untouched: the annotation identity colors (law 38),
the reading washes, the booklight aura, the reader themes, literata, and
the whole interaction model. the book's voice is sovereign.

## the laws amended (this is the point)

the constitution is executable — the port had to change the laws, not
sneak past them. with this ADR: radius grammar {2,3,4,999}, weights
{400,500}, focus ring 1px ink, grain retired-at-zero, and the MOTION.md
ladder/table carry the new numbers. the checkers' seeded-violation proofs
flipped with them: 700 is now the caught weight; 10px is the caught
radius. the smoke font gate now proves inter 400/500 loads from the
bundle, not helvetica.

## consequences

- one design language across pratham's site and arivo; the systems can
  share token values and motion beats by copy, never by dependency.
- the warm den's material story lives in git history (v0.2–v0.4) if it
  ever wants to return.
- docs/design/* carry a v0.5.0 note at their heads; the deep material
  essays (den/lab, texture) read as history now, not current law.
