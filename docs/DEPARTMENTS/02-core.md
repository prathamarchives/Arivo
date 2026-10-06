# dept 02 — core engineering

owns: domain, database, import, anchors, export.

- domain (packages/core): pure typescript. entities, the format contract,
  the anchor engine, uuidv7, markdown export. zero deps.
- database (packages/database): sqlite index + fts5 + the dual-write store.
  json truth first, index second, rebuild from truth is one call.
- import (packages/documents): validate → hash → parse opf → cover
  extraction (the full epub2 + epub3 detection chain) → write the book
  folder. the epub is untrusted input: strings and one image, never scripts.
- the portability suite is the law's proof (see store.test.ts).

ship checks: a highlight survives index deletion (automated). import
rejects broken files with reasons.
