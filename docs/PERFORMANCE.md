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
