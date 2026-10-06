/**
 * THE RECONCILIATION ENGINE, proven:
 * delete the index row, modify the book, move the folder, duplicate the
 * folder, corrupt metadata, orphan the annotations — then reconcile and
 * assert convergence to a deterministic fixed point. run twice: the second
 * run must be all UNCHANGED.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  readdirSync,
  appendFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArivoStore, type BookRecord } from './store.ts';
import { openDb, type Db } from './db.ts';
import { reconcileLibrary } from './reconciliation/index.ts';
import { uuidv7, type Highlight } from '@arivo/core';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '../../..');
const FIXTURE_EPUB = join(ROOT, 'test-fixtures/fixture.epub');

const fixtureBytes = readFileSync(FIXTURE_EPUB);
const fixtureHash = createHash('sha256').update(fixtureBytes).digest('hex');

let root: string;
let dbPath: string;
let db: Db;

function makeStore(): ArivoStore {
  return new ArivoStore(db, root);
}
/** seed one complete book folder + index row, v0.1 style (no fileMtime) */
function seedBook(id: string, opts: { index?: boolean; withHighlight?: boolean } = {}): string {
  const dir = join(root, 'library', id);
  mkdirSync(dir, { recursive: true });
  copyFileSync(FIXTURE_EPUB, join(dir, 'fixture.epub'));
  const meta: BookRecord = {
    id,
    title: `Book ${id.slice(0, 6)}`,
    subtitle: null,
    authors: ['Fixture Author'],
    description: null,
    language: 'en',
    publisher: null,
    publishedYear: '2024',
    coverPath: 'cover.jpg',
    format: 'epub',
    hash: fixtureHash,
    fileName: 'fixture.epub',
    fileSize: fixtureBytes.length,
    tags: [],
    addedAt: Date.now(),
    updatedAt: Date.now(),
  };
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(meta, null, 2));
  const highlight: Highlight | null = opts.withHighlight
    ? {
        id: uuidv7(),
        bookId: id,
        anchor: {
          format: 'epub',
          primary: 'epubcfi(/6/4!/4/2,/1:10,/1:40)',
          textRange: { exact: 'fixture highlight text', prefix: 'before the ', suffix: ' and after' },
          position: { spineIndex: 1, percent: 0.2 },
        },
        color: 'green',
        text: 'fixture highlight text',
        chapter: 'Chapter One',
        note: 'a note that must survive',
        status: 'resolved',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    : null;
  // truth: empty when the index will dual-write it; pre-populated when the
  // test simulates a crash BEFORE indexing (truth written, index never was)
  writeFileSync(
    join(dir, 'annotations.json'),
    JSON.stringify(
      {
        version: 1,
        bookId: id,
        progress: null,
        highlights: opts.index === false && highlight ? [highlight] : [],
        bookmarks: [],
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, 'cover.jpg'), fixtureBytes.subarray(0, 512));
  if (opts.index !== false) {
    // separate connection — closing it must not close the test's shared db
    const seedStore = new ArivoStore(openDb(dbPath), root);
    seedStore.indexBook(meta);
    if (highlight) seedStore.createHighlight(id, highlight);
    seedStore.close();
  }
  return dir;
}

const hashOfFile = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'arivo-reconcile-'));
  dbPath = join(root, 'index.db');
  db = openDb(dbPath);
});

afterEach(() => {
  try {
    db.close();
  } catch {
    /* a test may have closed it */
  }
  rmSync(root, { recursive: true, force: true });
});

