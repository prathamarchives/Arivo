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

## regions (the shell contract, L8+)

```
left    orientation (place, navigation, memory)
center  work (the source)
right   contextual workbench (instruments for the current mode)
```

navigation may become quiet or absent without changing spatial identity.
the three places (shelf / desk / archive) are camera positions on one
room, not separate pages.

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
