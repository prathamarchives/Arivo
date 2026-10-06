# dept 01 — foundations

owns: the repo, the build, ci, the contracts in code.

- monorepo: pnpm workspaces, 5 packages + the app. the dependency law is an
  eslint rule (see eslint.config.mjs) — boundary violations fail ci.
- build: electron-vite (main / preload / renderer). better-sqlite3 stays
  external (native). the renderer dist loads over app:// in production.
- packaging: electron-builder, nsis target, windows-first. `pnpm dist:win`.
- ci: lint + typecheck + test on every push/pr; release workflow builds the
  windows installer on tags.
- scripts: dev (electron), dev:web (browser + mock), smoke (headless
  screenshot), rebuild-index, dist:win.

ship checks: clean clone → pnpm i → pnpm dev opens a window. pnpm check green.
