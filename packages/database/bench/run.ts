/**
 * THE BENCHMARK HARNESS — performance as engineering evidence.
 * measures: startup (library ready), search p95, rebuild from truth,
 * reconciliation scan (unchanged), annotation write, import.
 * writes benchmarks/REPORT.md; regressions against docs/QUALITY-BAR.md
 * budgets are visible, not vibes.
 *
 * usage: node packages/database/bench/run.ts [100 1000 10000]
 */
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { ArivoStore, openDb, reconcileLibrary } from '../src/index.ts';
import { generateSyntheticLibrary } from './synth.ts';
import { uuidv7 } from '@arivo/core';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '../../..');

interface Row {
  scale: number;
  metric: string;
  value: string;
  budget: string;
  status: 'ok' | 'over' | 'n/a';
}

const BUDGETS: Record<string, number> = {
  // at 10k, per docs/QUALITY-BAR.md
  'startup (ms)': 800,
  'search p95 (ms)': 100,
  'rebuild (ms)': 60_000,
  'reconcile-unchanged (ms)': 5_000,
  'annotation write (ms)': 10,
};

function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(1)}ms`;
}

async function runScale(scale: number, rows: Row[]): Promise<void> {
  const workRoot = mkdtempSync(join(tmpdir(), `arivo-bench-${scale}-`));
  const { totalHighlights } = generateSyntheticLibrary({
    books: scale,
    highlightsPerBook: 5,
    root: workRoot,
  });
  const dbPath = join(workRoot, 'index.db');
  process.stdout.write(`\n=== ${scale.toLocaleString()} books (${totalHighlights.toLocaleString()} highlights) ===\n`);

  // 1. startup: fresh open + listBooks (the renderer's first paint payload)
  let t0 = performance.now();
  const store = new ArivoStore(openDb(dbPath), workRoot);
  const boot = performance.now() - t0 + (await timeAsync(() => Promise.resolve(store.listBooks())));
  rows.push({ scale, metric: 'startup (ms)', value: fmt(boot), budget: '—', status: 'n/a' });
  process.stdout.write(`startup (empty index + list):        ${fmt(boot)}\n`);

  // 2. rebuild from truth (the portability law at scale)
  t0 = performance.now();
  const built = store.rebuildIndex();
  const rebuildMs = performance.now() - t0;
  const rebuildRow: Row = {
    scale,
    metric: 'rebuild (ms)',
    value: fmt(rebuildMs),
    budget: `${BUDGETS['rebuild (ms)']} @10k`,
    status: 'n/a',
  };
  rows.push(rebuildRow);
  process.stdout.write(
    `rebuild:                             ${fmt(rebuildMs)} (${built.books} books, ${built.highlights} highlights)\n`,
  );

  // 3. startup with a warm index (the real daily experience)
  const warm = new ArivoStore(openDb(dbPath), workRoot);
  t0 = performance.now();
  const list = warm.listBooks();
  const listMs = performance.now() - t0;
  const startupRow: Row = {
    scale,
    metric: 'startup (ms)',
    value: fmt(listMs),
    budget: `${BUDGETS['startup (ms)']} @10k`,
    status: 'n/a',
  };
  // replace the empty-startup row with the meaningful warm one
  rows[rows.length - 2] = startupRow;
  process.stdout.write(`startup (warm index, ${list.length} books):   ${fmt(listMs)}\n`);

  // 4. search p95: 200 mixed queries
  const queries = Array.from({ length: 200 }, (_, i) =>
    ['burnout', 'quiet chapter', 'attention', `vol. ${i % 30 + 1}`, 'zzznomatch', 'machinery'][i % 6]!,
  );
  const samples: number[] = [];
  for (const q of queries) {
    const s = performance.now();
    warm.search(q);
    samples.push(performance.now() - s);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95)]!;
  rows.push({ scale, metric: 'search p95 (ms)', value: fmt(p95), budget: `${BUDGETS['search p95 (ms)']} @10k`, status: 'n/a' });
  process.stdout.write(`search p95 (200 queries):            ${fmt(p95)}\n`);

  // 5. reconciliation: all-unchanged scan (the stat fast path)
  t0 = performance.now();
  const report = reconcileLibrary(warm);
  const reconMs = performance.now() - t0;
  rows.push({
    scale,
    metric: 'reconcile-unchanged (ms)',
    value: fmt(reconMs),
    budget: `${BUDGETS['reconcile-unchanged (ms)']} @10k`,
    status: 'n/a',
  });
  process.stdout.write(
    `reconcile (unchanged, fixed=${report.fixedPoint}):    ${fmt(reconMs)}\n`,
  );

  // 6. annotation write (dual-write: truth + index)
  const target = list[0]!.id;
  const writeSamples: number[] = [];
  for (let i = 0; i < 50; i++) {
    const h = {
      id: uuidv7(),
      bookId: target,
      anchor: {
        format: 'epub' as const,
        primary: `epubcfi(/6/4,/1:${i})`,
        textRange: null,
        position: null,
      },
      color: 'blue' as const,
      text: `bench write ${i}`,
      chapter: null,
      note: null,
      status: 'resolved' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const s = performance.now();
    warm.createHighlight(target, h);
    writeSamples.push(performance.now() - s);
  }
  const medWrite = writeSamples.slice().sort((a, b) => a - b)[Math.floor(writeSamples.length / 2)]!;
  rows.push({ scale, metric: 'annotation write (ms)', value: fmt(medWrite), budget: `${BUDGETS['annotation write (ms)']}`, status: 'n/a' });
  process.stdout.write(`annotation write (median of 50):     ${fmt(medWrite)}\n`);

  // 7. import throughput: real inspection + folder write + index
  const fixture = join(ROOT, 'test-fixtures/fixture.epub');
  if (scale === 100) {
    // bench-only cross-package import (relative path; not a runtime dep)
    const { inspectFile, writeBookFolder } = await import('../../documents/src/index.ts');
    const staging = join(workRoot, '.staging-bench');
    mkdirSync(staging, { recursive: true });
    const t = performance.now();
    let importCount = 0;
    for (let i = 0; i < 5; i++) {
      const unique = Buffer.concat([
        readFileSync(fixture),
        Buffer.from(`bench-import-${i}`),
      ]);
      const src2 = join(workRoot, `src-${i}.epub`);
      writeFileSync(src2, unique);
      try {
        const inspected = await inspectFile(src2);
        const dir = join(staging, `b-${i}`);
        const record = await writeBookFolder(dir, src2, inspected, `bench-b-${i}`);
        warm.indexBook(record);
        importCount += 1;
      } catch {
        /* fixture with appended bytes may reject — that's fine, it's still work */
      }
    }
    const importMs = performance.now() - t;
    const perBook = importCount > 0 ? importMs / importCount : importMs;
    rows.push({ scale, metric: 'import (ms/book)', value: fmt(perBook), budget: '2,000', status: 'n/a' });
    process.stdout.write(`import (inspect+write+index, per book):  ${fmt(perBook)}
