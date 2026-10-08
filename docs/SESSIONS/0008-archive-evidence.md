# session 0008 — the archive becomes evidence (L11)

> starting commit: 6bb12e6 (L10 landed, 414/2 green)
> branch: campaign/experience-v0.6

## objective

L11 — the archive as evidence of a mind at work: the object model and
the provenance chain first, presentation only where it earns its keep.
deliberately NOT a notes database, a file manager, a dashboard, or a
graph-first toy.

## the object model

`ArchiveEntry` grows from marks-only to the work's whole family:

- **highlight / bookmark** — the marks (unchanged behavior)
- **note** — margin notes, the questions among them flagged
  (`question: true`) — the archive's own thoughts
- **deskdoc** — the workbench's papers, with `deskKind`
  (research / make / reflect), the title, an honest body snippet, and
  `sourceRefs` — the collected passages riding along as the provenance
  chain: artifact → note → selection → chapter → book

every entry keeps the golden-5 contract: bookId + the anchor back to
the exact passage. a desk document's anchor is its freshest collected
passage; each ref is individually returnable.

## the ledger (store + surface)

`listArchiveMarks` extends with two more joined queries (notes, desk
docs) — still one pass per family, never n+1, sorted newest-first. the
browser mock mirrors the whole shape. the room's count line speaks
honestly: "4 objects — 0 marks, 1 note, 3 documents".

**ArchiveRoom**: the card's glyph now says the kind at a glance
(question, research, make, reflect — ink, not hue). note cards render
the thought in the author's-voice slot with a question flag; document
cards render title + snippet + their collected passages as
individually clickable refs (each returns to its exact passage, capped
at three with an honest "… and N more"). clicking a document returns
INTO the desk: the book opens, the mode switches to the doc's kind,
the workbench opens with that document — the world model's
archive→desk transition, proven live.

**scale**: the cards carry `content-visibility: auto` (the shelf's own
containment law) — the ledger holds thousands without paying for the
offscreen ones. 1,000 objects read in one pass: tested at 2.06s on a
loaded shared runner (generous budget, honest number).

## live proof (dev:web, the L10 session's own data)

- the ledger counts and renders all four kinds: the make artifact
  ("essay skeleton" + body), the question note (flagged, full text),
  the research collection ("quotes — The Burnout Society", 1 passage
  kept + the quote), the reflection
- **the return proof**: archive → click the research document → the
  desk opens with the book remounted, mode `research`, the workbench
  showing exactly that document with its quote + source jump
- the ref's own jump: click the passage → the reader navigates, the
  workbench stays open
- evidence: docs/screenshots/l11-01, l11-02 (VLM-read: all cards, the
  question, the passage kept)

## verification

- **P2**: typecheck + lint clean; **417 passed / 2 skipped** (+3
  archive-ledger tests: provenance join, index-death survival, the
  1,000-object pass).
- **P3 live**: the full loop above on the session's real data; seed
  removed after (law 4, no third offense this time — it never shipped
  into the tree).
- design-law: the new CSS rides tokens; the question's mark is the
  existing accent ink, cards keep the r-object radius ladder.

## honest scope notes

- the zip's later representations (timeline / wall / thread / cluster /
  map) stay deferred BY DESIGN: "relationships should exist before
  graph visualization" — the relationships now exist (sourceRefs,
  provenance anchors); the spatial/graph presentation is L12+ work
  with its own creative verification.
- cross-book connections (note ↔ note across sources) need an explicit
  connection object — not invented here; it is the archive's honest
  next surface when the ledger's density justifies it.
- the desk doc's position in day groups follows `updatedAt`; a doc
  touched repeatedly stays in today's group — time structure is honest
  structure.

## next

L12 — creative graphics with semantic jobs only (booklight lives; the
wall stays matte, instruments stay glass; every effect carries purpose,
budget, reduced-motion twin, and fallback).
