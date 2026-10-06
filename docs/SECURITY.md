# security — the boundary is real

> the reader is local, but the documents are untrusted input and the
> renderer is untrusted code. every layer below is enforced by a test.

## the renderer cannot touch the machine

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- the preload is the only bridge; it imports electron + `@arivo/core`
  and nothing else — `tests/architecture.test.ts` proves it by scanning
  source
- renderer code imports no `electron`, no `node:*` — same test
- no `contextBridge` usage outside preload — same test

## ipc is a validated boundary, not a convenience

- every channel validates its payload with a runtime schema
  (`packages/core/src/validation.ts` combinators) BEFORE touching a
  service — typescript disappears at runtime, validation does not
- failures return typed envelopes `{ok: false, error: {code, message}}`;
  preload unwraps so codes survive the bridge
- schemas live in `apps/desktop/src/main/ipc-schemas.ts`, electron-free
  on purpose: `ipc.test.ts` attacks them with null/undefined/wrong
  types/huge strings/bogus enums/malformed structures + a 500-run json
  fuzz — nothing reaches a service unvalidated
- no channel accepts a destination path for writes: exports and
  diagnostics go through main-side dialogs only

## path guards

- the library root must be an absolute, non-root path
  (`services/paths.ts` — `validateLibraryRoot`)
- import sources must be absolute with a book extension
- `ensureInside` containment guards every id-derived path resolution
- second instances exit (`requestSingleInstanceLock` before window
  creation — architecture test)

## documents are hostile input

`packages/documents/src/security.ts` enforces BEFORE any parse:

| limit | value |
|-------|-------|
| max book file | 512 MB |
| max zip entries | 4,096 |
| max total decompressed | 2 GB |
| max single entry | 512 MB |
| max compression ratio (payloads > 1MB) | 500:1 |
| max metadata field | 4,000 chars |
| max cover | 12 MB |

- zip bombs rejected before extraction (`security.test.ts` builds real
  deflated bombs)
- traversal-shaped names rejected (depth-walk); jszip's own name
  normalization is the second layer — both are tested
- container.xml pointing outside the archive is rejected
- 200-run fuzz: arbitrary bytes as .epub/.pdf never crash the pipeline,
  only typed rejections

## the error model

typed `ArivoError` codes (`INVALID_DOCUMENT`, `DATABASE_CORRUPT`,
`PATH_ESCAPE`, `VALIDATION_FAILED`, ...) — "something went wrong" is
banned. codes map to diagnostics events and to user messages.
