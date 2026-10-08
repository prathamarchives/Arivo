# motion — the transition map (L3)

> viscous precision: immediate → continuous → weighted → exact.

the token layer (tokens.css) owns the curves and durations; this map
assigns them to jobs. no component picks a duration by feel.

## the vocabulary

| token | curve | job |
|---|---|---|
| `--ease-glide` | (0.16, 1, 0.3, 1) | enter — fast start, weighted decel, exact rest |
| `--ease-retreat` | (0.4, 0, 1, 1) | exit — brisk, accelerating away |
| `--ease-shift` | (0.3, 0, 0.2, 1) | move — controlled continuity |
| `--ease-settle` | (0.2, 0, 0, 1) | rest — viscous settle, no overshoot |

no bounce. no elastic. no rebound. ever.

## mass × direction → duration

| mass | enter | exit |
|---|---|---|
| micro (dots, checks, press) | 120ms | 90ms |
| component (buttons, chips, inputs) | 200ms | 140ms |
| surface (drawers, panels, menus) | 320ms | 220ms |
| spatial (rooms, mode transitions) | 560ms | 380ms |
| state (hover/focus shifts) | 150ms both | |
| page turn | 250ms | |
| material (theme, glass) | 700ms | |
| atmosphere (booklight, room light) | 1400ms | |

duration scales with mass, not mood. entering breathes; leaving is
brisk. things entering feel lighter than things leaving.

## the assignment map

| interaction | mass | curve | notes |
|---|---|---|---|
| button/icon press | micro | settle | scale 0.985 — a receipt, not a bounce |
| hover state shifts | state | settle | color/bg/border only |
| chip / menu item hover | state | settle | never layout properties |
| book hover lift | component | glide | `--lift-m` + shadow bloom (the physical shelf-hover is L9) |
| drawer (toc, notebook) | surface | glide in / retreat out | |
| selection menu appear | surface | glide | glass instrument, floats over content |
| note composer | surface | glide | |
| toast | surface | glide (rise keyframe) | |
| command palette | surface | glide | transient layer |
| reader chrome fade | surface | settle | quietness, not disappearance |
| page turn | turn | glide | never delays reading |
| theme / lighting change | material | settle | token vars animate at paint |
| booklight aura | atmosphere | settle | den only, low-teens alpha |

## the laws

1. transform + opacity only. layout properties animate only with a
   measured reason.
2. interruptible: velocity is preserved where physics permits; a new
   transition starts from the current state, never jumps.
3. object continuity: the touched thing is the thing that moves
   (book card → reader, selection → instrument, tab → pill).
4. reader text is sacred: no decorative motion over glyphs, no scroll
   hijack, no inertia.
5. every motion has a reduced-motion twin — enforced by
   `tests/design-law.test.ts`.
