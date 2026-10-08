# design decisions — the ledger

every non-obvious call lands here with its reason. decisions are cheap to
revisit with evidence; silent drift is not.

## D-001 · the supplied helvetica is the implementation

**decision:** bundle the owner-supplied helvetica (400, 700, and the
latin-subset 300 as the wordmark cut) as woff2 in `packages/ui/src/fonts/`;
`font-family: 'Helvetica'` resolves to the bundled face, never a system
fallback. obliques, compressed, rounded are not shipped — no role wants
them. source: `upload/helvetica-255 (1).zip`, converted with fonttools.
**reason:** law 15 — supplied assets are the implementation. the font gate
(smoke) enforces it at boot.
**risk recorded:** the 300 cut covers latin only — it is wordmark-only by
token contract; mid-word fallback on non-latin titles would be a defect.

## D-002 · weights are 400 / 700 (+300 wordmark)

**decision:** no 500/600 anywhere — those cuts do not exist in the
supplied files; synthesized weights are forbidden. hierarchy comes from
size + color; bold is spent deliberately (titles, solid buttons, the
current toc entry).
**reason:** authenticity of the cut + law 14 (composite tokens).

## D-003 · den is the default temperament

**decision:** boot applies `data-temperament='den'` (settings.ts) until
the L8 shell lands a picker + persistence (gate 13).
**reason:** den is the living/reading mode; lab is the opt-in serious
room. two authored modes, no third.

## D-004 · the system's warm signal is the den accent, never mark hues

**decision:** truth-state badges (missing / ambiguous / review) use the
den accent family (`--accent`, `--accent-ink`) — previously undefined
`--amber` fallbacks. lab mode's accent collapses to ink (authority from
ink, not hue).
**reason:** the saturation privilege (law: user marks own the vivid end);
system signals stay within the room's restrained leather/ink range.

## D-005 · legacy annotation storage stays safe

**decision:** stored highlight colors keep their legacy keys
(yellow/blue/green/pink/gray). the picker dots and reading washes render
them under the new identity hues (yellow→amber, green→sage, pink→rose).
'gray' renders as the pencil mark; violet is not offered until the L10
annotation flow extends the type (gate 14).
**reason:** no destructive data migration inside a design wave; the
reading surface changes, the truth files do not.

## D-006 · instrument serif retired from the room

**decision:** instrument serif exits the family set; ui display and
titles are helvetica; book content (including book headings and designed
cover fallbacks) is literata.
**reason:** the two-system law — helvetica speaks for the room, literata
speaks for the author.

## D-007 · optical exceptions (documented, allowed)

- **micro-badge padding** (2px/6px on format badges, truth flags): below
  the s1 step; the alternative (4px) overpowers 10px mono text.
- **stacked-label hairline gaps** (1–2px between title/author rows):
  hairlines are border-domain, not spacing-scale.
- **type-theme lighting previews** (raw hex swatches in the reader's
  typography panel): fixed reference colors that must render their target
  under any current theme.
