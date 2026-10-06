# ADR-001 — electron over tauri (and over web)

status: accepted

both planning lineages converged on electron. for an agent-built,
director-reviewed, single-language app: typescript everywhere, zero rust
friction, consistent chromium rendering (the ui is the product), pdf.js and
epub.js run natively in the webview. binary size is irrelevant in 2026.

the alternative — a next.js web app with supabase — loses the local-first
constitution on arrival: books in cloud storage, offline as an afterthought,
data hostage-in-waiting. arivo exists to kill that shape.

## ADR-002 — sqlite as index, json as truth
status: accepted

~/Arivo/ is the library; the sqlite file in app-data is a cache. every
annotation mutation writes annotations.json first (atomic .new → rename,
.bak salvage). rebuildIndex() reconstructs the db from a folder scan. the
portability suite proves it: kill the index → rebuild → zero loss.

## ADR-003 — the format plugin contract
status: accepted

reader, annotations, search, and progress speak only to FormatReader
(parse/render/locate/anchors/search/chapters). epub and pdf implement it.
law: no format-specific code above packages/reader. consequence: foliate-js
is a contained swap if epub.js dies; mobi/cbz are contained additions.

## ADR-004 — epub.js 0.3.93, wrapped
status: accepted (with known scars)

epub.js is barely maintained; we accept it for v0.1 behind the adapter.
documented workarounds in-tree: css-string themes are broken (we inject
style elements per rendered section), fonts must be data-embedded (blob
iframes don't inherit parent font-face), the default export factory.
fallback: foliate-js behind the same contract.

## ADR-005 — app:// protocol for the renderer
status: accepted

file:// blocks es modules (CORS). the shell serves the built renderer over
a privileged app:// scheme; book bytes and covers stream over arivo://.
the protocol handlers read files directly (no net.fetch — it drags the
network service in).

## ADR-006 — windows first
status: accepted

the owner reads on windows. nsis installer via electron-builder; ci builds
on windows-latest. mac/linux targets remain one flag away.
