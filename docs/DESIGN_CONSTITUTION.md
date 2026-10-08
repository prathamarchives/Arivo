# the design constitution — shipped behavior

the laws live in `docs/CONSTITUTION.md` (the twelve + the bans). this
document describes the *enforcement system* that makes them real: the
tokens, the materials, the motion ladder, and the gates that fail ci
when a law is broken.

## the token system (law 6, closed vocabulary)

every color, size, duration, easing, radius, elevation, and z-index
comes from `packages/ui/src/tokens/`. the design-law suite
(`tests/design-law.test.ts`, 28 checks) scans the source for raw
values:

- **color** — hex/rgb/hsl literals outside the token files are
  violations; the five annotation colors are the only hue (monochrome
  base)
- **spacing** — the `--s*` ladder; off-scale values fail
- **radius** — `--r-structural / --r-surface / --r-object`
- **elevation** — the shadow tokens; `--shadow-2/3` retired names
  fail
- **z-index** — `--z-*` only (the campaign's raw 64/65/66 all
  migrated)
- **motion** — every duration/easing from `--dur-*` / `--ease-*`

the checkers are proven alive by the seeded-violation pattern: a
violation is planted, the gate must catch it, the seed is removed
before commit (L16 extended the proof to voice, a11y, and effects
families — each seeded catch is itself a test).

## the two materials

- **matte paper** — every wall, every reading surface. no glass on
  content, ever.
- **soft glass** — instruments only: the floating selection menu,
  drawers' chrome, transient overlays. each usage is enumerated in the
  effect registry's surface law (L12).

## the motion ladder

durations in families (`--dur-state`, `--dur-drawer`, `--dur-turn`,
`--dur-atmos`) with easings (`--ease-settle`, `--ease-out`). **every
family carries a reduced-motion twin** — the ladder collapses to 0ms
under `prefers-reduced-motion`, design-law tested. motion is
enhancement: the page turn still turns, the drawer still opens, the
atmosphere still shifts; no function depends on an animation running.

## focus is a foundation, not a patch

one rule in base.css: every interactive element gets the ink focus
ring on `:focus-visible` (2px solid `--ink`, 2px offset). per-class
focus patches would be the exception the constitution forbids. an
outline may only be *replaced* (input border + selection shadow),
never silently removed — the a11y law suite catches both the removal
and the unbounded drawer.

## the attention model

reading is quiet (law 5): the chrome withdraws after ~2.8s of reading
attention — bars and the mode rail fade to `pointer-events: none`.
selection is an intellectual action: the menu settles, nothing
sparkles. no effect runs during uninterrupted reading (the effect
registry's budget law, L12).

## the surfaces

- the shell rail: solid bookcase; below 1043px it goes slim — labels
  leave, furniture persists
- the reading column: matte paper; yields to the workbench by a 200px
  transform slide (never a reflow — the place is sacred; the documented
  sub-1306px exception is the one viewport where the yield shrinks)
- drawers bounded by their room: `min(320px, 100%)` / `min(400px,
  100%)` — live-verified at 480px, zero overflow

## the two temperaments

lab (light) and den (dark) — one layout, one structure; the material
character shifts. verified across the capture matrix (L16: den ×
paper/sepia/night + lab × paper/night, VLM-read clean; L18's new-user
walkthrough: "two distinct authored temperaments of the same product").

## the identity that survives removal

L18's exit test, live-verified: identity survives the removal of the
wordmark (character lives in typography, material, layout), no
decorative graphics exist to remove (L12's registry rejects
decoration before it ships), and motion's removal is the tested twin.
nothing exists merely to fill space.
