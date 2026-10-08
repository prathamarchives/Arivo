# the experience system — shipped behavior

one place, five modes, an attention model, a voice, and a registry of
effects that each carry a semantic job. this is the system that makes
arivo feel like a study, not an app.

## the world model

left rail = direction (the shelf, the rooms); the center = the work
(the book, the reading column); right = the contextual workbench
(drawers that belong to the open surface). there are no routes and no
pages — surfaces come and go around the fixed furniture. one place:
"a single, dimly lit study where the shelf, desk, and text are fixed
furniture in one quiet room" (L18's blind walkthrough).

## the five modes (L10)

read · mark · research · make · reflect. the mode changes the
instruments available, never the place:

- **read** — the resting state; the chrome-withdrawal law owns the
  screen
- **mark** — selection in hand: the menu (five colors, note, question,
  bookmark, collect, copy)
- **research / make / reflect** — the workbench drawer with desk
  documents of that kind; collected quotes ride with provenance

the mode lives in the room's desk context — a shelf roundtrip returns
to the same mode, the same document, the same drawer state (spatial
memory, tested). Alt+1..5 reach every mode from anywhere, even mid-
composition (the draft mirror holds the text).

## the attention model

after ~2.8s of reading attention the chrome withdraws: bars, the mode
rail, everything but the text — `pointer-events: none`, the text
breathes. any pointer or key movement brings it back. work modes
engage the room (the chrome cannot withdraw mid-work); read and mark
trust the attention law exactly.

## booklight

the reading surface's light responds to position — clamped, bounded,
reduced-motion twinned (lab ignores the light by design; the clamps
are real code, lawed by the effect registry).

## the voice (L13)

one fixed dictionary (`lib/voice.ts` — `VOICE_NOUNS`: shelf, desk,
archive, book, mark, note, question, research, make, reflect,
document, passage). 26 banned phrases (productivity, workspace,
seamless, empower, ai-powered, …) can never reach a user — the voice
suite scans every user-facing string literal. errors speak the full
contract: what happened, what is affected, a way out. internal
messages never display verbatim (`plainError` owns every surface) —
the reader's boot catch and the archive's read catch are the two
surfaces that shipped raw `err.message` before L13; both are lawed
now.

## the effect registry (L12)

`docs/EFFECTS.md` is the contract for every live effect — purpose,
default, budget, reduced-motion behavior, fallback, failure behavior:

- paper grain (bounded ≤ 0.05, fixed, pointer-transparent)
- soft glass (instruments only; `@supports` failure path yields solid
  `--bg-raised` — never washed translucency)
- booklight (clamped, lab-ignoring)
- the page-turn beat (8px drift + 3px blur, `--dur-turn`)
- shelf camera transitions, the progress hairline
- blur is token-budgeted: glass 16px, scrim 6px — no raw radius
  anywhere

the rejected list is as important as the live one: glow/cursor-
chasing, edge dissolve, particles, generative wallpaper, premature
graph presentation — each with its reason (no semantic job, no proven
benefit, or another layer's law defers it). 8 registry laws hold the
teeth; walls never blur; the five annotation colors remain the only
saturated privilege.

## the yield (L17)

the reading column yields to the open workbench by a 200px transform
slide — never a reflow. the place is sacred: geometry changes, the
page's own position does not. pdf pages yield identically. the
sub-1306px viewport is the one documented exception (the yield
shrinks there).

## the room's memory

the room store carries the desk context across every roundtrip:
surface, book, locator, mode, workbench document, scroll preservation,
compact state. returning to the desk is returning to *the same desk*.
