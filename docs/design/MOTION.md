# motion — the transition map (L3)

> viscous precision: immediate → continuous → weighted → exact.

> **v0.5.0 — the catalyst port.** the room now answers at the tempo
> pratham's catalyst.exe2 speaks: state 200ms, surface 400ms, the
> curves are the settle and the ink. three distinct curves, four
> addresses (enter and rest share the settle — one beat, two names).

the token layer (tokens.css) owns the curves and durations; this map
assigns them to jobs. no component picks a duration by feel.

## the vocabulary

| token | curve | job |
|---|---|---|
| `--ease-glide` | (0.22, 1, 0.36, 1) | enter — the catalyst settle: fast start, weighted decel, exact rest |
| `--ease-retreat` | (0.4, 0, 1, 1) | exit — brisk, accelerating away (arivo's own) |
| `--ease-shift` | (0.4, 0, 0.2, 1) | move — the catalyst ink ease: controlled continuity |
| `--ease-settle` | (0.22, 1, 0.36, 1) | rest — the catalyst settle, addressed again |

no bounce. no elastic. no rebound. ever.

## mass × direction → duration

| mass | enter | exit |
|---|---|---|
| micro (dots, checks, press) | 140ms | 100ms |
| component (buttons, chips, inputs) | 240ms | 160ms |
| surface (drawers, panels, menus) | 400ms | 260ms |
| spatial (rooms, mode transitions) | 480ms | 320ms |
| state (hover/focus shifts) | 200ms both | |
| page turn | 250ms | |
| material (theme, glass) | 600ms | |
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

## the runtime (L3.1) — laws as behavior

the map above is now enforced by `packages/ui/src/motion/`. the table is
data; the contract is typed; the violation throws at authoring time.

```text
motion.define({ mass: 'surface', job: 'enter', interruptible: true })
```

the component answers WHAT it is doing (mass + job); the runtime decides
the number, the curve, the twin. there is no numeric slot in the contract
— an off-ladder duration cannot be expressed.

### the two layers (D-011)

| layer | engine | jobs | reduced twin |
|---|---|---|---|
| state motion | css transitions from specs | hover, focus, press, color/border shifts, entrances | token vars → 0ms by the media block |
| physical motion | spring runtime (`spatial.ts`) | drag, follow, pill travel | snap — no travel at all |

### what the runtime enforces

1. **no arbitrary durations** — `DurationSpec` exists only via the ladder;
   the ladder mirrors tokens.css and the test proves the mirror.
2. **no bounce** — every spring config is validated ζ ≥ 1 at construction;
   simulated travel never overshoots the target (motion.test.ts).
3. **no layout animation by accident** — `--layout:*` properties require a
   `measuredReason` string, recorded on the spec.
4. **reduced motion** — every job has a twin (crossfade / instant / none);
   physics snaps under reduced motion; the lab can force inspection.
5. **interruption** — `spring.follow(target)` mid-flight preserves position
   AND velocity; the lab's section 12 is the drag-retarget torture test.
6. **exact rest** — settle snaps value to target, velocity to zero.
7. **zero idle cost** — the animator's rAF loop runs only while unsettled;
   hidden tabs pause it; out-of-view instruments stop paying.
8. **reader scroll stays native** — the sampler is passive (never
   preventDefault, never writes scroll position); effects are opt-in.

### the scroll runtime (L3.2)

`scroll.ts` samples velocity (ema-smoothed), direction, and settle state
on a budget. velocity exposure and edge dissolve are OFF by default and
provable in lab section 13 with both toggles — promotion to product
requires profiling + review (law 44).
