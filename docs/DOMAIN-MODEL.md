# the domain model

v0.1 keeps the schema small by law. the full work/edition/asset abstraction
(the v0.3 target) is already structurally satisfied: `books` = work,
`book_files` implicit in the folder, annotations attach to the work id.

## entities

```
Book              id, title, subtitle, authors[], description, language,
                  publisher, publishedYear, coverPath, format (epub|pdf),
                  hash (sha256 = identity), fileName, fileSize,
                  tags[], addedAt, updatedAt
ReadingProgress   bookId, locator (cfi | page:n), percent, chapter,
                  startedAt, lastReadAt, completedAt
Highlight         id, bookId, anchor, color, text, chapter, note,
                  status (resolved|drifted|orphaned), createdAt, updatedAt
Bookmark          id, bookId, anchor, label, chapter, createdAt
ReadingSession    id, bookId, startedAt, endedAt, durationMs,
                  startPercent, endPercent      (behavior is data)
Collection        id, name, description, createdAt  (+ items)
Anchor            primary, textRange{exact,prefix,suffix},
                  position{spineIndex,page,percent,chapter}
```

## anchor semantics

| tier      | survives what                          | epub                | pdf                  |
| --------- | -------------------------------------- | ------------------- | -------------------- |
| primary   | repagination (font/theme/size changes) | cfi                 | page+offsets+rects   |
| textRange | edition swaps, text edits nearby       | exact+prefix+suffix | same                 |
| position  | everything else — approximate          | spineIndex+percent  | page                 |

outcomes: `resolved` / `drifted` (found nearby, re-anchored, visible) /
`orphaned` (text gone; the note lives in the notebook). never dropped.

## lifecycle

```
created → modified → (drifted → re-anchored) → archived/removed
```

removal offers two paths — keep files, or delete the folder (the folder is
the book; deletion is unambiguous).

## the v0.3 target shape (documented, not built)

```
Work ── Edition ── FileAsset
  ├── ReadingSession ── Events
  ├── Annotation (Highlight | Bookmark | Note | Artifact)
  ├── KnowledgeObject (Concept | Connection | Question | Source)
  └── AIThread (messages, context, suggestions — promotion-gated)
```
