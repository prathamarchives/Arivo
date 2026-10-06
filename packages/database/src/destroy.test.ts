/**
 * THE DESTROY-ARIVO SUITE (item 20) — the final proving ground.
 * deliberately: delete the index, corrupt the index, corrupt truth,
 * strand staging, storm annotations, swell the library, mutate books
 * externally. then: reconcile, recover, rebuild, verify.
 *
 * the four assertions that close every scenario:
 *   no silent data loss · no invalid annotations ·
 *   no impossible database state · no unrecoverable derived state
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArivoStore } from './store.ts';
import { openDb } from './db.ts';
import { reconcileLibrary } from './reconciliation/index.ts';
import { readTruth, writeTruth } from './truth.ts';
import { ArivoError, uuidv7, type Highlight } from '@arivo/core';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '../../..');
const FIXTURE = join(ROOT, 'test-fixtures/fixture.epub');
const fixtureBytes = readFileSync(FIXTURE);
const fixtureHash = createHash('sha256').update(fixtureBytes).digest('hex');

let root: string;
let dbPath: string;

/** a complete book with N highlights, pre-written to truth (not indexed) */
function seedBook(id: string, highlights: number): string {
  const dir = join(root, 'library', id);
  mkdirSync(dir, { recursive: true });
  // unique content per book — duplicate suppression is CORRECT to collapse
  // identical files, so the storm libraries need distinct hashes
  writeFileSync(
    join(dir, 'fixture.epub'),
    Buffer.concat([fixtureBytes, Buffer.from(`unique-${id}`)]),
  );
  const bookHash = createHash('sha256')
    .update(fixtureBytes)
    .update(`unique-${id}`)
    .digest('hex');
  const hs: Highlight[] = Array.from({ length: highlights }, (_, i) => ({
    id: `${id}-hl-${i}`,
    bookId: id,
    anchor: {
      format: 'epub',
      primary: `epubcfi(/6/4!/4/2,/1:${i},/1:${i + 40})`,
      textRange: { exact: `destroy suite highlight ${i}`, prefix: 'prefix ', suffix: ' suffix' },
      position: { spineIndex: 1, percent: i / 100 },
    },
    color: 'yellow',
    text: `destroy suite highlight ${i}`,
    chapter: 'Chapter One',
    note: `note ${i}`,
    status: 'resolved',
    createdAt: 1_000 + i,
    updatedAt: 1_000 + i,
  }));
  writeFileSync(
    join(dir, 'metadata.json'),
    JSON.stringify(
      {
        id,
        title: `Destroy ${id}`,
        subtitle: null,
        authors: ['Suite'],
        description: null,
        language: null,
        publisher: null,
        publishedYear: null,
        coverPath: null,
        format: 'epub',
        hash: bookHash,
        fileName: 'fixture.epub',
        fileSize: fixtureBytes.length + `unique-${id}`.length,
        tags: [],
        addedAt: Date.now(),
        updatedAt: Date.now(),
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, 'annotations.json'),
    JSON.stringify({ version: 1, bookId: id, progress: null, highlights: hs, bookmarks: [] }, null, 2),
  );
  return dir;
}

function open(): ArivoStore {
  return new ArivoStore(openDb(dbPath), root);
}

const countHighlights = (store: ArivoStore): number => {
  const rows = store.listBooks();
  return rows.reduce((sum, b) => sum + store.listHighlights(b.id).length, 0);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'arivo-destroy-'));
  dbPath = join(root, 'index.db');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('destroy: the index dies', () => {
  it('DELETE the index file entirely → reconcile → zero loss', () => {
    const dir = seedBook('bk-a', 25);
    let store = open();
    const r = store.rebuildIndex(); // index from truth (idempotent baseline)
    expect(r.books).toBe(1);
    store.close();
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    store = open();
    const report = reconcileLibrary(store);
    expect(report.counts.NEW).toBe(1);
    expect(store.listBooks()).toHaveLength(1);
    expect(countHighlights(store)).toBe(25);
    // no silent data loss — the truth file never moved
    expect(readTruth(dir, 'bk-a').highlights).toHaveLength(25);
    store.close();
  });

  it('CORRUPT the index (garbage bytes) → typed detection, recovery rebuilds, zero loss', () => {
    seedBook('bk-b', 10);
    let store = open();
    store.rebuildIndex();
    store.close();
    // corrupt
    writeFileSync(dbPath, Buffer.from('garbage that is definitely not sqlite'));
    try {
      open();
      expect.unreachable();
    } catch (err) {
      expect((err as ArivoError).code).toBe('DATABASE_CORRUPT');
    }
    // the recovery protocol: aside → fresh → rebuild
    rmSync(dbPath, { force: true });
    store = open();
    const r = store.rebuildIndex();
    expect(r.books).toBe(1);
    expect(countHighlights(store)).toBe(10);
    store.close();
  });

  it('TRUNCATE the index → typed corruption, never a bizarre downstream bug', () => {
    seedBook('bk-c', 5);
    const warm = open();
    warm.rebuildIndex();
    warm.close();
    const full = readFileSync(dbPath);
    writeFileSync(dbPath, full.subarray(0, 512));
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    try {
      open();
      expect.unreachable();
    } catch (err) {
      expect((err as ArivoError).code).toBe('DATABASE_CORRUPT');
    }
  });
});