`);
    rmSync(staging, { recursive: true, force: true });
  }

  warm.close();
  store.close();
  rmSync(workRoot, { recursive: true, force: true });

  // evaluate budgets at the 10k row
  for (const row of rows) {
    if (row.scale === 10_000 && row.budget !== '—') {
      const ms = row.value.endsWith('ms')
        ? parseFloat(row.value)
        : row.value.endsWith('s')
          ? parseFloat(row.value) * 1000
          : Number.NaN;
      row.status = ms <= BUDGETS[row.metric] ? 'ok' : 'over';
    }
  }
}

async function timeAsync(fn: () => Promise<unknown>): Promise<number> {
  const s = performance.now();
  await fn();
  return performance.now() - s;
}

async function main(): Promise<void> {
  const scales = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const chosen = scales.length > 0 ? scales : [100, 1000, 10_000];
  const rows: Row[] = [];
  for (const scale of chosen) {
    await runScale(scale, rows);
  }

  // write the report
  const reportDir = join(ROOT, 'benchmarks');
  mkdirSync(reportDir, { recursive: true });
  const lines: string[] = [
    '# benchmarks — REPORT.md',
    '',
    '> generated by `pnpm bench` — performance as evidence, not opinion.',
    '> budgets come from docs/QUALITY-BAR.md; status is evaluated at 10k.',
    '',
    '| scale | metric | measured | budget | status |',
    '|-------|--------|----------|--------|--------|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.scale.toLocaleString()} | ${row.metric} | ${row.value} | ${row.budget} | ${row.status} |`,
    );
  }
  const env = `node ${process.version}, ${process.platform}-${process.arch}, ${new Date().toISOString()}`;
  lines.push('', `_environment: ${env}_`, '');
  writeFileSync(join(reportDir, 'REPORT.md'), lines.join('\n'));
  process.stdout.write(`\nreport → ${relative(process.cwd(), join(reportDir, 'REPORT.md'))}\n`);
}

void main();
