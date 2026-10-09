/**
 * v0.3.3 — the notebook's storage law: the book of you follows the
 * house contract. truth file first (library/notebook.json), the sqlite
 * index second, portability survives index death (rebuild restores
 * every page and every link), and saves are upserts (a page is a page,
 * never a fork).
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArivoStore } from './store.ts';
import { openDb } from './db.ts';
import { uuidv7, type AnnotationLink, type NotebookPage } from '@arivo/core';

/** every test gets its own library — the truth file is stateful state */
const roots: string[] = [];
function makeRoot(): { root: string; dbPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'arivo-notebook-'));
  roots.push(root);
  return { root, dbPath: join(root, 'index.db') };
}

afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
});

function makeStore(root: string, dbPath: string): ArivoStore {
  return new ArivoStore(openDb(dbPath), root);
}

function page(body: string): NotebookPage {
  return { id: uuidv7(), title: 'a title', body, strokes: [], createdAt: 100, updatedAt: 100 };
}

function link(reason: string): AnnotationLink {
  return {
    id: uuidv7(),
    from: { kind: 'highlight', id: 'h1' },
    to: { kind: 'page', id: 'p1' },
    reason,
    createdAt: 200,
  };
}

describe('the notebook storage law', () => {
  it('empty reads as empty — a missing file is an unopened book', () => {
    const { root, dbPath } = makeRoot();
    const store = makeStore(root, dbPath);
    const n = store.getNotebook();
    expect(n.pages).toEqual([]);
    expect(n.links).toEqual([]);
    expect(n.state.currentPage).toBe(0);
    store.close();
  });

  it('save = upsert: truth first, the index second, reads agree', () => {
    const { root, dbPath } = makeRoot();
    const store = makeStore(root, dbPath);
    const p = page('the first thought');
    store.saveNotebookPage(p);
    const p2 = { ...p, body: 'the thought, revised', updatedAt: 300 };
    store.saveNotebookPage(p2);

    const truth = JSON.parse(readFileSync(join(root, 'library', 'notebook.json'), 'utf-8'));
    expect(truth.pages).toHaveLength(1);
    expect(truth.pages[0]!.body).toBe('the thought, revised');

    const n = store.getNotebook();
    expect(n.pages).toHaveLength(1);
    expect(n.pages[0]!.body).toBe('the thought, revised');
    store.close();
  });

  it('links save with their reason; deletes honor the truth', () => {
    const { root, dbPath } = makeRoot();
    const store = makeStore(root, dbPath);
    const l = link('same mechanism — self-exploitation');
    store.saveNotebookLink(l);
    expect(store.getNotebook().links).toHaveLength(1);
    expect(store.getNotebook().links[0]!.reason).toContain('self-exploitation');

    store.deleteNotebookLink(l.id);
    expect(store.getNotebook().links).toHaveLength(0);
    const truth = JSON.parse(readFileSync(join(root, 'library', 'notebook.json'), 'utf-8'));
    expect(truth.links).toHaveLength(0);
    store.close();
  });

  it('the index dies, the book survives — the truth is the truth', () => {
    const { root, dbPath } = makeRoot();
    const store = makeStore(root, dbPath);
    store.saveNotebookPage(page('a page that must survive'));
    store.saveNotebookLink(link('the thread that must survive'));
    store.close();

    /* the index dies; the truth file stays */
    rmSync(dbPath, { force: true });
    const reborn = makeStore(root, dbPath);
    const n = reborn.getNotebook();
    expect(n.pages).toHaveLength(1);
    expect(n.pages[0]!.body).toBe('a page that must survive');
    expect(n.links).toHaveLength(1);
    expect(n.links[0]!.reason).toBe('the thread that must survive');
    reborn.close();
  });

  it('a torn truth file reads as the last good state, never a crash', () => {
    const { root, dbPath } = makeRoot();
    const store = makeStore(root, dbPath);
    store.setNotebookPage(4);
    store.close();
    /* a torn write: invalid json on disk */
    const file = join(root, 'library', 'notebook.json');
    if (existsSync(file)) writeFileSync(file, '{ torn');
    const reborn = makeStore(root, dbPath);
    expect(reborn.getNotebook().pages).toEqual([]);
    expect(reborn.getNotebook().state.currentPage).toBe(0);
    reborn.close();
  });
});