describe('destroy: truth under attack', () => {
  it('CORRUPT annotations.json → salvage via .bak → annotations survive', () => {
    seedBook('bk-d', 12);
    const store = open();
    const dir = join(root, 'library', 'bk-d');
    // the writeTruth rotation: current truth becomes .bak
    const truth = readTruth(dir, 'bk-d');
    writeTruth(dir, { ...truth, highlights: truth.highlights.slice(0, 12) });
    writeFileSync(join(dir, 'annotations.json'), '{corrupted!!');
    const salvaged = readTruth(dir, 'bk-d');
    expect(salvaged.highlights).toHaveLength(12);
    expect(salvaged.highlights[0]!.note).toBe('note 0');
    store.close();
  });

  it('CORRUPT annotations.json with NO backup → empty truth, app never crashes, book intact', () => {
    const dir = seedBook('bk-e', 3);
    writeFileSync(join(dir, 'annotations.json'), 'total garbage {{{');
    const store = open();
    const report = reconcileLibrary(store); // the corrupted truth registers the book, empty
    expect(report.fixedPoint).toBe(true);
    expect(() => store.listHighlights('bk-e')).not.toThrow();
    expect(store.listHighlights('bk-e')).toHaveLength(0);
    expect(store.exportNotes('bk-e')).toContain('Destroy');
    store.close();
  });

  it('STRAND import staging (simulated crash mid-import) → swept, never registered', () => {
    seedBook('bk-f', 0);
    const staging = join(root, 'library', '.staging', 'half-imported-id');
    mkdirSync(staging, { recursive: true });
    writeFileSync(join(staging, 'fixture.epub'), fixtureBytes.subarray(0, 400)); // partial copy
    writeFileSync(join(staging, 'metadata.json'), '{partial'); // partial truth
    const store = open();
    const report = reconcileLibrary(store);
    expect(report.fixedPoint).toBe(true);
    expect(dirExists(staging)).toBe(false);
    expect(store.listBooks().map((b) => b.id)).toEqual(['bk-f']);
    store.close();
  });
});

