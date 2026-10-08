# spatial — the room's geometry (L4)

> the room grows around the page. the page does not grow with the monitor.

## the grid

```
4px   fundamental unit
8px   primary component grid
4px   baseline half-step (text rhythm)
```

the spacing ladder is closed: `4 8 12 16 24 32 48 64 96 128` (tokens
`--s1 … --s32`). exceptions are recorded in DECISIONS.md or they are
violations.

## density

temperament modulates region breathing, never text legibility:

```
lab  ×0.90  — tighter section rhythm, denser shelf
den  ×1.10  — looser breathing, comfortable rooms
```

apply at region containers (`calc(var(--s6) * var(--density))`), not
inside text components. gate 16.

## the reading measure

**68ch maximum.** the reading column tops out at the author's comfort,
not the monitor's width. current approximation: 520–760px px container
(gate 15 — true ch-derived measure lands with L10 reader depth).
the workspace stays fluid around the sovereign column.

margins are useful space: tools, notes, references, and booklight
breathe there. marginalia is not wasted paper.

## regions (the shell contract, L8 — now live)

```
left    orientation (place, navigation, memory)
center  work (the source)
right   contextual workbench (instruments for the current mode)
```

navigation may become quiet or absent without changing spatial identity.
the three places (shelf / desk / archive) are camera positions on one
room, not separate pages.

the shell (`shell/Shell.tsx`, D-022) implements this as behavior:

- the **orientation rail** is persistent furniture: 224px (`--rail-w`),
  matte paper, one border; it never remounts on place change. the three
  places + the current book + the temperament live there. below the
  measured 1044 boundary it collapses to a 64px icon rail — a structural
  transformation, not a shrink (first specified responsive change, gate 6).
- **visibility follows attention** (D-025): full (shelf, archive) →
  quiet (desk at rest, the furniture dims) → absent (reading, opacity
  only — the room never moves while you read, D-024).
- **spatial memory**: the desk context survives navigation; the shelf
  and archive restore their scroll; an exact source return is a one-shot
  locator consumed at the reader's boot, then progress is truth.
- the right **workbench region** is the desk's L10 future — structural
  slot only; no empty furniture renders before its instruments exist.

## z-space

closed and semantic (law 47):

```
0   canvas      the paper itself
1   content     #root
10  sticky      chrome bars, progress hairlines
20  floating    instruments: selection menu, toaster, type panel
30  overlay     drawers, menus + scrims, composer
40  transient   dropzone, command palette
```

same-layer order is dom order. no raw z-index outside tokens — enforced
by `tests/design-law.test.ts`.

## the surface ceiling

elevation is contact + ambient only (see tokens). light rooms lift with
warm shadow; dark rooms step surface values first. glass instruments
float (z-20+) but never stack on each other without a transient reason.
