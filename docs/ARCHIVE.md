# the archive (L11) — shipped behavior

the archive is evidence of a mind at work. it is downstream of the
desk: every object is real, carries its provenance, and returns to
the exact place it came from. it is deliberately not a notes
database, a file manager, a dashboard, or a graph.

## the object families

- **highlights** — the author's words the user kept (identity color)
- **bookmarks** — places held
- **notes** — the user's margin thoughts, the questions flagged
  (`question ·`)
- **desk documents** — research collections, made artifacts,
  reflections: title, body snippet, and the collected passages
  (quote + locator + origin) riding along

every entry carries the full provenance chain:
`artifact → note → selection → chapter → book`.

## the surface

- day groups (today, yesterday, dates) — time structure is honest
  structure; newest first
- the count line speaks: "17 objects — 5 marks, 3 notes, 9 documents"
- a document click returns INTO the desk: the book opens, the mode
  switches to the document's kind, the workbench opens with exactly
  that document (the world model's archive→desk transition)
- each collected passage is its own door: click → the exact source
  passage
- the authored empty state: "your work will gather here" — a room
  waiting, never an apology
- scale: cards carry `content-visibility` — 5,000 objects scroll at
  61fps; at the bottom of a 709k-px ledger, 8 cards render

## the ledger (storage)

`listArchiveMarks` joins all four families — one pass per family,
never n+1. measured at 10k-book scale: 50,100 objects in 312ms
(budget 2s). the browser mock mirrors the whole shape. the ledger
survives index death (rebuild from truth, tested).

## what is deliberately deferred

timeline / wall / thread / cluster / map presentations: the
relationships now exist (sourceRefs, provenance anchors); the spatial
presentation earns its place in a future layer with its own creative
verification — the zip's own law: "a graph is not automatically the
right UI."
