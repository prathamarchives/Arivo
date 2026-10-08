/**
 * THE IPC CONTRACT UNDER ATTACK (I-25, I-27, I-28) —
 * every schema meets null, undefined, wrong types, huge strings, bogus
 * enums, malformed structures. nothing reaches a service unvalidated;
 * every rejection is a typed VALIDATION_ERROR with a path.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ValidationError } from '@arivo/core';
import { schemas } from './ipc-schemas.ts';
import { validateLibraryRoot, validateImportSource, ensureInside } from './services/paths.ts';
import { ArivoError } from '@arivo/core';

const expectReject = (schema: { (input: unknown, path?: string): unknown }, input: unknown): void => {
  try {
    schema(input);
    expect.unreachable('schema must reject this input');
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe('VALIDATION_FAILED');
  }
};

const expectAccept = <T>(schema: { (input: unknown, path?: string): T }, input: unknown): T => {
  return schema(input);
};

const HOSTILE = [
  null,
  undefined,
  0,
  42,
  -1,
  NaN,
  Infinity,
  true,
  false,
  '',
  [],
  {},
  () => 'x',
  Symbol.iterator,
];

describe('id-bearing channels reject every hostile shape', () => {
  for (const [label, schema] of Object.entries({
    bookGet: schemas.bookGet,
    annotationsList: schemas.annotationsList,
    collectionsRemove: schemas.collectionsRemove,
    collectionsBooks: schemas.collectionsBooks,
    exportNotes: schemas.exportNotes,
  })) {
    it(`${label}: hostile inputs all reject with VALIDATION_FAILED`, () => {
      for (const input of HOSTILE) {
        expectReject(schema, input);
      }
      // and an oversized id too
      expectReject(schema, 'x'.repeat(300));
    });

    it(`${label}: a sane id passes`, () => {
      expect(expectAccept(schema, '0192837465abcdef01234567')).toBe('0192837465abcdef01234567');
    });
  }
});

describe('structured channels reject malformed structures', () => {
  it('library:remove — wrong shapes, wrong types, missing fields', () => {
    for (const input of HOSTILE) {
      expectReject(schemas.remove, input);
    }
    expectReject(schemas.remove, { id: 'good-id', deleteFiles: 'yes' });
    expectReject(schemas.remove, { id: 'good-id' });
    expectReject(schemas.remove, { deleteFiles: true });
    expectReject(schemas.remove, { id: 123, deleteFiles: true });
    expectAccept(schemas.remove, { id: 'good-id', deleteFiles: false });
  });

  it('library:import — non-arrays, non-strings, oversized batches reject', () => {
    for (const input of HOSTILE) {
      if (Array.isArray(input)) continue; // [] is a legal no-op import
      expectReject(schemas.importPaths, input);
    }
    expectReject(schemas.importPaths, ['ok.epub', 42]);
    expectReject(schemas.importPaths, ['']);
    expectReject(schemas.importPaths, Array.from({ length: 51 }, () => '/tmp/a.epub'));
    // valid: absolute paths, up to 50
    expectAccept(
      schemas.importPaths,
      Array.from({ length: 50 }, (_, i) => `/books/b${i}.epub`),
    ).forEach((p) => expect(p).toMatch(/^\/books\/b\d+\.epub$/));
  });

  it('progress:save — the full progress contract is enforced', () => {
    const good = {
      bookId: 'bk-1',
      progress: {
        bookId: 'bk-1',
        locator: 'epubcfi(/6/8!/4/22,/1:100,/1:180)',
        percent: 0.31,
        chapter: 'Chapter Two',
        startedAt: 1000,
        lastReadAt: 2000,
        completedAt: false,
      },
    };
    expect(() => expectAccept(schemas.progressSave, good)).not.toThrow();
    // percent is a domain number: 0..1
    expectReject(schemas.progressSave, {
      bookId: 'bk-1',
      progress: { ...good.progress, percent: 31 },
    });
    expectReject(schemas.progressSave, { bookId: 'bk-1', progress: { ...good.progress, locator: '' } });
    expectReject(schemas.progressSave, { bookId: '', progress: good.progress });
    expectReject(schemas.progressSave, { progress: good.progress });
  });

  it('highlight:create — anchor + status + color enums enforced', () => {
    const base = {
      id: 'hl-1',
      bookId: 'bk-1',
      anchor: {
        format: 'epub',
        primary: 'epubcfi(/6/8)',
        textRange: { exact: 'some text', prefix: 'before ', suffix: ' after' },
        position: { spineIndex: 3, percent: 0.4 },
      },
      color: 'yellow',
      text: 'some text',
      chapter: 'Chapter Two',
      note: null,
      status: 'resolved',
      createdAt: 1,
      updatedAt: 2,
    };
    expect(() => expectAccept(schemas.highlightCreate, { bookId: 'bk-1', h: base })).not.toThrow();
    expectReject(schemas.highlightCreate, { bookId: 'bk-1', h: { ...base, color: 'chartreuse' } });
    expectReject(schemas.highlightCreate, { bookId: 'bk-1', h: { ...base, status: 'GUESSED' } });
    expectReject(schemas.highlightCreate, {
      bookId: 'bk-1',
      h: { ...base, anchor: { ...base.anchor, format: 'mobi' } },
    });
    expectReject(schemas.highlightCreate, { bookId: 'bk-1', h: { ...base, text: 'x'.repeat(21_000) } });
    // the honest ambiguous status IS a legal value
    expect(() =>
      expectAccept(schemas.highlightCreate, { bookId: 'bk-1', h: { ...base, status: 'ambiguous' } }),
    ).not.toThrow();
  });

  it('search:query — empty, huge, and non-string reject', () => {
    for (const input of HOSTILE) {
      expectReject(schemas.searchQuery, input);
    }
    expectReject(schemas.searchQuery, 'x'.repeat(600));
    expect(() => expectAccept(schemas.searchQuery, 'burnout')).not.toThrow();
  });

  it('settings:set — enum fields + guarded booksDir', () => {
    const good = {
      theme: 'night',
      fontStep: 2,
      flow: 'scrolled',
      libraryView: 'list',
      librarySize: 'l',
      booksDir: null,
    };
    expect(() => expectAccept(schemas.settingsSet, good)).not.toThrow();
    expectReject(schemas.settingsSet, { ...good, theme: 'neon' });
    expectReject(schemas.settingsSet, { ...good, fontStep: 9 });
    expectReject(schemas.settingsSet, { ...good, booksDir: '' });
    expect(() =>
      expectAccept(schemas.settingsSet, { ...good, booksDir: 'C:\\Users\\me\\Arivo' }),
    ).not.toThrow();
  });

  it('collections:create — name bounds enforced', () => {
    expectReject(schemas.collectionsCreate, { name: '', description: null });
    expectReject(schemas.collectionsCreate, { name: 'x'.repeat(201), description: null });
    expectReject(schemas.collectionsCreate, { name: 'ok' }); // missing description
    expect(() =>
      expectAccept(schemas.collectionsCreate, { name: 'philosophy', description: null }),
    ).not.toThrow();
  });

  it('book:set-tags — tags are bounded, non-empty strings in a bounded array', () => {
    for (const input of HOSTILE) {
      expectReject(schemas.bookSetTags, input);
    }
    expectReject(schemas.bookSetTags, { id: 'bk-1', tags: 'philosophy' });
    expectReject(schemas.bookSetTags, { id: 'bk-1', tags: [''] });
    expectReject(schemas.bookSetTags, { id: 'bk-1', tags: ['ok', 42] });
    expectReject(schemas.bookSetTags, { id: 'bk-1', tags: ['x'.repeat(101)] });
    expectReject(schemas.bookSetTags, { id: '', tags: ['ok'] });
    expectReject(schemas.bookSetTags, { tags: ['ok'] });
    expectReject(
      schemas.bookSetTags,
      { id: 'bk-1', tags: Array.from({ length: 51 }, (_, i) => `t${i}`) },
    );
    // empty tags = clearing them — legal, honest
    expect(() => expectAccept(schemas.bookSetTags, { id: 'bk-1', tags: [] })).not.toThrow();
    expect(() =>
      expectAccept(schemas.bookSetTags, { id: 'bk-1', tags: ['philosophy', 'to-reread'] }),
    ).not.toThrow();
  });

  it('collections:rename — {id, name} with the same bounds as create', () => {
    for (const input of HOSTILE) {
      expectReject(schemas.collectionsRename, input);
    }
    expectReject(schemas.collectionsRename, { id: 'c-1', name: '' });
    expectReject(schemas.collectionsRename, { id: 'c-1', name: 'x'.repeat(201) });
    expectReject(schemas.collectionsRename, { id: '', name: 'ok' });
    expectReject(schemas.collectionsRename, { name: 'ok' });
    expectReject(schemas.collectionsRename, { id: 'c-1' });
    expect(() => expectAccept(schemas.collectionsRename, { id: 'c-1', name: 'renamed' })).not.toThrow();
  });
});

describe('fuzz: arbitrary json never slips through object schemas', () => {
  const jsonArb = fc.jsonValue({ maxDepth: 4 });

  it('highlightDelete rejects everything that is not {bookId, id} strings', () => {
    fc.assert(
      fc.property(jsonArb, (input) => {
        const obj =
          typeof input === 'object' && input !== null && !Array.isArray(input)
            ? (input as Record<string, unknown>)
            : null;
        if (obj) {
          const bookId = obj['bookId'];
          const hid = obj['id'];
          if (
            typeof bookId === 'string' && bookId.length > 0 && bookId.length <= 256 &&
            typeof hid === 'string' && hid.length > 0 && hid.length <= 256
          ) {
            return; // the rare structurally-valid case
          }
        }
        expectReject(schemas.highlightDelete, input);
      }),
      { numRuns: 500 },
    );
  });
});

describe('the path guards (I-27, I-28)', () => {
  it('library roots: absolute + real, never a filesystem root', () => {
    expect(() => validateLibraryRoot('/home/user/Arivo')).not.toThrow();
    if (process.platform === 'win32') {
      expect(() => validateLibraryRoot('C:\\Users\\me\\Arivo')).not.toThrow();
      expect(() => validateLibraryRoot('C:\\')).toThrow(ArivoError);
    } else {
      expect(() => validateLibraryRoot('/')).toThrow(ArivoError);
    }
    expect(() => validateLibraryRoot('relative/path')).toThrow(ArivoError);
    expect(() => validateLibraryRoot('')).toThrow(ArivoError);
    try {
      validateLibraryRoot('C:\\');
      expect.unreachable();
    } catch (err) {
      expect((err as ArivoError).code).toBe('PATH_INVALID');
    }
  });

  it('import sources: absolute with the right extension', () => {
    expect(() => validateImportSource('/books/burnout.epub')).not.toThrow();
    expect(() => validateImportSource('/books/paper.pdf')).not.toThrow();
    expect(() => validateImportSource('books/relative.epub')).toThrow(ArivoError);
    expect(() => validateImportSource('/books/burnout.mobi')).toThrow(ArivoError);
    expect(() => validateImportSource('')).toThrow(ArivoError);
    expect(() => validateImportSource('/books/no-extension')).toThrow(ArivoError);
  });

  it('containment: ids cannot walk out of the library', () => {
    expect(() => ensureInside('/home/user/Arivo/library', '/home/user/Arivo/library/bk-1', 'book')).not.toThrow();
    expect(() =>
      ensureInside('/home/user/Arivo/library', '/home/user/Arivo/library/../config', 'book'),
    ).toThrow(ArivoError);
    expect(() => ensureInside('/home/user/Arivo/library', '/etc/passwd', 'book')).toThrow(ArivoError);
    try {
      ensureInside('/home/user/Arivo/library', '/etc', 'book');
      expect.unreachable();
    } catch (err) {
      expect((err as ArivoError).code).toBe('PATH_ESCAPE');
    }
  });
});
