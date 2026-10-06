/**
 * THE PORTABILITY LAW, proven:
 * write a highlight → both stores have it → DELETE the index → rebuild → zero loss.
 * this is session 5's ship check and layer 0's exit criterion, automated.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArivoStore, readTruth } from './store.ts';
import { openDb } from './db.ts';
import { uuidv7, type Highlight, type Bookmark } from '@arivo/core';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '../../..');

/**
 * the book under test: the owner's real book when present (dev machine),
 * the committed fixture otherwise (fresh clones, CI). the portability law
 * must run everywhere — the fixture guarantees it never depends on a
 * gitignored file.
 */
const REAL_EPUB = join(ROOT, 'apps/desktop/public/seed/The Burnout Society.epub');
const FIXTURE_EPUB = join(ROOT, 'test-fixtures/fixture.epub');
const book = existsSync(REAL_EPUB)
  ? {
      path: REAL_EPUB,
      title: 'The Burnout Society',
      authors: ['Byung-Chul Han'],
      fileName: 'The Burnout Society.epub',
      search: 'burnout',
    }
  : {
      path: FIXTURE_EPUB,
      title: 'A Fixture Book',
      authors: ['Fixture Author'],
      fileName: 'fixture.epub',
      search: 'fixture',
    };

let root: string;
let dbPath: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'arivo-store-'));
  dbPath = join(root, 'index.db');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const bookSeedId = uuidv7();
function seedRecord(hash: string): Parameters<ArivoStore['indexBook']>[0] {
  return {
    id: bookSeedId,
    title: book.title,
    subtitle: null,
    authors: book.authors,
    description: null,
    language: 'en',
    publisher: 'Stanford University Press',
    publishedYear: '2015',
    coverPath: 'cover.jpg',
    format: 'epub',
    hash,
    fileName: book.fileName,
    fileSize: readFileSync(book.path).length,
    tags: [],
    addedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('the golden path data layer', () => {
  it('indexes a book folder (the shape the documents layer writes) and lists it', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const bytes = readFileSync(book.path);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const bookDir = join(root, 'library', bookSeedId);
    mkdirSync(bookDir, { recursive: true });
    copyFileSync(book.path, join(bookDir, book.fileName));
    writeFileSync(join(bookDir, 'cover.jpg'), bytes.subarray(0, 2048));
    writeFileSync(
      join(bookDir, 'metadata.json'),
      JSON.stringify(seedRecord(hash), null, 2),
    );
    writeFileSync(
      join(bookDir, 'annotations.json'),
      JSON.stringify({ version: 1, bookId: bookSeedId, progress: null, highlights: [], bookmarks: [] }, null, 2),
    );
    store.indexBook(seedRecord(hash));

    const books = store.listBooks();
    expect(books.length).toBe(1);
    expect(books[0]!.title).toBe(book.title);
    expect(books[0]!.authors.join(' ')).toContain(book.authors[0]!);
    expect(books[0]!.hash).toBe(hash);
    expect(existsSync(join(bookDir, 'annotations.json'))).toBe(true);
    store.close();
  });

  it('refuses to import the same book twice (hash = identity)', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const bytes = readFileSync(book.path);
    const hash = createHash('sha256').update(bytes).digest('hex');
    expect(store.findByHash(hash)).toBe(bookSeedId);
    store.close();
  });
});