- **pdf page white** (#fff) and the invisible text-layer black: the
  document's own material, not room color.
- **type scale +1px body steps**: optical compensation for helvetica's
  smaller x-height vs the previous voice (inter). revisit at gate 2.

## D-008 · dropzone blur removed

**decision:** the drag-over overlay keeps its color scrim, loses its
6px backdrop blur.
**reason:** blur is a budgeted resource (law: glass is an instrument);
a full-viewport blur for transient state feedback is wallpaper behavior.
the scrim alone carries the state.

## D-009 · legacy theme selectors bridge the axis split

**decision:** `[data-theme=...]` selectors without a temperament fall
back to den values; the app sets both attributes at boot.
**reason:** the existing single-attribute theming keeps working during
the migration; no user-visible regression while the two-axis system
lands.

## D-010 · the smoke suite is a design gate

**decision:** smoke now enforces (a) the font gate — intended assets must
load or the run fails; (b) `--lab` section captures of the full specimen
record; (c) `--reader` — opens the first book through the real ui and
captures the paginated body (the golden path, end-to-end, every run).
**reason:** "no visual change without a baseline" + "never accept
checks-only when behavior changed" — the capture pipeline is now part of
the launch gate.

## D-011 · motion is two layers: css state, spring physics

**decision:** state motion (hover, focus, press receipts, color/border
shifts, simple entrances) is css transitions built from `motion.define`
specs — token vars, zeroed automatically by the reduced-motion block.
physical motion (drag, following instruments, pill travel) is the spring
runtime (`packages/ui/src/motion/spatial.ts`) — velocity-continuous,
interruptible, visibility-paused.
**reason:** css is cheaper and simpler for ~80% of ui motion; physics
belongs where velocity continuity actually matters. making the whole app
depend on a spring engine would be the opposite of the performance law.
**risk recorded:** the split is a boundary, not a hierarchy — neither layer
may grow into the other's jobs (follow jobs throw if asked of css).

## D-012 · springs are critically damped, always

**decision:** every sanctioned spring config carries damping ratio
ζ ≥ 1 (critically damped: the fastest no-overshoot settle). the Spring
constructor rejects bouncier configs. presets — follow (170/26.1/1),
object (120/24/1.2), travel (300/34.7/1) — are the only tuning surface
until a motion-specimen review reopens them (gate 4).
**reason:** law 28 — no visible bounce, no elastic overshoot, no rebound.
critically damped is the exact, defensible reading of "viscous precision".

## D-013 · scroll effects are opt-in and off

**decision:** the scroll runtime (`scroll.ts`) is a passive sampler —
velocity, direction, settle detection on a rAF budget that costs zero at
rest, pauses when hidden, never hijacks (law 43). velocity exposure and
edge dissolve are lab-provable toggles, default off, promoted only with
profiling + review (law 44).
**reason:** infrastructure first, effects later — the sampler proving
itself in the lab (section 13) is evidence; wiring blur into the product
is not.

## D-014 · the reduced-motion override is lab-only

**decision:** `setReducedMotionOverride` exists so the lab can inspect
twins under any os setting (`data-lab-reduced` zeroes css twins inside
the lab root). production code never sets it; the physics runtime consults
the real preference on every follow().
**reason:** you cannot review what you cannot force on; but the user's os
setting is the only production truth.

## D-017 · the arivo state extension slots lawfully

**decision:** the async family slots under loading, urgency-ordered
(recovering > saving > processing); needs-attention defers to error but
outranks focus; the quiet receipts (saved, modified) rank below
interaction but above rest. error/needs-attention keep the pointer LIVE —
retry is the whole point of an attention control.
**reason:** the documented core order stays byte-identical; the extension
is a total order (compile-enforced via the exhaustive Record) so no
component can invent a contradictory precedence.

## D-018 · spinners rotate linear

**decision:** the async spinner's rotation uses `linear` — the one
sanctioned non-easing keyword — at transform only, zeroed by the
reduced-motion twin.
**reason:** the easing vocabulary governs TRANSITIONS between states;
constant angular velocity is not a transition. linear is the physically
honest curve for pure rotation.

## D-019 · the cover fallback is typographic

**decision:** books without cover art render a designed fallback: the
title in literata on sunken ground with a spine hairline — never a gray
rectangle, never a generic gradient.
**reason:** the two-system law — the author speaks for the book; absence
of art is not absence of voice.

## D-020 · the workbench width range is recorded geometry

**decision:** the workbench resizes between 300px and 460px (default
360). the range is furniture geometry like `--cover-w`, not spacing.
**reason:** composites may own recorded geometry; they may not invent
fluid values that drift per screen.

## D-021 · drag is exempt from motion transitions

**decision:** while the user's pointer owns a value (workbench resize,
the interruption probe), it follows the pointer with no transition.
**reason:** the motion law governs state changes the system initiates;
direct manipulation with a transitioned follower feels like pulling
taffy. causality: the hand is the cause, the follower is the effect,
with zero invented easing.

## D-022 · the app is a room, not a router (L8)

**decision:** the ui store's view model (`library | reader`) is replaced
by the room model (`stores/room.ts`): `place` (shelf / desk / archive)
is a camera position over one continuous room; the desk context
(book + one-shot return locator) survives navigation; the shelf and
archive keep their scroll. the orientation rail is persistent furniture
— it never remounts on place change. screens render inside the work
region and fill it (100%), never the viewport.
**reason:** the thesis (L0) — "the product should feel like one physical
place, never a page router." routing would make every transition a
reset and every return a re-navigation; spatial memory requires state
that outlives the camera move.
**risk recorded:** the camera positions currently render as full
screen swaps inside the work region; true shared-element continuity
(book pull-forward) lands with L9/L10 — the room model is its
prerequisite, not its completion.

## D-023 · the archive's first camera is the marks ledger

**decision:** L8 ships a real archive surface: `archive:marks()` joins
highlights and bookmarks to their books in one query (never n+1), and
every entry returns to the exact passage via the anchor it carries
(golden 5). the full view vocabulary (threads, clusters, walls) is L11.
**reason:** "do not invent an archive before its objects are real" —
the marks are real objects with real provenance; the ledger proves the
compounding loop without inventing views. marks of missing-file books
are excluded: an archive entry that cannot return to its source is a
broken promise.

## D-024 · the shell's absence is perceptual, never structural

**decision:** when attention deepens into reading, the rail fades
(opacity → 0, pointer-events off) and does not leave the layout. the
reading column does not re-center; nothing reflows.
**reason:** the physical truth — when you focus at a desk, the walls do
not move; your attention withdraws from them. a layout-animated rail
would reflow the sovereign column mid-read (law 33: motion never delays
reading; law 56: layout animates only with a measured reason — and
optical re-centering is not one). text-position stability on the eye
beats window-centered symmetry.

## D-025 · chrome quietness is one truth, owned by the shell

**decision:** the pre-shell reader kept its own chrome-fade state
(mousemove + idle timer inside ReaderScreen). L8 lifts the whole state
machine into the room store (`attention: active | reading`): the shell
listens for edge proximity, the reader reports engagement (selection,
drawers), and every chrome surface — rail, reader bars — derives from
the same attention value. arriving at the desk starts the withdrawal
clock even without pointer movement.
**reason:** two independent chrome-fade systems would disagree; the
room must have one quietness. engagement re-checks at fire time, so an
open selection can never have its chrome stolen.
