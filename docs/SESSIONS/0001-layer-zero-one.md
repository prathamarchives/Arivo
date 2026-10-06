# session 0001 — layer 0 + layer 1, the long heavy package

## shipped

- the monorepo: 5 packages + the app, dependency law in eslint
- the domain: entities, the format contract, the anchor engine (pure,
  raw-offset matching), uuidv7, markdown export
- the data layer: sqlite index, dual-write (json first), fts5, rebuild —
  the portability suite proves zero loss
- the import pipeline: validation, hashing, opf parsing, the full
  epub2+epub3 cover chain — verified on the owner's real book
- the reading engines: epub.js (style-injection themes, data-embedded
  fonts, drift repair) + pdf.js (page anchors, text layer, night invert)
- the app: library (grid/list, collections, continue-reading, dropzone,
  empty state), reader (chrome fades, toc, notebook, selection menu,
  typography panel, keyboard), ctrl+k palette, export
- 25 tests green, typecheck + lint green, headless smoke screenshot green,
  browser-verified on the burnout society end to end

## known scars (all documented in AGENTS.md)

- better-sqlite3 abi dance between vitest (node) and electron
- epub.js css-string themes broken → direct style injection
- blob iframes don't inherit font-face → data-embedded @font-face
- file:// blocks es modules → app:// protocol
- did-finish-load races await loadURL → wire listeners before load

## next

- the owner's machine: pnpm install && pnpm dev (windows)
- the usage month. then the annoyance log drives v0.2
- pdf verification with a real research paper (only epub verified live)
- branch protection on main once pushed
