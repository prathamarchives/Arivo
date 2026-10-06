# the audit — the 11/10 acceptance bar, answered with evidence

> run date: 2026-10-06 · commit chain: 638ba52 → a9f6dcf (11 hardening
> commits on top of v0.1.0's bc47014..66055e6) · 158 tests, 16 files

## the questions

**can sqlite disappear?**
yes. delete `index.db` → the next open reconciles the library from truth
to a fixed point with zero loss. proven at 1,000-annotation scale
(`destroy.test.ts`, `reconciliation.test.ts`, `store.test.ts`).

**can the process die during a write?**
yes — and the previous content survives. proven by real SIGKILLs at four
controlled points of the atomic write (`crash.test.ts`); imports commit
with one atomic directory rename; the index runs wal + synchronous-full.

**can a book change outside arivo?**
yes — `MODIFIED` is detected by content hash on the next launch,
metadata + row are re-fingerprinted, annotations are untouched, anchors
re-resolve on open (`reconciliation.test.ts`, `destroy.test.ts`).

**can an annotation move because the document changed?**
yes — the resolver repairs via exact/flank/window/anchor chains with
measurable confidence (`ANCHORING.md`, adversarial corpus + property
tests).

**can repair be ambiguous?**
yes — and arivo refuses to guess: tied candidates resolve to `ambiguous`,
surfaced as *review required*. below-threshold and unrelated-text repairs
are refused (`anchor.adversarial.test.ts`, `anchor.property.test.ts`).

**can malicious epub input hurt the application?**
it is constrained and rejected: shape + limits validated before any
decompression — zip bombs, traversal, huge metadata, entry-count bombs,
200-run garbage fuzz — all typed rejections (`security.test.ts`).

**can the renderer directly access the machine?**
no. contextIsolation + sandbox + a preload-only bridge, proven by
executable architecture tests that scan every source file
(`tests/architecture.test.ts`); every ipc payload is schema-validated.

**can you explain why a failure happened?**
yes — typed error codes across the bridge + structured diagnostics events
with a mechanically enforced privacy rule; recovery decisions report
their numbers (`diagnostics.test.ts`, `docs/DIAGNOSTICS.md`).

**can you prove performance at 10k books?**
yes — `pnpm bench` → `benchmarks/REPORT.md`: startup 21ms (budget 800),
search p95 47ms (100), rebuild 7.6s (60s), reconcile 2.2s (5s),
annotation write 0.6ms (10ms). all budgets met with headroom.

**can you upgrade an old installation safely?**
yes — a real v0.1 database migrates in one transaction to schema 2 with
zero data loss; downgrades are refused; failures roll back
(`migration.test.ts`); the release workflow runs the full gate before
packaging and ships sha256 checksums.

**can you destroy the derived state and recover?**
yes — that is literally a test suite (`destroy.test.ts`): delete,
corrupt, truncate, strand, storm, swell, empty, tamper — then reconcile,
recover, rebuild, verify: no silent data loss, no invalid annotations,
no impossible database state, no unrecoverable derived state.

## the coverage matrix

| subsystem | unit | integration | property/fuzz | crash | destroy | architecture | bench |
|-----------|:----:|:-----------:|:-------------:|:-----:|:-------:|:------------:|:-----:|
| reconciliation | ✓ | ✓ | | | ✓ | | ✓ |
| anchors | ✓ | ✓ | ✓ (4 suites) | | | | ✓ |
| persistence (atomic writes) | ✓ | ✓ | | ✓ (SIGKILL) | ✓ | | |
| migrations / database | ✓ | ✓ | | | ✓ | | ✓ |
| import / document security | ✓ | ✓ | ✓ (fuzz) | ✓ (staging) | ✓ | | ✓ |
| ipc / validation | ✓ | ✓ | ✓ (fuzz) | | | ✓ | |
| search | ✓ | ✓ | ✓ (fuzz) | | | | ✓ |
| concurrency | ✓ | ✓ | ✓ | | ✓ | ✓ | |
| diagnostics | ✓ | ✓ | | | | | |
| recovery | | ✓ | | ✓ | ✓ | | |
| renderer isolation | | | | | | ✓ | |
| release (upgrade) | | ✓ | | | | | |

## what is honestly NOT yet done (no aspirational claims)

- 50k/100k benches run on real hardware (extrapolation only — see
  docs/PERFORMANCE.md)
- CJK fts tokenization is prefix-only (documented limitation of the
  unicode61 tokenizer; substring search for CJK needs a trigram index —
  future migration candidate)
- pdf anchoring is page+text-range based; the adversarial corpus runs
  against the engine, not a real scanned-pdf corpus
- sync/cloud (v0.2+ scope per the constitution) — intentionally untouched
