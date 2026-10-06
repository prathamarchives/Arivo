# the data lifecycle

```
                     ┌────────────────────────────┐
                     │  ~/Arivo/library/{id}/     │  TRUTH (human-browsable)
                     │    book.epub | book.pdf    │
                     │    cover.jpg               │
                     │    metadata.json           │
                     │    annotations.json        │
                     └─────────────┬──────────────┘
                                   │  write first, atomically
                                   ▼
                     ┌────────────────────────────┐
                     │  app-data/index.db (wal)   │  DERIVED (disposable)
                     │  books/highlights/fts/...  │
                     └─────────────┬──────────────┘
                                   │  reconcile on every launch
                                   ▼
                     ┌────────────────────────────┐
                     │  verified state            │
                     │  (fixedPoint === true)     │
                     └────────────────────────────┘
```

- every mutation: truth first (atomic + fsynced), index second
- delete the index → rebuild → equivalent derived state (the portability
  law, proven at 1,000-annotation scale)
- the index migrates (never downgrades silently); corruption at open is
  detected and recovered with a report
- deleting a book folder and returning it converges to the same id with
  the same annotations
- exports (reading notes, diagnostics) go through main-side dialogs;
  the library folder zipped IS a complete portable backup
