# session 0012 — measured, not vibes (L15)

> starting commit: 435713b (L14 landed, 436/2 green)
> branch: campaign/experience-v1.0

## objective

L15 — performance/reliability: the scales (100/1k/10k), the new
surfaces (desk docs, the archive ledger), the renderer at volume, and
the leak sweep.

## the store at scale (the bench, extended)

`pnpm bench` gains two metrics — desk doc write and the archive
ledger (the four-way joined read that is the archive's whole payload):

| scale | desk doc write | archive ledger |
|-------|----------------|----------------|
| 100 | 0.8ms | 3.5ms (600 objects) |
| 1,000 | 0.7ms | 13.3ms (5,100 objects) |
| 10,000 | 0.6ms | **312ms (50,100 objects)** |

budgets (added to QUALITY-BAR's table in REPORT.md): write 10ms, the
ledger 2s @10k — both green with an order of magnitude of headroom.
the existing metrics all held: startup 20.5ms @10k, search p95
47.5ms, rebuild 8.06s, reconcile-unchanged 2.38s, annotation write
0.5ms.

## the renderer at volume (live, adversarial)

5,000 archive objects injected into the browser's mock, the archive
opened, and the ledger scrolled:

- **61fps** scrolling (requestAnimationFrame probe over a full second)
- scroll height 709,407px — the jump anywhere costs 0.1ms
- the containment law at its extreme: scrolled to the very bottom,
  **8 cards render** (the viewport's worth), 4,992 skip
  (content-visibility + honest intrinsic sizes)
- evidence: docs/screenshots/l15-01 (the 5k ledger)

## the leak sweep

- **mock blob urls** leaked on book removal (dev:web surface): fixed —
  `revokeMockBlob` on remove, no stale handles
- the reader's teardown is complete (adapter.destroy, saveTimer
  cleared, session ended, keydown/beforeunload listeners removed —
  all verified in the boot effect's cleanup)
- the DraftEngine's timers dispose with their surfaces; the persist
  queue is per-mount
- canvas accumulation: the pdf adapter's windowed rendering already
  bounds canvases to current±2 (W2.1's cliff-killer); no accumulation
  path exists

## honest notes

- the 5,000-card MOUNT (React tree construction) takes ~1-2s on this
  runner — under the ledger's own budget, and content-visibility
  keeps every frame after it at 60fps. a virtualized list (windowed
  mount) is the honest next step if real libraries ever carry 50k
  objects in one view; measured, documented, not built speculatively.
- GPU/CPU process-level telemetry belongs to the packaged-app
  campaign (electron's own tooling), not the dev:web loop.

## verification

- **P2**: typecheck + lint clean; **436 passed / 2 skipped**
- **bench**: all metrics green at 10k (REPORT.md regenerated with the
  two new rows)
- **P3 live**: the 5k ledger probe above

## next

L16 — the design QA campaign: attack the whole system (raw tokens,
state audit, spatial audit, seeded violations).
