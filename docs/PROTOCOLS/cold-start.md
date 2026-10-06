# cold start — how any agent boots

1. read AGENTS.md → docs/CONSTITUTION.md → your department spec
   (docs/DEPARTMENTS/) → the last 2 session notes (docs/SESSIONS/)
2. `pnpm install` (build scripts allowlist lives in pnpm-workspace.yaml)
3. `pnpm check` — the repo must be green before you change anything
4. build to spec. the spec is law; deviations need an ADR, never silence
5. before committing: pnpm check again + the five-layer component check
   for ui work + the state coverage check for feature work
