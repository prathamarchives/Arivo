# session 0007 — the desk becomes a workbench (L10)

> starting commit: 802de31 (wave 2 landed, 385/2 green)
> branch: campaign/experience-v0.5

## objective

L10 — the desk's completion: the five attention modes (READ / MARK /
RESEARCH / MAKE / REFLECT) as instruments around the book, and the
persistence contract — user text must never disappear.

## the modes

READ and MARK already lived in the attention model + the selection
flow. what was missing: the workbench (research / make / reflect), the
question instrument, the collect bridge, and the whole persistence
contract.

**the mode system** (room.ts): `DeskMode` rides the `DeskContext` —
modes are properties of the desk, not routes. switching never
recreates context; the workbench's open document rides along. the
work modes engage the room (chrome cannot withdraw mid-work); READ and
MARK trust the attention law exactly as before (the exit predicate,
tested as regression 6). the mode rail: five quiet chips at the
bottom edge, fading with the chrome; Alt+1..5 switch from anywhere,
even mid-compose — the mirror holds the text.

**the workbench** (features/desk/Workbench.tsx): one drawer, three
kinds — research (quotes + citations + questions), make (artifacts
composed from the source's material), reflect (synthesis,
disagreement). one entity: `DeskDoc` with `sourceRefs` — a quote +
its durable locator + provenance (which mark it came from). the
editor: title + body, each through a DraftEngine; the status line
speaks the honest vocabulary (`draftStatusText`); the ref list jumps
back to the exact passage.

**the question** (migration 004): a margin note that asks rather than
asserts — `notes.question`, additive column, tolerant on old truth
files. the mark menu's question instrument opens the composer framed
"what do you want to find out?"; the notebook flags it.

**the collect bridge**: the mark menu's collect (the world model's
"selection reveals contextual tools for … research") builds a
SourceRef from the live selection and lands it in the open research
doc — or starts one — switching the desk to research. the quote
arrives with its place kept.

## the persistence contract (the campaign's core demand)

**DraftEngine** (lib/drafts.ts): the state machine is real —
draft → saving → saved → modified → error → recovered.

- every keystroke lands in a localStorage mirror SYNCHRONONELY
  (before anything else can fail)
- the store write is debounced (800ms); on confirmation the mirror
  retires — the store is truth
- a failed write keeps every character (state error, retry available)
- a death mid-write resurrects as `recovered`: the mirror wins
  because the store never saw it — and the recovered text saves with
  the next edit
- a snapshot guard: text typed DURING an in-flight save is never
  falsely marked saved (the flight confirms only the snapshot; the
  newer text schedules its own save)
- explicit-save surfaces (the composers) pass `autoSave: false`:
  keystrokes mirror, the store only sees a save the user asked for —
  never an accidental mark
- `discard()` is the one intentional exit: ESC in a composer clears
  the mirror deliberately — the user spoke

11 engine tests prove the whole contract (drafts.test.ts), plus
regression law 5: every writing surface routes through the engine, no
raw useState holds user text, the notebook saves its edit drafts on
unmount (blur never fires there).

## storage (the house law followed)

migration 004 (`desk-docs`): the `desk_docs` table + FTS + the
notes.question column. dual-write: annotations.json first (the truth
file gains `deskDocs`, tolerated absent on old files), sqlite second.
delete cascades with the book. `rebuildIndex` restores desk docs from
truth (tested: index death → zero loss). search finds desk docs
(kind `deskdoc`). a real v3 database upgrades in place and takes
writes (tested byte-for-byte against migrations 001–003).

IPC: `desk:listDocs/createDoc/updateDoc/deleteDoc` — schemas,
handlers, preload, and the browser mock (which persists through
localStorage, making the whole contract live-provable in dev:web).

## live proof (dev:web, synthetic seed — removed after, law 4)

- the mode rail renders all five modes; Alt+5 opens the workbench
  from cold reading (keyboard path works with chrome withdrawn)
- reflect: new entry → write → **saved** (store 1 doc, mirror
  retired) → type more → hard navigate (crash) → reopen → **recovered**
  with the unsaved text IN THE DISPLAY → one keystroke → **saved**,
  store holds the recovered words. exactly 1 doc (no duplicates)
- collect: drag-select a passage in the epub → the menu (six
  instruments: 5 colors + note / question / bookmark / collect /
  copy) → collect → desk switches to research → the quote lands as a
  sourceRef with its chapter, jumpable back to the passage
- question: select → question → write → Ctrl+Enter → the note saves
  with `question: true`; the notebook shows the "question ·" flag
- spatial memory: research-mode with open doc → shelf → return →
  same mode, same drawer, book remounted. (exit predicate held)
- make: new artifact → write → saved; title + body persisted
- evidence: docs/screenshots/l10-01..l10-05 (VLM-read: drawer, quote,
  chips, status line all render)

## live-found bugs → fixed + lawed

1. **the recovered text that never reached the display**: the engine
   recovered the mirror (status recovered) but the editor rendered
   the doc prop's store text — the recovered words were in the
   machine, not on the screen. fix: the engines OWN the text; the
   editor renders engine text (title/body state flows from
   subscribe).
2. **the duplicate doc**: `existsInStore` was a stale first-render
   snapshot (empty, before the async load) — a loaded doc looked
   unknown and got CREATED twice. fix: the set syncs with every
   load/persist; plus `createdHere` closes the two-rapid-persists
   race (the desktop store would rightly refuse the second create —
   the engine would have errored forever). the mock's updateDoc
   became insert-if-missing (mirroring the desktop store's honest
   fallback) and createDoc idempotent.
3. **regression 4, live again**: the verification seed epub un-skipped
   the real-book test and failed the cover assertion — the law held,
   the seed removed after verification.

## verification

- **P2**: typecheck + lint clean; **414 passed / 2 skipped** (+11
  draft-engine, +6 room mode, +7 store L10, +2 regression laws
  [5, 6], +question round-trip; migration tests updated to v4).
- **P3 live**: the full golden path above, on the synthetic seed;
  seed removed after.
- **P6**: Alt+1..5 mode switching (works while typing — the mirror
  holds text); Escape returns to READ; the mode chips are focusable
  buttons with aria-pressed; status colors are ink-based (no hue
  law broken).
- design-law: 28/28 (the new CSS rides tokens only; two raw-weight
  600s caught + fixed to 700 during the pass; --dur-comp/--ease-out
  corrected to the ladder).

## honest scope notes

- MAKE is composition (title + body + material refs), not a sketch
  canvas — drawings/sketch surfaces belong to L12's creative
  graphics, where the campaign explicitly warns against a generic
  design application.
- RESEARCH's "related books / papers" strip deferred to L11 (the
  archive owns cross-book relationships; a premature strip here would
  duplicate that surface).
- the desktop (electron) path of the desk IPC shares the store layer
  tested in packages/database; the live proof ran on the web mock,
  which persists identically through localStorage. the packaged-app
  proof belongs to the packaging campaign.

## next

L11 Archive — the object model + provenance first (note → selection
→ chapter → book), then presentation. the desk docs + questions +
collected quotes are its raw material: the archive's "evidence of a
mind at work" now has evidence to keep.
