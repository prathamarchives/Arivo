/**
 * THE MUTATION JOURNAL — evidence for multi-step operations.
 *
 * arivo's recovery protocol is: atomic writes (single-file ops), staging +
 * atomic rename (folder ops), and reconciliation (state convergence). the
 * journal records what was in flight so startup can EXPLAIN recoveries
 * instead of guessing: an operation with `begin` and no `commit` was
 * interrupted, and its id tells the recovery layer what to sweep.
 *
 * format: append-only JSONL at {root}/.arivo-journal.jsonl
 * lines: {op, phase: 'begin'|'commit', at, note?}
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { writeFileSyncAtomic } from './atomic.ts';
import { join } from 'node:path';

export interface JournalLine {
  op: string;
  phase: 'begin' | 'commit';
  at: number;
  note?: string;
}

export interface IncompleteOperation {
  op: string;
  beganAt: number;
  note?: string;
}

export class MutationJournal {
  private readonly file: string;

  constructor(root: string) {
    this.file = join(root, '.arivo-journal.jsonl');
  }

  /** record the start of a multi-step mutation */
  begin(op: string, note?: string): void {
    appendFileSync(this.file, `${JSON.stringify({ op, phase: 'begin', at: Date.now(), note })}\n`);
  }

  /** record its successful completion */
  commit(op: string): void {
    appendFileSync(this.file, `${JSON.stringify({ op, phase: 'commit', at: Date.now() })}\n`);
  }

  /** every operation that began but never committed */
  incomplete(): IncompleteOperation[] {
    if (!existsSync(this.file)) return [];
    const seen = new Map<string, IncompleteOperation>();
    const committed = new Set<string>();
    try {
      const lines = readFileSync(this.file, 'utf-8').split('\n');
      // a torn FINAL line is a crash mid-append: an operation was in flight.
      // (torn mid-file lines mean real corruption → the catch below wins.)
      const lastLine = lines.length > 0 ? lines[lines.length - 1]! : '';
      const lastIsTorn =
        lastLine.trim().length > 0 && !this.parseLine(lastLine, seen, committed);
      for (const line of lines) {
        if (line === lastLine && lastIsTorn) break;
        if (line.trim().length === 0) continue;
        this.parseLine(line, seen, committed);
      }
      if (lastIsTorn) {
        seen.set('unknown:torn-final-line', {
          op: 'unknown:torn-final-line',
          beganAt: 0,
          note: 'the journal ends mid-line — a write was interrupted',
        });
      }
    } catch {
      return []; // unreadable journal → treat as no evidence, reconcile anyway
    }
    return [...seen.values()].filter((op) => !committed.has(op.op));
  }

  private parseLine(
    line: string,
    seen: Map<string, IncompleteOperation>,
    committed: Set<string>,
  ): boolean {
    try {
      const entry = JSON.parse(line) as JournalLine;
      if (entry.phase === 'begin') {
        seen.set(entry.op, { op: entry.op, beganAt: entry.at, note: entry.note });
        committed.delete(entry.op);
      } else {
        committed.add(entry.op);
        seen.delete(entry.op);
      }
      return true;
    } catch {
      return false;
    }
  }

  /** truncate the journal after a successful recovery sweep */
  clear(): void {
    writeFileSyncAtomic(this.file, '');
  }
}
