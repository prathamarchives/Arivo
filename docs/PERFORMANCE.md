# performance — evidence, not opinion

`pnpm bench` measures the engine at 100 / 1,000 / 10,000 books and writes
`benchmarks/REPORT.md`. budgets live in docs/QUALITY-BAR.md; a budget
regression is a bug.

## current results (linux, node 24)

| scale | startup | search p95 | rebuild | reconcile (unchanged) | annotation write |
|-------|---------|-----------|---------|----------------------|------------------|
| 100 | 0.7ms | 2.2ms | 77ms | 23ms | 0.5ms |
| 1,000 | 2.5ms | 6.3ms | 743ms | 505ms | 1.0ms |
| 10,000 | 21ms | 47ms | 7.6s | 2.2s | 0.6ms |

all 10k budgets met with an order of magnitude of headroom. the
unchanged-scan fast path (mtime + size, no hashing) is what keeps
reconciliation cheap at scale; the first scan backfills `fileMtime` into
metadata so every later scan is stat-only.

50k/100k libraries: the engine's per-book costs are linear and
benchmarks extrapolate within budget; measured numbers for those scales
belong on the owner's real hardware.

## the renderer at volume (live, L15)

- the archive ledger with **5,000 objects** injected: **61fps**
  scrolling (rAF probe over a full second), 709k-px scroll height,
  jump-anywhere 0.1ms
- the containment law at its extreme: scrolled to the very bottom,
  **8 cards render** (the viewport's worth) — content-visibility +
  honest intrinsic sizes
- the 5,000-card mount costs ~1–2s on the runner: under the ledger's
  budget, measured, virtualization deferred (not built speculatively)
- the pdf render window bounds canvases to current±2: no accumulation
  path exists (W2.1's cliff-killer)

## the leak sweep (L15)

- the reader's teardown is complete: adapter.destroy, saveTimer
  cleared, session ended, keydown/beforeunload removed — verified in
  the boot effect's cleanup
- mock blob urls revoked on book removal (the one real leak found)
- DraftEngine timers dispose with their surfaces; the persist queue is
  per-mount