describe('convergence — the engine reaches a fixed point', () => {
  it('a healthy library is a no-op (fast path, no hashing)', () => {
    seedBook('bk-healthy', { withHighlight: true });
    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.counts.UNCHANGED).toBe(1);
    expect(report.actions.length).toBeGreaterThanOrEqual(0);
    expect(report.fixedPoint).toBe(true);
    // fingerprint backfilled: v0.1 folders gain fileMtime
    const meta = JSON.parse(readFileSync(join(root, 'library', 'bk-healthy', 'metadata.json'), 'utf-8'));
    expect(typeof meta.fileMtime).toBe('number');
    const second = reconcileLibrary(store);
    expect(second.counts.UNCHANGED).toBe(1);
    expect(second.fixedPoint).toBe(true);
    expect(second.actions.filter((a) => a.kind !== 'reportOnly')).toHaveLength(0);
    store.close();
  });

  it('a crash between folder-write and index-write self-heals (NEW)', () => {
    seedBook('bk-crashed', { index: false, withHighlight: true });
    const store = makeStore();
    expect(store.listBooks()).toHaveLength(0);
    const report = reconcileLibrary(store);
    expect(report.counts.NEW).toBe(1);
    expect(report.fixedPoint).toBe(true);
    // the truth's highlight returns to the index
    expect(store.listHighlights('bk-crashed')).toHaveLength(1);
    expect(store.listHighlights('bk-crashed')[0]!.note).toBe('a note that must survive');
    const second = reconcileLibrary(store);
    expect(second.counts.UNCHANGED).toBe(1);
    store.close();
  });

  it('an externally modified book is detected and re-fingerprinted, annotations untouched (MODIFIED)', () => {
    seedBook('bk-modified', { withHighlight: true });
    const file = join(root, 'library', 'bk-modified', 'fixture.epub');
    appendFileSync(file, Buffer.from('appended bytes — the book changed')); // content change
    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.counts.MODIFIED).toBe(1);
    expect(report.fixedPoint).toBe(true);
    // metadata + row carry the new hash; annotations survive byte-for-byte
    const meta = JSON.parse(readFileSync(join(root, 'library', 'bk-modified', 'metadata.json'), 'utf-8'));
    expect(meta.hash).toBe(hashOfFile(file));
    expect(store.listBooks()[0]!.hash).toBe(hashOfFile(file));
    expect(store.listHighlights('bk-modified')).toHaveLength(1);
    expect(store.listHighlights('bk-modified')[0]!.note).toBe('a note that must survive');
    const second = reconcileLibrary(store);
    expect(second.counts.UNCHANGED).toBe(1);
    store.close();
  });

  it('a moved-away folder drops the row; the folder returns with the same id and annotations (MISSING)', () => {
    const dir = seedBook('bk-moved', { withHighlight: true });
    const stash = join(root, 'stash');
    cpSync(dir, stash, { recursive: true });
    rmSync(dir, { recursive: true, force: true });

    const store = makeStore();
    const gone = reconcileLibrary(store);
    expect(gone.counts.MISSING).toBe(1);
    expect(gone.fixedPoint).toBe(true);
    expect(store.listBooks()).toHaveLength(0);

    // the folder comes back — same id, same annotations
    cpSync(stash, dir, { recursive: true });
    const back = reconcileLibrary(store);
    expect(back.counts.NEW).toBe(1);
    expect(back.fixedPoint).toBe(true);
    expect(store.listBooks()[0]!.id).toBe('bk-moved');
    expect(store.listHighlights('bk-moved')).toHaveLength(1);
    expect(store.listHighlights('bk-moved')[0]!.note).toBe('a note that must survive');
    store.close();
  });

  it('a duplicated folder is suppressed — files kept, marker written, deterministic winner (DUPLICATE)', () => {
    const older = seedBook('bk-original', { withHighlight: true });
    // an external copy of the same content under a new folder name
    cpSync(older, join(root, 'library', 'bk-copy'), { recursive: true });
    const copyMeta = JSON.parse(
      readFileSync(join(root, 'library', 'bk-copy', 'metadata.json'), 'utf-8'),
    ) as BookRecord;
    copyMeta.id = 'bk-copy';
    copyMeta.addedAt = Date.now() + 1000; // the copy is newer — the original wins
    writeFileSync(join(root, 'library', 'bk-copy', 'metadata.json'), JSON.stringify(copyMeta, null, 2));

    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.counts.DUPLICATE + report.counts.SUPPRESSED).toBeGreaterThanOrEqual(1);
    expect(report.fixedPoint).toBe(true);
    // the original is the indexed one
    expect(store.listBooks().map((b) => b.id)).toEqual(['bk-original']);
    // the copy's files are untouched, its marker names the original
    expect(existsSync(join(root, 'library', 'bk-copy', 'fixture.epub'))).toBe(true);
    const marker = JSON.parse(readFileSync(join(root, 'library', 'bk-copy', 'metadata.json'), 'utf-8'));
    expect(marker.duplicateOf).toBe('bk-original');
    // suppressing the original flips the copy back on (convergence memory)
    const second = reconcileLibrary(store);
    expect(second.counts.SUPPRESSED).toBe(1);
    expect(second.counts.UNCHANGED).toBe(1);
    store.close();
  });

  it('when the original is deleted, the suppressed copy takes over', () => {
    const older = seedBook('bk-orig-2');
    cpSync(older, join(root, 'library', 'bk-copy-2'), { recursive: true });
    const copyMeta = JSON.parse(
      readFileSync(join(root, 'library', 'bk-copy-2', 'metadata.json'), 'utf-8'),
    ) as BookRecord;
    copyMeta.id = 'bk-copy-2';
    copyMeta.duplicateOf = 'bk-orig-2';
    writeFileSync(join(root, 'library', 'bk-copy-2', 'metadata.json'), JSON.stringify(copyMeta, null, 2));

    const store = makeStore();
    reconcileLibrary(store); // copy is suppressed
    expect(store.listBooks().map((b) => b.id)).toEqual(['bk-orig-2']);

    rmSync(join(root, 'library', 'bk-orig-2'), { recursive: true, force: true });
    const report = reconcileLibrary(store); // original gone → copy re-evaluated
    expect(report.fixedPoint).toBe(true);
    expect(store.listBooks().map((b) => b.id)).toEqual(['bk-copy-2']);
    store.close();
  });

  it('a stale index row is rebuilt from truth (STALE_INDEX)', () => {
    seedBook('bk-stale', { withHighlight: true });
    const store = makeStore();
    db.raw.prepare("UPDATE books SET hash = 'deadbeef' WHERE id = 'bk-stale'").run();
    expect(store.listBooks()[0]!.hash).toBe('deadbeef');
    const report = reconcileLibrary(store);
    expect(report.counts.STALE_INDEX).toBe(1);
    expect(report.fixedPoint).toBe(true);
    expect(store.listBooks()[0]!.hash).toBe(fixtureHash);
    expect(store.listHighlights('bk-stale')).toHaveLength(1);
    const second = reconcileLibrary(store);
    expect(second.counts.UNCHANGED).toBe(1);
    store.close();
  });

  it('a deleted book file keeps the row + annotations, marked fileMissing (ORPHANED_DATA)', () => {
    seedBook('bk-orphan', { withHighlight: true });
    rmSync(join(root, 'library', 'bk-orphan', 'fixture.epub'));
    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.counts.ORPHANED_DATA).toBe(1);
    expect(report.fixedPoint).toBe(true);
    // the row survives so the annotations stay visible + exportable
    expect(store.listBooks()).toHaveLength(1);
    expect(store.listHighlights('bk-orphan')).toHaveLength(1);
    expect(store.exportNotes('bk-orphan')).toContain('a note that must survive');
    const meta = JSON.parse(readFileSync(join(root, 'library', 'bk-orphan', 'metadata.json'), 'utf-8'));
    expect(meta.fileMissing).toBe(true);
    const second = reconcileLibrary(store);
    expect(second.counts.ORPHANED_DATA).toBe(1); // terminal, stable
    expect(second.fixedPoint).toBe(true);
    store.close();
  });

  it('corrupt metadata is reported, never deleted, never fatal (CORRUPT)', () => {
    seedBook('bk-corruptmeta');
    writeFileSync(join(root, 'library', 'bk-corruptmeta', 'metadata.json'), '{not json');
    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.counts.CORRUPT).toBe(1);
    expect(report.fixedPoint).toBe(true);
    // the folder still exists — arivo never auto-deletes user files
    expect(existsSync(join(root, 'library', 'bk-corruptmeta', 'fixture.epub'))).toBe(true);
    const events = report.events.filter((e) => e.state === 'CORRUPT');
    expect(events).toHaveLength(1);
    store.close();
  });

  it('stale import staging is swept (arivo scratch only)', () => {
    seedBook('bk-clean');
    const staging = join(root, 'library', '.staging', 'half-imported');
    mkdirSync(staging, { recursive: true });
    writeFileSync(join(staging, 'fixture.epub'), fixtureBytes.subarray(0, 100)); // partial
    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.fixedPoint).toBe(true);
    expect(existsSync(staging)).toBe(false);
    expect(existsSync(join(root, 'library', 'bk-clean'))).toBe(true);
    store.close();
  });

  it('junk folders without metadata or book files are reported, not touched', () => {
    seedBook('bk-1');
    mkdirSync(join(root, 'library', 'random-folder'), { recursive: true });
    writeFileSync(join(root, 'library', 'random-folder', 'notes.txt'), 'not a book');
    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.fixedPoint).toBe(true);
    expect(existsSync(join(root, 'library', 'random-folder', 'notes.txt'))).toBe(true);
    store.close();
  });

  it('a renamed book file is adopted when the content hash matches', () => {
    seedBook('bk-renamed');
    const dir = join(root, 'library', 'bk-renamed');
    rmSync(join(dir, 'fixture.epub'));
    copyFileSync(FIXTURE_EPUB, join(dir, 'renamed-book.epub')); // same bytes, new name
    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.fixedPoint).toBe(true);
    // a rename makes the row's file_name stale → rebuilt from truth, hash proves identity
    expect(report.counts.STALE_INDEX + report.counts.UNCHANGED).toBe(1);
    const meta = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf-8'));
    expect(meta.fileName).toBe('renamed-book.epub');
    expect(store.listBooks()[0]!.fileName).toBe('renamed-book.epub');
    const second = reconcileLibrary(store);
    expect(second.counts.UNCHANGED).toBe(1);
    store.close();
  });
});

