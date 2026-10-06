/**
 * SEARCH HARDENING (item 14) — the query layer under attack:
 * quotes, FTS operators, colons, stars, CJK, emoji, huge queries, empties.
 * raw user syntax NEVER becomes FTS syntax, and real queries still find
 * what they should.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { toFtsPrefixQuery } from './search-query.ts';
import { ArivoStore } from './store.ts';
import { openDb } from './db.ts';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { uuidv7, type Highlight } from '@arivo/core';

describe('the query sanitizer', () => {
  it('plain queries become quoted prefix tokens', () => {
    expect(toFtsPrefixQuery('burnout')).toBe('"burnout"*');
    expect(toFtsPrefixQuery('  the   burnout  ')).toBe('"the"* "burnout"*');
  });

  it('FTS operators are consumed as text, never executed', () => {
    expect(toFtsPrefixQuery('burnout AND society')).toBe('"burnout"* "AND"* "society"*');
    // operators collapse into inert word-tokens — never FTS syntax
    expect(toFtsPrefixQuery('NEAR(a, b)')).toBe('"NEARa"* "b"*');
    expect(toFtsPrefixQuery('"quoted phrase"')).toBe('"quoted"* "phrase"*');
    expect(toFtsPrefixQuery('title:colon')).toBe('"titlecolon"*');
    expect(toFtsPrefixQuery('star*')).toBe('"star"*');
    expect(toFtsPrefixQuery('caret^')).toBe('"caret"*');
  });

  it('punctuation-only and empty queries are no-ops (null), never errors', () => {
    expect(toFtsPrefixQuery('')).toBeNull();
    expect(toFtsPrefixQuery('   ')).toBeNull();
    expect(toFtsPrefixQuery('!!! ???')).toBeNull();
    expect(toFtsPrefixQuery('""')).toBeNull();
  });

  it('token and query caps hold', () => {
    const many = toFtsPrefixQuery('a b c d e f g h i j k');
    expect(many!.split(' ')).toHaveLength(8);
    expect(toFtsPrefixQuery('x'.repeat(1000))).toBeNull();
    const longTok = toFtsPrefixQuery('y'.repeat(100));
    expect(longTok).toBe(`"${'y'.repeat(64)}"*`);
  });

  it('CJK and emoji survive sanitization', () => {
    expect(toFtsPrefixQuery('倦怠社会')).toBe('"倦怠社会"*');
    expect(toFtsPrefixQuery('功绩 主体')).toBe('"功绩"* "主体"*');
    expect(toFtsPrefixQuery('🔥 fire')).toBe('"fire"*'); // emoji strips, word stays
  });

  it('arbitrary input never throws and never emits unquoted content', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 300 }), (input) => {
        const q = toFtsPrefixQuery(input);
        if (q === null) return;
        expect(q.length).toBeGreaterThan(0);
        // every emitted token is quoted — no raw operators can survive
        for (const tok of q.split(' ')) {
          expect(tok.startsWith('"')).toBe(true);
          expect(tok.endsWith('*')).toBe(true);
          expect(tok.includes(':')).toBe(false);
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe('the store search end-to-end (no crashes on hostile queries)', () => {
  let root: string;
  let store: ArivoStore;
  const bookId = uuidv7();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'arivo-search-'));
    store = new ArivoStore(openDb(join(root, 'index.db')), root);
    const dir = join(root, 'library', bookId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'metadata.json'),
      JSON.stringify({
        id: bookId,
        title: 'The Burnout Society',
        subtitle: null,
        authors: ['Byung-Chul Han'],
        description: 'Mußiggang hatches the egg of experience',
        language: null,
        publisher: null,
        publishedYear: '2010',
        coverPath: null,
        format: 'epub',
        hash: 'search-test-hash-0001',
        fileName: 'b.epub',
        fileSize: 10,
        tags: [],
        addedAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    writeFileSync(
      join(dir, 'annotations.json'),
      JSON.stringify({ version: 1, bookId, progress: null, highlights: [], bookmarks: [] }),
    );
    store.indexBook({
      id: bookId,
      title: 'The Burnout Society',
      subtitle: null,
      authors: ['Byung-Chul Han'],
      description: 'Mußiggang hatches the egg of experience',
      language: null,
      publisher: null,
      publishedYear: '2010',
      coverPath: null,
      format: 'epub',
      hash: 'search-test-hash-0001',
      fileName: 'b.epub',
      fileSize: 10,
      tags: [],
    });
    const highlight: Highlight = {
      id: uuidv7(),
      bookId,
      anchor: {
        format: 'epub',
        primary: 'epubcfi(/6/4)',
        textRange: null,
        position: null,
      },
      color: 'yellow',
      text: 'multitasking represents an apparent attenuation',
      chapter: null,
      note: 'optimism flipped',
      status: 'resolved',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    store.createHighlight(bookId, highlight);
  });

  afterEach(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('real queries still work: books + highlights found', () => {
    expect(store.search('burnout').some((h) => h.kind === 'book')).toBe(true);
    expect(store.search('multitasking').some((h) => h.kind === 'highlight')).toBe(true);
    expect(store.search('optimism').some((h) => h.kind === 'highlight')).toBe(true);
  });

  it('hostile queries return empty arrays, never throw', () => {
    const hostile = [
      '',
      '   ',
      '"',
      '""',
      'NEAR(a b)',
      'AND OR NOT',
      'col:on',
      'star*',
      '^rank',
      '-',
      'x'.repeat(1000),
      'a b c d e f g h i j k l m n o p',
      '{"json": true}',
      '倦怠',
      '🔥',
      '\n\t\r',
      'DROP TABLE books',
    ];
    for (const q of hostile) {
      expect(() => store.search(q)).not.toThrow();
      expect(Array.isArray(store.search(q))).toBe(true);
    }
  });

  it('quoted phrase words search as tokens (the original behavior kept)', () => {
    // "the burn" prefix-matches "The Burnout Society"
    const hits = store.search('burn soc');
    expect(hits.some((h) => h.kind === 'book' && h.title === 'The Burnout Society')).toBe(true);
  });
});