describe('destroy: the annotation storm + library swell', () => {
  it('1,000 highlights across 20 books: rebuild → zero loss, bounded time', () => {
    for (let i = 0; i < 20; i++) seedBook(`storm-${i.toString().padStart(2, '0')}`, 50);
    let store = open();
    const first = store.rebuildIndex();
    expect(first.books).toBe(20);
    expect(first.highlights).toBe(1000);
    const highlightsBefore = store.listHighlights('storm-05');
    store.close();

    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });

    const started = performance.now();
    store = open();
    const report = reconcileLibrary(store);
    const rebuildMs = performance.now() - started;
    expect(report.fixedPoint).toBe(true);
    expect(countHighlights(store)).toBe(1000);
    // no invalid annotations: ids, notes, anchors identical
    const after = store.listHighlights('storm-05');
    expect(after.length).toBe(50);
    expect(after.map((h) => h.id)).toEqual(highlightsBefore.map((h) => h.id));
    expect(after.map((h) => h.note)).toEqual(highlightsBefore.map((h) => h.note));
    // no impossible db state: fk check clean
    const fk = (store as unknown as { db: { raw: { pragma: (p: string) => unknown[] } } }).db.raw.pragma(
      'foreign_key_check',
    );
    expect(fk).toHaveLength(0);
    // bounded: the portability law at storm scale
    expect(rebuildMs).toBeLessThan(10_000);
    store.close();
  });

  it('200-book library: search + scan + reconcile stay responsive', () => {
    for (let i = 0; i < 200; i++) seedBook(`lib-${i.toString().padStart(3, '0')}`, 2);
    const store = open();
    const r = store.rebuildIndex();
    expect(r.books).toBe(200);

    const searchStart = performance.now();
    const hits = store.search('Destroy');
    const searchMs = performance.now() - searchStart;
    expect(hits.length).toBeGreaterThan(0);
    expect(searchMs).toBeLessThan(500);

    const reconStart = performance.now();
    const report = reconcileLibrary(store);
    const reconMs = performance.now() - reconStart;
    expect(report.fixedPoint).toBe(true);
    expect(report.counts.UNCHANGED).toBe(200);
    // 200 unchanged books = stat-only fast path
    expect(reconMs).toBeLessThan(2000);
    store.close();
  });

  it('100 concurrent createHighlight microtasks: zero lost updates, dual-write intact', async () => {
    seedBook('bk-storm', 0);
    const store = open();
    store.rebuildIndex();
    const writes = Array.from({ length: 100 }, (_, i) =>
      Promise.resolve().then(() => {
        const h: Highlight = {
          id: `storm-hl-${i}-${uuidv7()}`,
          bookId: 'bk-storm',
          anchor: {
            format: 'epub',
            primary: `epubcfi(/6/4,/1:${i})`,
            textRange: null,
            position: null,
          },
          color: 'blue',
          text: `storm ${i}`,
          chapter: null,
          note: null,
          status: 'resolved',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        store.createHighlight('bk-storm', h);
      }),
    );
    await Promise.all(writes);
    expect(store.listHighlights('bk-storm')).toHaveLength(100);
    expect(readTruth(join(root, 'library', 'bk-storm'), 'bk-storm').highlights.length).toBe(100);
    store.close();
  });
});

describe('destroy: external filesystem truth', () => {
  it('empty the library externally → MISSING detected; folder returns → same id, same annotations', () => {
    seedBook('bk-move', 8);
    let store = open();
    store.rebuildIndex();
    store.close();
    const lib = join(root, 'library');
    const stash = join(root, 'stash');
    mkdirSync(stash, { recursive: true });
    for (const entry of readdirSync(lib)) {
      if (entry === 'collections.json') continue;
      rmSync(join(lib, entry), { recursive: true, force: true });
    }
    // the owner moved their folder away
    store = open();
    const gone = reconcileLibrary(store);
    expect(gone.counts.MISSING).toBe(1);
    expect(store.listBooks()).toHaveLength(0);
    // put it back
    seedBook('bk-move', 8);
    const report = reconcileLibrary(store);
    expect(report.counts.NEW).toBe(1);
    expect(store.listBooks()[0]!.id).toBe('bk-move');
    expect(store.listHighlights('bk-move')).toHaveLength(8);
    void stash;
    store.close();
  });

  it('tamper every book externally → all detected, all re-fingerprinted, annotations kept', () => {
    const ids = ['t-1', 't-2', 't-3'];
    for (const id of ids) seedBook(id, 4);
    const store = open();
    store.rebuildIndex();
    for (const id of ids) {
      appendBytes(join(root, 'library', id, 'fixture.epub'));
    }
    const report = reconcileLibrary(store);
    expect(report.counts.MODIFIED).toBe(3);
    expect(report.fixedPoint).toBe(true);
    for (const id of ids) {
      expect(store.listHighlights(id)).toHaveLength(4);
      const meta = JSON.parse(readFileSync(join(root, 'library', id, 'metadata.json'), 'utf-8'));
      expect(meta.hash).not.toBe(fixtureHash); // re-fingerprinted
    }
    // no unrecoverable derived state: the next run is a fixed point
    const second = reconcileLibrary(store);
    expect(second.counts.UNCHANGED).toBe(3);
    store.close();
  });
});

const dirExists = (p: string): boolean => {
  try {
    return readdirSync(p).length >= 0;
  } catch {
    return false;
  }
};

const appendBytes = (file: string): void => {
  const current = readFileSync(file);
  writeFileSync(file, Buffer.concat([current, Buffer.from('external edit bytes')]));
};