describe('determinism (I-08) — same input, same outcome', () => {
  it('two identical copies of a fresh library reconcile identically', () => {
    const rootA = mkdtempSync(join(tmpdir(), 'arivo-det-a-'));
    const rootB = mkdtempSync(join(tmpdir(), 'arivo-det-b-'));
    for (const r of [rootA, rootB]) {
      for (const [id, addedAt] of [
        ['bk-newer', 2000],
        ['aa-older', 1000],
      ] as const) {
        const d = join(r, 'library', id);
        mkdirSync(d, { recursive: true });
        copyFileSync(FIXTURE_EPUB, join(d, 'fixture.epub'));
        writeFileSync(
          join(d, 'metadata.json'),
          JSON.stringify(
            {
              id,
              title: id,
              subtitle: null,
              authors: [],
              description: null,
              language: null,
              publisher: null,
              publishedYear: null,
              coverPath: null,
              format: 'epub',
              hash: fixtureHash,
              fileName: 'fixture.epub',
              fileSize: fixtureBytes.length,
              tags: [],
              addedAt,
              updatedAt: addedAt,
            },
            null,
            2,
          ),
        );
        writeFileSync(
          join(d, 'annotations.json'),
          JSON.stringify({ version: 1, bookId: id, progress: null, highlights: [], bookmarks: [] }),
        );
      }
    }
    const storeA = new ArivoStore(openDb(join(rootA, 'index.db')), rootA);
    const storeB = new ArivoStore(openDb(join(rootB, 'index.db')), rootB);
    const reportA = reconcileLibrary(storeA);
    const reportB = reconcileLibrary(storeB);
    // the older book (addedAt 1000) wins in BOTH libraries
    expect(storeA.listBooks().map((b) => b.id)).toEqual(['aa-older']);
    expect(storeB.listBooks().map((b) => b.id)).toEqual(['aa-older']);
    expect(reportA.fixedPoint && reportB.fixedPoint).toBe(true);
    expect(reportA.counts).toEqual(reportB.counts);
    storeA.close();
    storeB.close();
    rmSync(rootA, { recursive: true, force: true });
    rmSync(rootB, { recursive: true, force: true });
  });
});