describe('THE PORTABILITY LAW — dual-write, kill the index, rebuild, zero loss', () => {
  let bookId: string;
  let highlight: Highlight;
  let bookmark: Bookmark;

  it('step 1: write a highlight + note + bookmark + progress', async () => {
    const store = new ArivoStore(openDb(dbPath), root);
    bookId = store.listBooks()[0]!.id;

    highlight = {
      id: uuidv7(),
      bookId,
      anchor: {
        format: 'epub',
        primary: 'epubcfi(/6/8!/4/22,/1:100,/1:180)',
        textRange: {
          exact: 'multitasking represents an apparent attenuation, even a liberation',
          prefix: 'the achievement society. ',
          suffix: ' from the compulsion of',
        },
        position: { spineIndex: 5, percent: 0.31, chapter: 'Profound Boredom' },
      },
      color: 'yellow',
      text: 'multitasking represents an apparent attenuation, even a liberation',
      chapter: 'Profound Boredom',
      note: 'this is where he flips the optimism on multitasking',
      status: 'resolved',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    bookmark = {
      id: uuidv7(),
      bookId,
      anchor: { format: 'epub', primary: 'epubcfi(/6/10)', textRange: null, position: { percent: 0.55 } },
      label: 'Vita Activa',
      chapter: 'Vita Activa',
      createdAt: Date.now(),
    };

    store.createHighlight(bookId, highlight);
    store.createBookmark(bookId, bookmark);
    store.saveProgress(bookId, {
      bookId,
      locator: 'epubcfi(/6/8!/4/22,/1:100,/1:180)',
      percent: 0.31,
      chapter: 'Profound Boredom',
      startedAt: Date.now() - 1000,
      lastReadAt: Date.now(),
      completedAt: false,
    });

    // both stores have it
    expect(store.listHighlights(bookId).length).toBe(1);
    const truth = readTruth(join(root, 'library', bookId), bookId);
    expect(truth.highlights.length).toBe(1);
    expect(truth.highlights[0]!.note).toBe('this is where he flips the optimism on multitasking');
    expect(truth.bookmarks.length).toBe(1);
    expect(truth.progress?.percent).toBe(0.31);
    store.close();
  });

  it('step 2: kill the index entirely — truth files survive', () => {
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    expect(existsSync(dbPath)).toBe(false);
    expect(existsSync(join(root, 'library', bookId, 'annotations.json'))).toBe(true);
  });

  it('step 3: rebuild from truth → EVERYTHING returns, zero loss', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const result = store.rebuildIndex();
    expect(result.books).toBe(1);
    expect(result.highlights).toBe(1);
    expect(result.bookmarks).toBe(1);

    const hl = store.listHighlights(bookId);
    expect(hl.length).toBe(1);
    expect(hl[0]!.id).toBe(highlight.id);
    expect(hl[0]!.note).toBe(highlight.note);
    expect(hl[0]!.anchor.textRange?.exact).toContain('multitasking');
    expect(hl[0]!.color).toBe('yellow');

    const bm = store.listBookmarks(bookId);
    expect(bm.length).toBe(1);
    expect(bm[0]!.label).toBe('Vita Activa');

    const progress = store.getProgress(bookId);
    expect(progress?.percent).toBe(0.31);
    expect(progress?.chapter).toBe('Profound Boredom');
    store.close();
  });

  it('step 4: the rebuilt index still searches (FTS5 restored)', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const byBook = store.search(book.search);
    expect(byBook.some((h) => h.kind === 'book')).toBe(true);
    const byHighlight = store.search('multitasking');
    expect(byHighlight.some((h) => h.kind === 'highlight')).toBe(true);
    const byNote = store.search('optimism');
    expect(byNote.some((h) => h.kind === 'highlight' && h.id === highlight.id)).toBe(true);
    store.close();
  });

  it('step 5: reading notes export from the rebuilt store', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const md = store.exportNotes(bookId);
    expect(md).toContain('multitasking');
    expect(md).toContain('this is where he flips the optimism on multitasking');
    expect(md).toContain('Vita Activa');
    expect(md).toContain('31%');
    store.close();
  });
});

describe('collections ride along (dual-write on the library root)', () => {
  it('create, assign, and read back', () => {
    const store = new ArivoStore(openDb(dbPath), root);
    const col = store.createCollection('philosophy', null);
    const bookId = store.listBooks()[0]!.id;
    store.assignToCollection(col.id, bookId);
    expect(store.listCollections()[0]!.count).toBe(1);
    expect(store.listCollectionBooks(col.id)).toContain(bookId);
    const raw = readFileSync(join(root, 'library', 'collections.json'), 'utf-8');
    expect(raw).toContain('philosophy');
    store.removeBook(bookId, false);
    store.close();
  });
});
