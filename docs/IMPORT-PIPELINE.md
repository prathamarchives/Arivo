# the import pipeline — a crash-safe state machine

```
DISCOVERED   a path arrives (validated: absolute, epub/pdf)
    ↓
VALIDATING   file shape (size, extension) → zip shape (entries, per-entry
             + total sizes, compression ratios, traversal names) →
             container structure — all BEFORE any decompression of payload
    ↓
EXTRACTING   the complete folder is written under library/.staging/{id}/
             (book file, cover, metadata.json, annotations.json — every
             file atomic)
    ↓
COMMITTING   ONE atomic directory rename: .staging/{id} → library/{id}
             a crash before the rename leaves sweepable staging; after it,
             the book exists completely
    ↓
INDEXING     the sqlite row appears only after the commit (truth first)
    ↓
READY        the mutation journal records begin/commit around the whole
             operation — evidence for recovery, never guesswork
```

failure states: `VALIDATION_FAILED` (typed rejection, no folder, no row),
`EXTRACTION/COMMIT_FAILED` (staging swept at startup, library untouched),
`DUPLICATE` (content hash already registered — explicit result, not an
error).

resource limits (documents are hostile input): see docs/SECURITY.md.
observability: every outcome emits book.import.completed / .failed.
