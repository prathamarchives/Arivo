# architecture

## the layers (the dependency law)

```
apps/desktop          the electron shell — main, preload, renderer
  └── packages/reader     format plugins: epub.js + pdf.js adapters
        └── packages/ui       tokens, themes, materials, primitives
              └── packages/core    entities, anchors, contracts — pure ts
  └── packages/database   sqlite index, dual-write, fts5, rebuild
        └── core
  └── packages/documents  import pipeline: inspect, validate, extract
        └── core
```

enforced in `eslint.config.mjs` — a violation fails ci.

## the data flow (one example: import)

```
drop epub
  → renderer: window.arivo.getPathForFile (preload, webUtils)
  → ipc library:import
  → documents.inspectFile     validate zip → parse opf → extract cover → sha256
  → documents.writeBookFolder {book-id}/ copy + cover.jpg + metadata.json + annotations.json
  → database.indexBook        sqlite rows + fts5
  → store refresh → the book appears with its cover
```

every visible feature traces to data, state, logic, storage, interaction,
and failure behavior — the reverse-engineering rule.

## truth vs index

| store        | role                              | loss tolerance |
| ------------ | --------------------------------- | -------------- |
| `~/Arivo/library/{id}/annotations.json` | durable truth: marks, notes, desk documents | zero |
| `~/Arivo/library/{id}/metadata.json`   | book truth      | zero           |
| `~/Arivo/library/collections.json`     | collections     | zero           |
| `%APPDATA%/Arivo/index.db`             | query index + fts + sessions + desk_docs + archive | rebuildable |
| `~/Arivo/config/settings.json`         | settings        | trivial        |

the index lives in os app-data, never inside `~/Arivo/` — users sync that
folder, and a cloud-synced sqlite file corrupts.

## the command surface

the renderer cannot touch the filesystem. everything goes through the typed
`ArivoApi` (`packages/core/src/api.ts`), implemented once by the preload
(electron) and once by the browser mock (dev loop). book bytes stream over
the `arivo://` protocol (`arivo://book/{id}`, `arivo://cover/{id}`).

the built renderer loads over `app://arivo/` — file:// blocks module
scripts (CORS), so the shell serves the dist itself.

## the reader engines

- **epub** — epub.js in paginated mode behind `EpubAdapter`. themes are
  injected as a `<style>` per rendered section (epub.js 0.3.93's css-string
  theme path misroutes strings as urls). fonts are data-embedded @font-face
  because blob iframes don't inherit the parent's font-face.
- **pdf** — pdfjs-dist v6, canvas + text layer, page anchors
  `{page, offsets, rects}` as normalized rects. night mode inverts the
  canvas (the honest fixed-layout answer).

## the anchor engine

`packages/core/src/anchor.ts` — pure, whitespace-insensitive matching that
returns **raw-string offsets** (mapped from normalized space), so the epub
adapter can mint a repaired CFI from DOM text nodes:
exact → prefix/suffix window → prefix anchor → suffix anchor → orphaned.
the epub runtime validates each cfi on book open, repairs via text match,
and persists the repair — drift is visible in the notebook.

## verification

- `pnpm check` — typecheck (7 projects) + eslint + vitest
- the portability suite: write a highlight → delete the index → rebuild →
  zero loss (session 5's ship check, automated)
- `pnpm smoke` — headless electron boots the real app, screenshots it,
  and gates the fonts (all four families must load from the bundled
  assets — a dead @font-face fails the run)
- `pnpm dev:web` — the full renderer in a browser with a mock api for the
  ui dev loop
- `pnpm bench` — the store at 100/1k/10k books (budgets in
  docs/QUALITY-BAR.md, report in benchmarks/REPORT.md)

## the experience surfaces (above the command surface)

the room (`stores/room.ts`) owns the place: shelf ↔ reader ↔ desk with
spatial memory (surface, book, locator, desk mode, workbench document).
the desk's five modes (read/mark/research/make/reflect) and the archive's
ledger are renderer surfaces over the same command surface — desk
documents are `DeskDoc` rows (sqlite) mirrored from per-book
annotations.json (truth-first, migration 004), questions are margin notes
with `question: true`, and the archive's `listArchiveMarks` joins four
object families in one pass per family.
