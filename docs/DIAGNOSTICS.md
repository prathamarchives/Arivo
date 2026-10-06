# diagnostics — structured evidence

> every significant failure emits a structured event; the export answers
> "what happened?" without ever containing what you read.

## the recorder

`packages/core/src/diagnostics.ts` — a capped ring buffer (500 events)
with levels (`info | warn | error`) and dot-namespaced events:

```
database.rebuilt            index was damaged → rebuilt (with the numbers)
book.reconciliation.*       NEW / MODIFIED / MISSING / CORRUPT / ... per book
book.reconciliation.completed  scan summary: scanned, fixedPoint, anomalies
book.import.completed/failed   per-import outcomes
diagnostics.exported        the user exported a report
```

## the privacy rule — mechanically enforced

`scrubData` runs ON ENTRY (the buffer never holds raw content):

- content-shaped keys (`text`, `note`, `content`, `excerpt`, ...) are
  dropped outright
- strings are capped at 200 chars
- arrays collapse to counts; nested objects stay opaque

`diagnostics.test.ts` proves a recorded `text: 'SENSITIVE'` never
appears in the buffer, the export, or json serialization.

## the export

settings → export diagnostics writes a json report (version, platform,
schema version, library stats, last reconciliation, event counts,
events) through a main-side save dialog — no renderer path input, ever.