describe('the engine handles the empty + missing library roots', () => {
  it('an empty library root reconciles to an empty fixed point', () => {
    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.scanned).toBe(0);
    expect(report.fixedPoint).toBe(true);
    store.close();
  });

  it('the portability law, re-proven through reconciliation: delete the db file entirely', () => {
    seedBook('bk-portable', { withHighlight: true });
    const store = makeStore();
    store.close(); // closes db
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    db = openDb(dbPath);
    const fresh = makeStore();
    expect(fresh.listBooks()).toHaveLength(0);
    const report = reconcileLibrary(fresh);
    expect(report.counts.NEW).toBe(1);
    expect(report.fixedPoint).toBe(true);
    expect(fresh.listHighlights('bk-portable')).toHaveLength(1);
    expect(fresh.listHighlights('bk-portable')[0]!.note).toBe('a note that must survive');
    fresh.close();
  });
});

describe('scan safety', () => {
  it('scan tolerates files and special entries in the library root', () => {
    seedBook('bk-1');
    writeFileSync(join(root, 'library', 'loose-file.txt'), 'stray');
    const store = makeStore();
    const report = reconcileLibrary(store);
    expect(report.fixedPoint).toBe(true);
    expect(readdirSync(join(root, 'library')).includes('loose-file.txt')).toBe(true);
    store.close();
  });
});
