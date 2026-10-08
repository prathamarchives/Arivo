# design gates — open until evidence exists

gates are intentionally not constitutional until evidence lands. each has
a default that unblocks work and an evidence condition that closes it.

| # | gate | default (working) | evidence needed to close |
|---|---|---|---|
| 1 | exact icon family + custom glyphs | current inline set, 1.5px stroke | icon audit pass on real screens |
| 2 | final numeric type scale | the optically compensated ladder (+1px body steps for helvetica's x-height) | lab specimen review at real density |
| 3 | exact shadow opacities/blur | contact 0.1 / ambient 0.1 / e3 0.14 | rendered elevation review in den + night |
| 4 | exact spring/curve values | the four beziers + critically damped presets (ζ ≥ 1) shipped in the runtime | motion specimen review + interruption feel on real screens |
| 5 | hover glow promotion | rejected until proven | lab experiment + perf profile |
| 6 | responsive breakpoints | none yet (desktop-first, min 960) | L14 accessibility/responsive pass |
| 7 | dark-room elevation increments | surface stepping as shipped | night-mode elevation review |
| 8 | booklight transform/clamp constants | h 0-360, s 0-26%, l 40-60%, alpha ≤ 0.14 | real cover pipeline + visual review (L9/L10) |
| 9 | creative graphics budget | grain only, opacity 0.035 | L12 profiling |
| 10 | audio in the experience | no | owner veto stands until reversed |
| 11 | custom "make your own room" | no | owner veto stands until reversed |
| 12 | archive first view | no graph-first commitment | L11 IA work |

## arivo-local gates (added during the L2 build)

| # | gate | default | closes when |
|---|---|---|---|
| 13 | temperament persistence + picker | **CLOSED at L8** — settings.json persists `temperament`, the rail's foot holds the picker (radiogroup), boot applies both axes; palette carries the toggle | evidence: settings round-trip test + shell capture |
| 14 | annotation vocabulary extension | 5 legacy stored colors render under new identity hues; 'gray' renders as pencil, violet not yet offered | L10 annotation flow: HighlightColor type extension + picker rewrite |
| 15 | reader measure as true 68ch | px approximation (max 760px, min 520px) | L10 reader depth: container width derived from font step |
| 16 | density application | region-level breathing live in the shell (rail, archive) — `calc(var(--sN) * var(--density))`; shelf/desk surfaces still to apply | L9 shelf surface work applies it to the book grid's rhythm |
| 17 | mono metadata voice in the two-system law | kept as utility (data/counts/labels) | optical correction pass (L17) — kill it if it fights the grotesque |

## L8 shell notes

| gate | state at L8 |
|---|---|
| 1 icons | two new glyphs (shelf, archive) joined the canonical set — 26, one stroke language; the lab specimen shows them. full audit on real screens continues at L9+ |
| 6 responsive | the first measured structural change is specified and shipped: the rail collapses to an icon rail below the measured 1044 boundary (rail 224 + work-min 820 where work-min = measure 520 + workbench 300). final breakpoint systematization stays L14 |
