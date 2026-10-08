# release — shipped behavior

releases are deliberate acts. a push to `main` proves the build; a tag
`vX.Y.Z` produces an installer. nothing else ever ships.

## the gate (every push to main, ci.yml)

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck` — 7 projects
3. `pnpm lint`
4. `pnpm test` — the full vitest suite
5. `pnpm build` — with `verify-bundle.mjs` inside it: no externalized
   `@arivo/*.ts` requires may survive in the main/preload bundles
   (the v0.2.1 packaged-crash class, caught statically)
6. **the packaged-launch gate** — a second job packages the app
   (electron-builder `--dir`, real asar + real node_modules paths),
   fixes the chrome-sandbox helper ownership, boots it headless under
   xvfb with `--smoke`, and uploads the screenshot as an artifact.
   dev and unit tests cannot see packaging failures — pnpm symlinks
   mask them — so ci boots the actual package. window creation,
   renderer load, service init (sqlite included), and the rendered
   screenshot are the assertions.

## the release (tag push, release.yml)

on `v*` tags, a windows runner:

1. the full gate again (`pnpm check && pnpm build`) — no installer
   from a red build
2. `dist:win` — the nsis installer
3. **the update-feed emission gate** — `latest.yml` (the feed) and
   `app-update.yml` (the installed build's feed pointer) must both
   exist in the package; a missing feed is a release-blocking error
4. sha256 checksums for every `.exe`
5. attach installer + checksums + feed + blockmap to the github
   release
6. **verify the update feed end-to-end** — the run downloads its own
   release back and checks version, assets, and sha512 against the
   actual bits. a green release run is proof the feed works.

## how installed copies update

from 0.2.1 on, every packaged build checks the feed at launch and
every 4 hours: one GET to the repo's releases, nothing about the user
leaves the machine, download in background (differential blockmap
when possible), install on quit. offline or a broken feed: silent
no-op — reading never depends on the network. `ARIVO_NO_UPDATE=1` is
the kill switch. dev builds never check. the feed requires the repo's
releases to be anonymously readable (a private repo 404s the chain —
this bit us once; the verification step exists to catch it; never
ship a token to work around it).

## the release checklist

1. land the change on `main`, ci green (both jobs)
2. bump `version` in root + `apps/desktop` package.json
3. `git tag vX.Y.Z && git push origin vX.Y.Z`
4. release run green — including the feed verification
5. `node scripts/verify-update-feed.mjs vX.Y.Z` locally to see the
   feed with your own eyes

local nsis packaging needs wine on linux/mac — packaging owns the CI
runner, not the dev machine.

## upgrade behavior

the installer installs over the old copy; `~/Arivo` (the library, the
truth) and the app-data index are untouched. the index migrates
automatically on first launch (schema 1 → 2 → 3 → 4, each in place,
each covered by migration tests with real legacy fixtures). v0.1.0 /
v0.2.0 installs predate the updater — the first hop is manual.
