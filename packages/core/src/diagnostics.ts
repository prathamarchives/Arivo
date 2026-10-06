/**
 * OBSERVABILITY — structured evidence, not logs.
 * every significant failure and recovery emits an event; the ring buffer
 * is capped and exportable. THE PRIVACY RULE: event data carries counts,
 * ids, durations, and statuses — never book contents or annotation text
 * (the scrubber enforces this mechanically).
 */
export type DiagnosticLevel = 'info' | 'warn' | 'error';

export interface DiagnosticEvent {
  /** dot-namespaced: book.import.completed, database.rebuilt, ... */
  event: string;
  at: number;
  level: DiagnosticLevel;
  /** structured metadata — scrubbed on entry */
  data?: Record<string, unknown>;
}

export interface DiagnosticsReport {
  appVersion: string;
  platform: string;
  generatedAt: number;
  schemaVersion: number | null;
  library: { books: number; highlights: number };
  lastReconciliation: {
    at: number;
    scanned: number;
    fixedPoint: boolean;
    counts: Record<string, number>;
  } | null;
  eventCounts: Record<string, number>;
  events: DiagnosticEvent[];
}

const MAX_EVENTS = 500;

/** keys that smell like content are dropped outright */
const FORBIDDEN_KEY_RE = /text|note|content|body|excerpt|snippet|quote/i;
/** long strings are not metadata */
const MAX_VALUE_LENGTH = 200;

export function scrubData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (FORBIDDEN_KEY_RE.test(key)) continue; // privacy rule, mechanically
    if (typeof value === 'string') {
      out[key] = value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
    } else if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    ) {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.length; // shapes, not contents
    } else {
      out[key] = '[object]'; // nested objects stay opaque
    }
  }
  return out;
}

export interface RecorderStats {
  appVersion: string;
  platform: string;
  schemaVersion: number | null;
  library: { books: number; highlights: number };
}

export class DiagnosticsRecorder {
  private events: DiagnosticEvent[] = [];
  private stats: RecorderStats | null = null;
  private lastReconciliation: DiagnosticsReport['lastReconciliation'] = null;

  record(event: string, level: DiagnosticLevel = 'info', data?: Record<string, unknown>): void {
    this.events.push({ event, at: Date.now(), level, data: scrubData(data) });
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
  }

  setStats(stats: RecorderStats): void {
    this.stats = stats;
    this.record('diagnostics.stats.updated', 'info', { books: stats.library.books });
  }

  setReconciliation(report: {
    scanned: number;
    fixedPoint: boolean;
    counts: Record<string, number>;
    durationMs: number;
  }): void {
    this.lastReconciliation = {
      at: Date.now(),
      scanned: report.scanned,
      fixedPoint: report.fixedPoint,
      counts: report.counts,
    };
    const anomalies =
      (report.counts['NEW'] ?? 0) +
      (report.counts['MODIFIED'] ?? 0) +
      (report.counts['MISSING'] ?? 0) +
      (report.counts['CORRUPT'] ?? 0) +
      (report.counts['DUPLICATE'] ?? 0) +
      (report.counts['ORPHANED_DATA'] ?? 0);
    this.record(
      'book.reconciliation.completed',
      anomalies > 0 ? 'warn' : 'info',
      { scanned: report.scanned, fixedPoint: report.fixedPoint, anomalies, durationMs: report.durationMs },
    );
  }

  list(): DiagnosticEvent[] {
    return [...this.events];
  }

  eventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of this.events) counts[e.event] = (counts[e.event] ?? 0) + 1;
    return counts;
  }

  export(): DiagnosticsReport {
    return {
      appVersion: this.stats?.appVersion ?? 'unknown',
      platform: this.stats?.platform ?? 'unknown',
      generatedAt: Date.now(),
      schemaVersion: this.stats?.schemaVersion ?? null,
      library: this.stats?.library ?? { books: 0, highlights: 0 },
      lastReconciliation: this.lastReconciliation,
      eventCounts: this.eventCounts(),
      events: this.list(),
    };
  }
}
