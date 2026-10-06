/**
 * OBSERVABILITY, proven (I-31, I-32):
 * events are structured, the ring buffer is capped, and the privacy rule
 * holds mechanically — no book text, note text, or long content ever
 * survives into an export.
 */
import { describe, it, expect } from 'vitest';
import { DiagnosticsRecorder, scrubData } from './diagnostics.ts';

describe('the privacy rule (I-32)', () => {
  it('scrubData drops content-shaped keys entirely', () => {
    const scrubbed = scrubData({
      bookId: 'bk-1',
      title: 'The Burnout Society',
      text: 'multitasking represents an apparent attenuation',
      note: 'my private margin note',
      content: 'chapter body',
      excerpt: '...',
      reason: 'already in library',
      count: 3,
    })!;
    expect(Object.keys(scrubbed)).not.toContain('text');
    expect(Object.keys(scrubbed)).not.toContain('note');
    expect(Object.keys(scrubbed)).not.toContain('content');
    expect(Object.keys(scrubbed)).not.toContain('excerpt');
    // hmm: 'title' is book metadata, not book content — titles identify
    // books in diagnostics (needed for "which import failed?"); the rule
    // bans CONTENT. titles are capped like all strings:
    expect(scrubbed['title']).toBe('The Burnout Society');
    expect(scrubbed['bookId']).toBe('bk-1');
    expect(scrubbed['count']).toBe(3);
  });

  it('long strings are truncated; arrays become counts; objects opaque', () => {
    const scrubbed = scrubData({
      long: 'x'.repeat(9999),
      list: ['a', 'b', 'c'],
      nested: { deep: true },
    })!;
    expect((scrubbed['long'] as string).length).toBeLessThanOrEqual(201);
    expect(scrubbed['list']).toBe(3);
    expect(scrubbed['nested']).toBe('[object]');
  });

  it('record() scrubs on ENTRY — the buffer never holds raw content', () => {
    const recorder = new DiagnosticsRecorder();
    recorder.record('book.import.failed', 'warn', {
      text: 'SENSITIVE SELECTION TEXT',
      reason: 'not a zip',
    });
    const raw = JSON.stringify(recorder.list());
    expect(raw).not.toContain('SENSITIVE');
    expect(raw).toContain('not a zip');
  });
});

describe('the recorder (I-31)', () => {
  it('the ring buffer is capped — memory is bounded', () => {
    const recorder = new DiagnosticsRecorder();
    for (let i = 0; i < 1200; i++) recorder.record('test.event', 'info', { i });
    expect(recorder.list().length).toBeLessThanOrEqual(500);
    // the most recent events survive
    expect(recorder.list()[recorder.list().length - 1]!.data?.['i']).toBe(1199);
  });

  it('event counts aggregate; the report carries stats + reconciliation', () => {
    const recorder = new DiagnosticsRecorder();
    recorder.record('a', 'info');
    recorder.record('a', 'info');
    recorder.record('b', 'error');
    recorder.setStats({
      appVersion: '0.2.0',
      platform: 'electron/linux-x64',
      schemaVersion: 2,
      library: { books: 12, highlights: 34 },
    });
    recorder.setReconciliation({ scanned: 12, fixedPoint: true, counts: { UNCHANGED: 12 }, durationMs: 40 });
    const report = recorder.export();
    expect(report.eventCounts['a']).toBe(2);
    expect(report.eventCounts['b']).toBe(1);
    expect(report.appVersion).toBe('0.2.0');
    expect(report.library.books).toBe(12);
    expect(report.lastReconciliation?.fixedPoint).toBe(true);
    expect(report.events.length).toBe(5); // 3 + stats + reconciliation
  });

  it('reconciliation with anomalies records a warn, clean records info', () => {
    const recorder = new DiagnosticsRecorder();
    recorder.setReconciliation({ scanned: 5, fixedPoint: true, counts: { UNCHANGED: 3, MODIFIED: 2 }, durationMs: 10 });
    expect(recorder.list().at(-1)!.level).toBe('warn');
    const clean = new DiagnosticsRecorder();
    clean.setReconciliation({ scanned: 5, fixedPoint: true, counts: { UNCHANGED: 5 }, durationMs: 10 });
    expect(clean.list().at(-1)!.level).toBe('info');
  });
});
