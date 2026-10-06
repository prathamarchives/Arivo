# AGENTS.md

you are working on **arivo** — a local-first reading environment (electron +
react + ts). before anything: read `docs/CONSTITUTION.md`. the laws are not
metaphors; they are enforced in eslint and proven in vitest.

## the shape

```
packages/core        pure domain: entities, anchors, contracts, export
packages/database    sqlite index + dual-write + fts5 + rebuild
packages/documents   import pipeline: inspect, validate, extract
packages/ui          tokens, themes, reading css, primitives
packages/reader      epub.js + pdf.js behind the format contract
apps/desktop         the shell: main (ipc, protocols), preload, renderer
```

the dependency law: nothing imports upward; the renderer never imports
electron; core stays pure. violations fail `pnpm lint`.

## commands

```
pnpm install     (allowlist in pnpm-workspace.yaml)
pnpm dev         electron + hmr
pnpm dev:web     renderer + mock api in the browser (ui dev loop)
pnpm check       typecheck + lint + test — green before anything
pnpm smoke       headless boot + screenshot of the real app
pnpm test        vitest (25 tests incl. the portability law)
pnpm rebuild:native   better-sqlite3 → electron abi (after node-abi tests)
pnpm dist:win    the windows installer
```

## the workflow

1. cold start: `docs/PROTOCOLS/cold-start.md`
2. build to spec; deviations require an ADR (`docs/DECISIONS/`)
3. self-check: `pnpm check` + the component five-layer check
4. handoff: `docs/PROTOCOLS/handoff.md` — conventional commit + session note

## the traps (learned the hard way — read twice)

- **better-sqlite3 has one ABI.** vitest runs on node; electron runs on its
  abi. run `pnpm rebuild:native` after a test session that touched the
  database, before `pnpm dev`/`smoke`. ci is fine (fresh installs).
- **epub.js 0.3.93 quirks:** the factory is the default export;
  `themes.register(name, cssString)` treats css as a URL — inject `<style>`
  elements per rendered section instead (see EpubAdapter.injectStyleInto);
  blob iframes don't inherit parent font-face — fonts are data-embedded
  (renderer/src/lib/book-fonts.ts).
- **the renderer has no node globals.** no Buffer, no require — uuidv7 is
  pure (it crashed once already).
- **app:// not file://.** es modules over file:// are CORS-blocked; the
  shell serves the dist over the app:// protocol.
- **did-finish-load fires during `await loadURL`.** wire listeners before
  the load, or you never see the event (this cost us a smoke run).
- **the epub is untrusted input.** strings and one image, never scripts.
  contextIsolation on, nodeIntegration off, sandbox on.

## the qa gates

per component (ui): structure / visual / interaction / motion / edge cases.
per feature: every state designed (empty, loading, error, drifted,
orphaned). per data change: the round-trip (write → kill index → rebuild →
zero loss). per reader change: the repagination proof.
