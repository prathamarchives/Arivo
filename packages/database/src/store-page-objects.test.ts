/**
 * v0.3.1 — the page objects' storage law: sticky notes and sketches
 * follow the house contract. truth file first (annotations.json), the
 * sqlite index second, portability survives index death (rebuild
 * restores every paper and every stroke), and the sketch save is an
 * upsert (one row per page — strokes append, never fork).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArivoStore } from './store.ts';
import { openDb } from './db.ts';
import { readTruth } from './truth.ts';
import { uuidv7, type Sketch, type StickyNote } from '@arivo/core';

let root: string;
let dbPath: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'arivo-page-'));
  dbPath = join(root, 'index.db');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
});

/** the one door tests open their store through — closed on teardown */
const openStores: ArivoStore[] = [];
function makeStore(): ArivoStore {
  const store = new ArivoStore(openDb(dbPath), root);
  openStores.push(store);
  return store;
}

function seedBook(store: ArivoStore, id: string, title: string): string {
  const dir = join(root, 'library', id);
  mkdirSync(dir, { recursive: true });
  const hash = createHash('sha256').update(`${id}:${title}`).digest('hex');
  writeFileSync(
    join(dir, 'metadata.json'),
    JSON.stringify(
      {
        id,
        title,
        subtitle: null,
        authors: ['An Author'],
        description: null,
        language: 'en',
        publisher: null,
        publishedYear: null,
        coverPath: null,
        format: 'epub',
        hash,
        fileName: `${title}.epub`,
        fileSize: 1000,
        tags: [],
        addedAt: Date.now(),
        updatedAt: Date.now(),
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, 'book.epub'), 'not really an epub');
  return store.registerFromTruth(dir).registered ? id : '';
}

function sticky(bookId: string, over: Partial<StickyNote> = {}): StickyNote {
  return {
    id: uuidv7(),
    bookId,
    anchor: {
      format: 'epub',
      primary: 'epubcfi(/6/10)',
      textRange: null,
      position: { spineIndex: 3, page: 2, percent: 0.42 },
    },
    body: 'the paper says',
    color: 'yellow',
    x: 0.55,
    y: 0.2,
    chapter: 'Chapter Two',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...over,
  };
}

function sketch(bookId: string, over: Partial<Sketch> = {}): Sketch {
  return {
    id: uuidv7(),
    bookId,
    anchor: {
      format: 'epub',
      primary: 'epubcfi(/6/10)',
      textRange: null,
      position: { spineIndex: 3, page: 2, percent: 0.42 },
    },
    strokes: [{ tool: 'pen', color: 'blue', size: 3.5, points: [0.1, 0.1, 0.2, 0.2] }],
    chapter: 'Chapter Two',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...over,
  };
}

describe('the sticky notes (papers pinned to the page)', () => {
  it('create → list round-trips the paper exactly (color, place, anchor)', () => {
    const store = makeStore();
    const id = seedBook(store, 'bk-sticky', 'Sticky Book');
    const s = sticky(id, { body: 'check this claim later', color: 'violet', x: 0.72, y: 0.31 });
    store.createSticky(id, s);
    const listed = store.listStickies(id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(s);
  });

  it('update moves the paper and rewrites the body — the truth file agrees', () => {
    const store = makeStore();
    const id = seedBook(store, 'bk-sticky-move', 'Sticky Move');
    const s = sticky(id);
    store.createSticky(id, s);
    const moved: StickyNote = { ...s, x: 0.1, y: 0.8, body: 'moved and rewritten', color: 'green' };
    store.updateSticky(id, moved);
    const listed = store.listStickies(id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(moved);
    // the truth file is the survivor: the paper lives there too
    const truth = readTruth(join(root, 'library', id), id);
    expect(truth.stickies).toHaveLength(1);
    expect(truth.stickies[0]).toEqual(moved);
  });

  it('delete removes the paper from both houses', () => {
    const store = makeStore();
    const id = seedBook(store, 'bk-sticky-del', 'Sticky Delete');
    const s = sticky(id);
    store.createSticky(id, s);
    store.deleteSticky(id, s.id);
    expect(store.listStickies(id)).toHaveLength(0);
    const truth = readTruth(join(root, 'library', id), id);
    expect(truth.stickies).toHaveLength(0);
  });
});

describe('the sketches (freehand ink on the page)', () => {
  it('save creates then upserts: one row per page, strokes append', () => {
    const store = makeStore();
    const id = seedBook(store, 'bk-ink', 'Ink Book');
    const k = sketch(id);
    store.saveSketch(id, k);
    // the second save with the SAME id is an update, not a second page
    const grown: Sketch = {
      ...k,
      strokes: [...k.strokes, { tool: 'highlighter', color: 'yellow', size: 14, points: [0.5, 0.5, 0.6, 0.6] }],
    };
    store.saveSketch(id, grown);
    const listed = store.listSketches(id);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.strokes).toHaveLength(2);
  });

  it('delete clears the ink from both houses', () => {
    const store = makeStore();
    const id = seedBook(store, 'bk-ink-del', 'Ink Delete');
    const k = sketch(id);
    store.saveSketch(id, k);
    store.deleteSketch(id, k.id);
    expect(store.listSketches(id)).toHaveLength(0);
    expect(readTruth(join(root, 'library', id), id).sketches).toHaveLength(0);
  });
});

describe('the portability law — index death costs zero papers', () => {
  it('rebuildIndex restores every sticky note and every sketch from truth', () => {
    const store = makeStore();
    const id = seedBook(store, 'bk-portable', 'Portable Book');
    const a = sticky(id, { body: 'paper one', color: 'blue' });
    const b = sticky(id, { body: 'paper two', color: 'pink', x: 0.3, y: 0.5 });
    store.createSticky(id, a);
    store.createSticky(id, b);
    const k = sketch(id, {
      strokes: [
        { tool: 'pencil', color: 'yellow', size: 2, points: [0.1, 0.1, 0.2, 0.2, 0.3, 0.15] },
        { tool: 'pen', color: 'green', size: 3.5, points: [0.4, 0.4] },
      ],
    });
    store.saveSketch(id, k);

    // the index dies; the truth stands
    store.rebuildIndex();

    const rebuilt = makeStore();
    const stickies = rebuilt.listStickies(id);
    const sketches = rebuilt.listSketches(id);
    expect(stickies).toHaveLength(2);
    expect(stickies.some((s) => s.body === 'paper one' && s.color === 'blue')).toBe(true);
    expect(stickies.some((s) => s.body === 'paper two' && s.x === 0.3)).toBe(true);
    expect(sketches).toHaveLength(1);
    expect(sketches[0]!.strokes).toHaveLength(2);
    expect(sketches[0]!.strokes[0]!.points).toEqual([0.1, 0.1, 0.2, 0.2, 0.3, 0.15]);
  });
});
