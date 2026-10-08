# states — the interaction contract (L5)

> every interactive component has explicit state coverage. a missing
> state is a bug, not a nicety (law 39).

## the state set

every interactive thing must define:

```
rest        default, untouched
hover       acknowledged proximity (law 41 — never chase the pointer)
press       the receipt — scale 0.985, micro duration
focus       the ink ring, always visible on keyboard (:focus-visible)
selected    semantic identity (ink-backed chip, solid button)
disabled    45% opacity + not-allowed, still readable
loading     where async work happens (sparse — only real waits)
error       where failure is possible (never silent)
empty       where absence is possible (an authored state, never a blank)
```

## current coverage matrix

| component | rest | hover | press | focus | selected | disabled | notes |
|---|---|---|---|---|---|---|---|
| button (default/solid/ghost/lg) | ✓ | ✓ | ✓ | ✓ (ring) | solid = selected action | ✓ | |
| icon button | ✓ | ✓ | ✓ | ✓ (ring) | — | via `disabled` attr | |
| input | ✓ | — | — | ✓ (border + sel ring) | — | — | placeholder ink-3 |
| chip (collection/tag) | ✓ | ✓ | — | ✓ | ✓ ink-backed | — | |
| book card / row | ✓ | ✓ (lift + shadow) | open | ✓ | continue = privileged | — | truth flags for missing/orphaned |
| toc item | ✓ | ✓ | — | ✓ | ✓ bold + sunken | — | |
| menu item | ✓ | ✓ | — | ✓ | — | — | danger gets ink emphasis |
| selection dots | ✓ | ✓ (scale 1.15) | ✓ | ✓ | — | — | the annotation moment |
| palette items | ✓ | — | — | ✓ (cursor) | ✓ cursor row | — | |
| toast | ✓ (transient) | — | — | — | — | — | role=status, aria-live |

gaps are tracked as gates, not accepted: loading/error states for import
and library rebuild are L13 content/voice work; empty states are authored
per-surface (the empty shelf = an empty room waiting, L9).

## state precedence

```
disabled > loading > error > focus > selected > hover > rest
```

a disabled control never shows hover or press. a loading control never
shows press. error beats everything visible except disabled.

## the quiet laws

- stateful differences are semantic: color/border/shadow/transform from
  tokens, never arbitrary css accidents (law 40).
- proximity is acknowledged (hover lift, border darken) — the pointer is
  never chased.
- keyboard focus is never removed for aesthetics: the ink ring is a
  first-class element of the room.
- reduced-motion twins apply to every state transition.
