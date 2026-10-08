# the desk (L10) — shipped behavior

the desk is the source-centered workbench: the book stays the primary
object, work appears around it. five attention modes change the
available instruments without ever becoming pages or routes.

## the modes

| mode | what it is | what it gives |
|------|-----------|---------------|
| read | the resting state | the chrome-withdrawal law owns the screen (attention model) |
| mark | selection in hand | the selection menu: five highlight colors, note, question, bookmark, collect, copy |
| research | gathering the source | the workbench drawer: desk documents of kind research, collected quotes with provenance |
| make | composing | the workbench: artifacts built from the source's material |
| reflect | writing back | the workbench: synthesis, disagreement, the journal side |

- the mode rides the desk context in the room's store — a shelf
  roundtrip returns to the same mode with the same document open
  (spatial memory; tested).
- the mode rail (bottom, quiet chips) fades with the chrome; the
  keyboard reaches every mode from anywhere: **Alt+1..5**.
- the work modes engage the room (the chrome cannot withdraw
  mid-work); read and mark trust the attention law exactly.
- the reading column **yields** to the open workbench (a 200px
  transform slide, never a reflow — the place is sacred; lawed).

## the persistence contract (user text never disappears)

every writing surface — the document editor (title + body), the note
composer, the question composer — rides the DraftEngine:

```
draft → saving → saved → modified → error → recovered
```

- every keystroke lands in a localStorage mirror synchronously
- the store write (IPC → truth file → index) is debounced 800ms; on
  confirmation the mirror retires
- a failed write keeps every character (state error, retry offered)
- a crash mid-write resurrects as `recovered` — the mirror wins over
  the store, the text reaches the display, the next edit persists it
- composers are explicit-save (autoSave: false): the mirror holds,
  the store never sees unrequested marks; ESC is the one intentional
  discard
- the status line speaks the honest vocabulary (`draftStatusText`)

the whole contract is lawed: 11 engine tests + regression 5 (no raw
useState holds user text; unmount saves; Alt-mode-switch cannot cost
text).

## storage

`desk_docs` (migration 004): one entity, three kinds, sourceRefs
carrying quote + locator + origin. dual-write (annotations.json
first, sqlite second), FTS-searchable, cascade with the book,
rebuildable from truth, v3→v4 in place. questions are margin notes
with `question: true`.
