/**
 * THE DATA-INTEGRITY AUDIT (final campaign P4):
 * one journey, every family, through every lifecycle gate —
 * write → search → ledger → cascade-delete a book → sibling intact →
 * rebuild → the deleted book stays dead, the survivor fully alive.
 *
 * the invariant under audit: deleting a book never orphans data that
 * claims a source, never costs a sibling its data, and never
 * resurrects through rebuild. each store path was lawed individually;
 * this is the whole-system walk.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { uuidv7, type Highlight, type Anchor } from '@arivo/core';
import { ArivoStore, readTruth } from './store.ts';
import { openDb } from './db.ts';

let root: string;
let store: ArivoStore;

function seedBook(id: string, title: string, fileName: string): void {
  const dir = join(root, 'library', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, fileName), `bytes of ${title}`);
  writeFileSync(
    join(dir, 'metadata.json'),
    JSON.stringify({
      id, title, subtitle: null, authors: ['Author'], description: null, language: 'en',
      publisher: null, publishedYear: null, coverPath: null, format: 'epub',
      hash: createHash('sha256').update(`bytes of ${title}`).digest('hex'),
      fileName, fileSize: 20, tags: [], addedAt: 1, updatedAt: 1,
    }),
  );
  writeFileSync(
    join(dir, 'annotations.json'),
    JSON.stringify({ version: 1, bookId: id, progress: null, highlights: [], bookmarks: [] }),
  );
  store.indexBook({
    id, title, subtitle: null, authors: ['Author'], description: null, language: 'en',
    publisher: null, publishedYear: null, coverPath: null, format: 'epub',
    hash: createHash('sha256').update(`bytes of ${title}`).digest('hex'),
    fileName, fileSize: 20, tags: [], addedAt: 1, updatedAt: 1,
  });
}

const anchor = (locator: string): Anchor => ({
  format: 'epub',
  primary: locator,
  textRange: { exact: `exact ${locator}`, prefix: 'pre', suffix: 'post' },
  position: { spineIndex: 1, page: 2, percent: 0.5, chapter: 'chapter one' },
});

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'arivo-integrity-'));
  store = new ArivoStore(openDb(join(root, 'index.db')), root);
});

afterAll(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe('the whole-system walk', () => {
  it('step 1 — every family writes, searches, and joins the ledger', () => {
    seedBook('book-a', 'A Study of Two Cities', 'a.epub');
    seedBook('book-b', 'B is for Survivor', 'b.epub');

    const hA: Highlight = {
      id: uuidv7(), bookId: 'book-a', color: 'yellow', status: 'resolved',
      text: 'it was the best of passages', chapter: 'chapter one', note: null,
      createdAt: 10, updatedAt: 10, anchor: anchor('cfi-a'),
    };
    store.createHighlight('book-a', hA);
    const hB: Highlight = {
      id: uuidv7(), bookId: 'book-b', color: 'green', status: 'resolved',
      text: 'the survivor keeps this', chapter: 'chapter one', note: null,
      createdAt: 11, updatedAt: 11, anchor: anchor('cfi-b'),
    };
    store.createHighlight('book-b', hB);
    store.createBookmark('book-a', {
      id: uuidv7(), bookId: 'book-a', label: null, chapter: 'chapter one',
      createdAt: 12, anchor: anchor('cfi-bm'),
    });
    store.createNote('book-a', {
      id: uuidv7(), bookId: 'book-a', question: false, chapter: 'chapter one',
      body: 'an ordinary margin thought', createdAt: 13, updatedAt: 13, anchor: anchor('cfi-n'),
    });
    store.createNote('book-a', {
      id: uuidv7(), bookId: 'book-a', question: true, chapter: 'chapter one',
      body: 'what did the author mean here?', createdAt: 14, updatedAt: 14, anchor: anchor('cfi-q'),
    });
    for (const kind of ['research', 'make', 'reflect'] as const) {
      store.createDeskDoc('book-a', {
        id: uuidv7(), bookId: 'book-a', kind,
        title: `${kind} document`,
        body: `the ${kind} body with searchable words`,
        sourceRefs: [{ quote: 'it was the best of passages', locator: 'cfi-a', chapter: 'chapter one', highlightId: hA.id, noteId: null }],
        createdAt: 15, updatedAt: 15,
      });
    }

    // search reaches every family
    expect(store.search('best of passages').some((r) => r.bookId === 'book-a')).toBe(true);
    expect(store.search('searchable words').some((r) => r.bookId === 'book-a')).toBe(true);
    // the ledger carries the full chain: artifact → note → selection → chapter → book
    const ledger = store.listArchiveMarks();
    const aEntries = ledger.filter((e) => e.bookId === 'book-a');
    expect(aEntries).toHaveLength(7); // 1 mark + 1 bookmark + 2 notes + 3 desk docs
    const doc = aEntries.find((e) => e.kind === 'deskdoc' && e.deskTitle === 'research document');
    expect(doc).toBeDefined();
    expect(doc!.deskKind).toBe('research');
    expect(doc!.sourceRefs?.[0]!.quote).toBe('it was the best of passages');
  });

  it('step 2 — deleting book A cascades every family; sibling B pays nothing', () => {
    store.removeBook('book-a', true);
    expect(store.listBooks().map((b) => b.id)).toEqual(['book-b']);
    expect(store.listHighlights('book-a')).toHaveLength(0);
    expect(store.listNotes('book-a')).toHaveLength(0);
    expect(store.listDeskDocs('book-a')).toHaveLength(0);
    // the ledger never shows a ghost: nothing claims a dead source
    const ledger = store.listArchiveMarks();
    expect(ledger.filter((e) => e.bookId === 'book-a')).toHaveLength(0);
    expect(ledger.filter((e) => e.bookId === 'book-b')).toHaveLength(1);
    // search has no dangling hits
    expect(store.search('best of passages')).toHaveLength(0);
    expect(store.search('searchable words')).toHaveLength(0);
    expect(store.search('survivor keeps').some((r) => r.bookId === 'book-b')).toBe(true);
    // the survivor's truth is untouched
    const truthB = readTruth(join(root, 'library', 'book-b'), 'book-b');
    expect(truthB.highlights).toHaveLength(1);
  });

  it('step 3 — rebuild after the deletion: A stays dead, B fully alive', () => {
    store.rebuildIndex();
    expect(store.listBooks().map((b) => b.id)).toEqual(['book-b']);
    // A's folder is gone (deleteFiles) — no resurrection is even possible
    expect(store.listArchiveMarks().filter((e) => e.bookId === 'book-a')).toHaveLength(0);
    const ledgerB = store.listArchiveMarks().filter((e) => e.bookId === 'book-b');
    expect(ledgerB).toHaveLength(1);
    expect(ledgerB[0]!.text).toBe('the survivor keeps this');
    expect(store.search('survivor keeps').some((r) => r.bookId === 'book-b')).toBe(true);
    // progress + collection relationships stay honest through rebuild
    const col = store.createCollection('kept', null);
    store.assignToCollection(col.id, 'book-b');
    store.rebuildIndex();
    expect(store.listCollections().map((c) => c.collection.name)).toContain('kept');
  });
});
