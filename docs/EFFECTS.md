# the effect registry (L12)

> every live graphics effect, each with its contract: purpose, default,
> budget, reduced-motion behavior, fallback, failure behavior. this is
> the Effect Gatekeeper's ledger — an effect not listed here does not
> ship; an effect listed without a cost is a lie.

> the law: **no decorative effect may compete with text.** matte walls,
> expressive instruments. saturation is a privilege reserved for the
> user's marks (the annotation identity colors).

## 1. paper grain

- **purpose**: material honesty — the room's canvas is paper, not
  plastic. a fine static texture under content, over the base color.
- **default**: one fixed full-viewport layer (`body::before`), an
  inline SVG feTurbulence tile (160×160, fractalNoise, 2 octaves),
  `--paper-grain-opacity: 0.035`.
- **budget**: painted once by the compositor — zero per-frame cost, no
  animation, no repaint on scroll (position: fixed, pointer-events:
  none). one 160px tile decoded once.
- **reduced motion**: unaffected — it never moves.
- **fallback**: if the data-URL fails to decode the layer is simply
  transparent; the base color carries the room.
- **failure**: invisible. no crash path exists.

## 2. soft glass (the instrument material)

- **purpose**: floating instruments (selection menu, note composer,
  palette, mode surfaces) read as held objects above the page —
  depth without walls becoming frosted wallpaper (law 22: glass is
  scarce; `.glass` appears only on floating chrome).
- **default**: `--glass-blur: 16px`, `--glass-saturation: 1.12`,
  translucent `--glass-tint`, hairline `--glass-rim`, top-edge light
  catch (`--glass-light`), `--shadow-ambient` lift.
- **budget**: one backdrop-filter pass per instrument; at most a few
  concurrent glass surfaces exist at once (the scrim + menu, or one
  drawer). blur radius is fixed by token — no effect may raise it
  ad hoc. transform/opacity only for the enter animation (`.rise`,
  --dur-comp-in, twin-collapsed).
- **reduced motion**: the rise animation collapses to 0ms (the L3
  ladder's twin, design-law tested). the material itself is static.
- **fallback**: `@supports not (backdrop-filter…)` → the tint yields
  to solid `--bg-raised`; rim and elevation survive. the instrument
  stays readable — translucency without blur is never acceptable.
- **failure**: a GPU-denied backdrop-filter renders as the fallback
  path; no text contrast is ever owed to the blur.

## 3. booklight (--aura)

- **purpose**: the book on the desk tints the light, never the walls —
  cover → dominant/accent extraction → saturation clamp → luminance
  clamp → taste filter → `--aura-*`. den allows it; **lab ignores it
  entirely** (its temperament is monastic). ambient wash + cover
  shadow + progress hairline only; core text, borders, surfaces,
  typography, and annotation identity colors are never mutated.
- **default**: target atmosphere in the low-teens peak alpha (visually
  validated, not a sacred pixel); shifts land over
  `--dur-atmosphere: 1400ms`.
- **budget**: the pipeline runs once per cover (extraction in JS from
  a small cover image — booklight.test.ts proves the clamps); the
  aura itself is CSS custom properties consumed by existing
  gradients/shadows — zero per-frame cost.
- **reduced motion**: the atmosphere shift is a color transition; the
  reduced-motion twin collapses its duration to 0 (instant, correct).
- **fallback**: no cover, or extraction fails → neutral aura; the room
  is simply unlit by the book.
- **failure**: clamped saturation/luminance guarantee the wash can
  never reach text-competing intensity (tested bounds).

## 4. the page-turn beat

- **purpose**: reading is paginated; the turn is felt, never waited
  for — an 8px drift + 3px blur settling to rest.
- **default**: exactly `--dur-turn: 250ms` with `--ease-settle`; a
  forced reflow restarts it on back-to-back turns.
- **budget**: transform + filter on the incoming page only; the
  reading scroll is never animated (sacred).
- **reduced motion**: duration collapses to 0 — the twin, not a second
  rule (design-law's ladder test owns it).
- **fallback / failure**: if the animation fails to start, the page
  still turns instantly — the beat is enhancement, never a dependency.

## 5. shelf camera transitions

- **purpose**: alternate shelf arrangements are camera positions on
  one library, not new layouts — the move communicates spatial
  continuity.
- **default**: `--dur-surface-in/out` (320/220ms) with the named
  easings; object selection + large-library containment ride along.
- **budget**: transform/opacity only; offscreen objects skip
  rendering (`content-visibility`, the containment law).
- **reduced motion**: twins exist (the surface family, design-law
  tested).
- **fallback / failure**: a failed transition leaves the camera at its
  destination — state is never mid-flight.

## 6. progress hairline

- **purpose**: where you are in the book — a one-pixel honest line.
- **default**: width transition over `--dur-material`.
- **budget**: one element, layout-bounded (accepted exception to the
  transform/opacity preference — a single 1px-tall bar, measured
  cost ≈ zero; revisited only if profiling ever shows otherwise).
- **reduced motion**: the material family's twin collapses it.
- **fallback / failure**: width is state — a failed transition still
  lands at the true percent.

## registered and rejected

- **glow / cursor-chasing effects**: experimental, unproven — not
  registered, not shipped.
- **edge dissolve / scroll optics**: requires profiling + visual
  review proof of benefit (the constitution's own bar) — not
  registered until then.
- **particles, dither fields, generative wallpaper**: no semantic job
  on any current surface — rejected by the gatekeeper.
- **graph/spatial archive presentation**: deferred by L11's own law
  (relationships before visualization); the data now exists, the
  presentation earns its place later.

## the registry's teeth

`tests/effect-registry.test.ts` enforces what this document claims:
the glass fallback exists in both material classes, the grain opacity
is bounded, the blur is token-budgeted (no raw backdrop-filter px in
effect css), the atmosphere twin lives in the reduced-motion block,
and the annotation identity colors — the only saturated privilege —
are unchanged by every effect above.
