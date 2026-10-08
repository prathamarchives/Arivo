# accessibility (L14) — shipped behavior

the keyboard is a first-class reader. this documents what ships.

## focus

- **one foundation rule** (base.css): every interactive element gets
  the ink focus ring on `:focus-visible` — 2px solid var(--ink), 2px
  offset. no per-class exceptions; the design forbids them.
- inputs that clean their outline always replace it: the design
  system's inputs (border + selection shadow), the search field, the
  note composer, the palette input, the tag input, the desk's title
  input. lawed: an outline may only be replaced, never silently
  removed.

## keyboard

- tab order flows the shell → surface → instruments; every control is
  a real button/input
- **Alt+1..5** switches the desk modes from anywhere — even while
  typing in a composer (the draft mirror holds the text)
- Escape closes: toc/type panels → selection → workbench (back to
  read)
- the reader: arrows / space / page keys turn pages, +/- zoom or
  font, ctrl+B bookmarks

## screen readers

- landmarks: nav (the rail), main (the work region), toolbar (the
  mode rail), dialogs/regions labeled by name
- every icon-only button carries its aria-label ("back to the shelf",
  "notebook", "close research")
- the drawers name themselves (`aria-label="research workbench"`),
  the archive groups label their days
- state: aria-pressed on the mode chips, checked on radios

## motion

- every duration family has a reduced-motion twin (the token ladder
  collapses to 0ms) — design-law tested, including the page-turn beat
  and the atmosphere shift
- the page turn still turns (state, not animation): a failed or
  disabled animation is never a dependency

## responsive

- drawers are bounded by their room: `min(320px, 100%)` /
  `min(400px, 100%)`
- below 1043px the rail goes slim: the labels leave, the furniture
  (structure) persists — never a disappearance
- the reading column yields to the workbench by transform — geometry
  never reflows to meet a viewport

## error surfaces

every error state speaks the full contract: what happened, what is
affected, and a way out ("back to the shelf" / "go to the shelf") —
plus the plain-language guarantee (L13): internal messages never
reach the user.
