# release and update delivery

the answer to "how does my software get updated when i push changes?" —
as a mechanism, not a promise.

## the two pipelines

**push to `main` → proof, no product.**
every push runs the quality gate on a clean runner: typecheck (7 projects),
lint, the full test suite, the build. a red main is impossible to miss. no
installer comes out of a plain push — releases are deliberate acts
(`git tag`), and that deliberateness is what makes the gate meaningful.

**tag push `vX.Y.Z` → a release.**
`git tag v0.2.1 && git push origin v0.2.1` fires `release.yml` on a windows
runner: the full gate runs again, then the nsis installer, sha256 checksums,
and the update feed (`latest.yml` + `.blockmap`) are built and attached to
the GitHub release. the run's last step downloads its own release back and
verifies the feed end-to-end (version match, assets present, sha512 of the
actual bits) — a green release run is proof the feed works, not hope.

## how installed copies update

from 0.2.1 on, every packaged build checks the release feed at launch (and
every 4 hours after):

- one GET to `github.com/prathamarchives/Arivo` — the atom feed and
  `latest.yml`. nothing about the user or the library leaves the machine.
- if a newer version is found: it downloads in the background (with
  differential blockmap transfer when possible), shows a notification,
  and installs on quit — silently, into the same install location.
- offline, rate-limited, or a broken feed: a silent no-op. the reading
  experience never depends on the network (I-34).
- `ARIVO_NO_UPDATE=1` is the kill switch.

dev builds (`pnpm dev`) never check. the check lives in
`apps/desktop/src/main/updates.ts`; the feed contract is pinned by
`updates.test.ts` (gating) and `scripts/verify-update-feed.mjs` (feed).

## the one-time bootstrap

installs from v0.1.0 / v0.2.0 have no updater inside them — the first
hop to 0.2.1 is manual: download `Arivo-0.2.1-setup.exe` from releases and
run it (it installs over the old copy; the library at `~/Arivo` and the
app-data index are untouched). every release after that arrives on its own.

## the release checklist

1. land the change on `main`, CI green
2. bump `version` in `package.json` + `apps/desktop/package.json`
3. `git tag vX.Y.Z && git push origin vX.Y.Z`
4. release run green — including the feed verification step
5. `node scripts/verify-update-feed.mjs vX.Y.Z` locally if you want to see
   the feed with your own eyes

local nsis packaging needs wine on linux/mac — which is exactly why
packaging owns the CI runner and not the dev machine
(`pnpm dist:win` is for windows; CI builds it for everyone else).
