/**
 * CRASH SAFETY, proven with real SIGKILLs — not mocks.
 * at every controlled point of the atomic write, the child dies; the file
 * on disk must parse as either the OLD or the NEW content, never partial.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSyncAtomic } from './atomic.ts';
import { MutationJournal } from './journal.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const CHILD = join(HERE, 'crash-child.ts');

const OLD = JSON.stringify({ state: 'old', highlights: [1, 2, 3] });
const NEW = JSON.stringify({ state: 'new', highlights: [4, 5, 6, 7] });

const CRASH_POINTS = ['after-temp-write', 'after-fsync', 'before-rename', 'after-rename'] as const;

function runChild(target: string, point: string): { signal: string | null; status: number | null } {
  const result = spawnSync(process.execPath, [CHILD, target, OLD, NEW, point], {
    encoding: 'utf-8',
    timeout: 15000,
  });
  return { signal: result.signal, status: result.status };
}

describe('the atomic write survives process death at every point', () => {
  for (const point of CRASH_POINTS) {
    it(`SIGKILL ${point} → the live file is old or new, never partial`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'arivo-crash-'));
      try {
        const target = join(dir, 'annotations.json');
        const { signal } = runChild(target, point);
        // the child must have actually died at the point
        expect(signal).toBe('SIGKILL');
        // the invariant: parseable, and one of the two complete states
        const content = JSON.parse(readFileSync(target, 'utf-8')) as { state: string };
        expect(['old', 'new']).toContain(content.state);
        // the live name is never a temp; litter (if any) is hidden-dotfile
        // scratch that reconciliation sweeps on the next scan
        expect(readdirSync(dir).every((f) => f === 'annotations.json' || f.startsWith('.'))).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  it('no crash point → the new content lands intact', () => {
    const dir = mkdtempSync(join(tmpdir(), 'arivo-crash-'));
    try {
      const target = join(dir, 'annotations.json');
      const { status, signal } = runChild(target, 'none');
      expect(signal).toBeNull();
      expect(status).toBe(0);
      const content = JSON.parse(readFileSync(target, 'utf-8')) as { state: string };
      expect(content.state).toBe('new');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('failed writes never clobber the previous content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'arivo-crash-'));
    try {
      const target = join(dir, 'settings.json');
      writeFileSyncAtomic(target, OLD);
      // simulate a failing write: the directory refuses new files (EACCES —
      // the same failure shape as a full disk)
      chmodSync(dir, 0o555);
      try {
        expect(() => writeFileSyncAtomic(target, NEW)).toThrow();
      } finally {
        chmodSync(dir, 0o755);
      }
      const content = JSON.parse(readFileSync(target, 'utf-8')) as { state: string };
      expect(content.state).toBe('old');
      expect(readdirSync(dir)).toEqual(['settings.json']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the mutation journal explains interruptions', () => {
  it('begin without commit = incomplete; torn final line = incomplete', () => {
    const dir = mkdtempSync(join(tmpdir(), 'arivo-journal-'));
    try {
      const journal = new MutationJournal(dir);
      journal.begin('import:abc', 'copying book folder');
      journal.begin('import:def');
      journal.commit('import:abc');
      const incomplete = journal.incomplete();
      expect(incomplete.map((i) => i.op)).toEqual(['import:def']);

      // a torn last line (crash mid-append) reads as an unknown in-flight op
      const file = join(dir, '.arivo-journal.jsonl');
      const raw = readFileSync(file, 'utf-8');
      const torn = `${raw}${JSON.stringify({ op: 'import:ghi', phase: 'begin', at: 1 }).slice(0, 20)}`;
      writeFileSyncAtomic(file, torn);
      const after = new MutationJournal(dir).incomplete();
      // the torn op is unknown by name — but SOMETHING in flight is reported
      expect(after.map((i) => i.op)).toContain('unknown:torn-final-line');
      expect(after.map((i) => i.op)).toContain('import:def');

      // clear after recovery
      new MutationJournal(dir).clear();
      expect(new MutationJournal(dir).incomplete()).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a missing journal is simply no evidence', () => {
    const dir = mkdtempSync(join(tmpdir(), 'arivo-journal-'));
    try {
      expect(new MutationJournal(dir).incomplete()).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
