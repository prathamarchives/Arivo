/**
 * the renderer's api client: real bridge in electron, mock in the browser dev loop.
 * everything above this file never learns which one is running.
 */
import type {
  ArivoApi,
  AppSettings,
  ArchiveEntry,
  Bookmark,
  BookWithProgress,
  Collection,
  DeskDoc,
  Highlight,
  ImportResult,
  Note,
  SearchHit,
  SessionStats,
  Sketch,
  StickyNote,
} from '@arivo/core';
import { DEFAULT_SETTINGS } from '@arivo/core';

declare global {
  interface Window {
    arivo?: ArivoApi & { getPathForFile?: (file: File) => string };
  }
}

export const platform: 'electron' | 'web' = window.arivo ? 'electron' : 'web';
export const getPathForFile = (file: File): string | null =>
  window.arivo?.getPathForFile?.(file) ?? null;

export const api: ArivoApi = window.arivo ?? createMockApi();

// ---------- the browser mock (dev:web) ----------

/** blob urls live for the session; removal revokes — no stale handles */
const mockBlobs = new Map<string, string>();

export function registerMockBlob(id: string, url: string): void {
  mockBlobs.set(id, url);
}

function revokeMockBlob(id: string): void {
  const url = mockBlobs.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    mockBlobs.delete(id);
  }
}

export function createMockApi(): ArivoApi {
  const KEY = 'arivo-mock';
  interface MockState {
    books: (BookWithProgress & { blobUrl?: string })[];
    highlights: Highlight[];
    bookmarks: Bookmark[];
    notes: Note[];
    deskDocs: DeskDoc[];
    stickies: StickyNote[];
    sketches: Sketch[];
    collections: { collection: Collection; count: number }[];
    settings: AppSettings;
  }
  const load = (): MockState => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MockState>;
        // tolerant read: state written before the family grew has no latecomers
        return {
          ...fresh(),
          ...parsed,
          deskDocs: parsed.deskDocs ?? [],
          stickies: parsed.stickies ?? [],
          sketches: parsed.sketches ?? [],
        };
      }
    } catch {
      /* fresh */
    }
    return fresh();
  };
  const fresh = (): MockState => ({
    books: [
      {
        id: 'mock-burnout',
        title: 'The Burnout Society',
        subtitle: null,
        authors: ['Byung-Chul Han'],
        description: null,
        language: 'en',
        publisher: null,
        publishedYear: '2010',
        coverPath: null,
        format: 'epub',
        hash: 'mock',
        fileName: 'The Burnout Society.epub',
        fileSize: 0,
        addedAt: Date.now() - 86400000,
        updatedAt: Date.now(),
        tags: ['philosophy'],
        progress: null,
      },
    ],
    highlights: [],
    bookmarks: [],
    notes: [],
    deskDocs: [],
    stickies: [],
    sketches: [],
    collections: [{ collection: { id: 'mock-col-1', name: 'philosophy', description: null, createdAt: Date.now() }, count: 1 }],
    settings: { ...DEFAULT_SETTINGS },
  });
  let state = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const uid = (): string => {
    const g = globalThis.crypto as { randomUUID?: () => string };
    return g.randomUUID ? g.randomUUID() : `id-${Math.random().toString(36).slice(2)}`;
  };

  const mock: ArivoApi & { importFiles?: (files: File[]) => ImportResult[] } = {
    platform: 'web',
    importFiles: (files) => {
      const results: ImportResult[] = [];
      for (const f of files) {
        if (!/\.(epub|pdf)$/i.test(f.name)) {
          results.push({ ok: false, bookId: null, title: f.name, reason: 'unsupported format' });
          continue;
        }
        const id = `web-${f.name.replace(/\W+/g, '-')}`;
        registerMockBlob(id, URL.createObjectURL(f));
        const book: BookWithProgress = {
          id,
          title: f.name.replace(/\.(epub|pdf)$/i, ''),
          subtitle: null,
          authors: [],
          description: null,
          language: null,
          publisher: null,
          publishedYear: null,
          coverPath: null,
          format: f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub',
          hash: id,
          fileName: f.name,
          fileSize: f.size,
          addedAt: Date.now(),
          updatedAt: Date.now(),
          tags: [],
          progress: null,
        };
        state = { ...state, books: [book, ...state.books] };
        results.push({ ok: true, bookId: id, title: book.title, reason: null });
      }
      save();
      return results;
    },
    library: {
      list: async () => state.books,
      pickAndImport: async () => [],
      importPaths: async () => {
        throw new Error('import runs in the desktop app — dev:web is for the reading loop');
      },
      remove: async (id) => {
        state = { ...state, books: state.books.filter((b) => b.id !== id) };
        save();
        revokeMockBlob(id); // no stale object urls
      },
    },
    book: {
      openUrl: (id) => mockBlobs.get(id) ?? `/seed/${state.books.find((b) => b.id === id)?.fileName ?? ''}`,
      coverUrl: () => '',
      get: async (id) => state.books.find((b) => b.id === id) ?? null,
      setTags: async (id, tags) => {
        state = {
          ...state,
          books: state.books.map((b) => (b.id === id ? { ...b, tags } : b)),
        };
        save();
      },
    },
    progress: {
      save: async (bookId, progress) => {
        state = {
          ...state,
          books: state.books.map((b) => (b.id === bookId ? { ...b, progress } : b)),
        };
        save();
      },
    },
    sessions: {
      begin: async () => 'mock-session',
      end: async () => undefined,
      stats: async () =>
        ({
          totalMs: 0,
          weekMs: 0,
          streakDays: 0,
          sessions: 0,
          days: [],
          books: [],
        }) as SessionStats,
    },
    annotations: {
      list: async (bookId) => ({
        highlights: state.highlights.filter((h) => h.bookId === bookId),
        bookmarks: state.bookmarks.filter((b) => b.bookId === bookId),
        notes: state.notes.filter((n) => n.bookId === bookId),
        stickies: state.stickies.filter((s) => s.bookId === bookId),
        sketches: state.sketches.filter((s) => s.bookId === bookId),
      }),
      createHighlight: async (bookId, h) => {
        state = { ...state, highlights: [...state.highlights, h] };
        save();
      },
      updateHighlight: async (bookId, h) => {
        state = {
          ...state,
          highlights: state.highlights.map((x) => (x.id === h.id ? h : x)),
        };
        save();
      },
      deleteHighlight: async (bookId, id) => {
        state = { ...state, highlights: state.highlights.filter((h) => h.id !== id) };
        save();
      },
      createBookmark: async (bookId, b) => {
        state = { ...state, bookmarks: [...state.bookmarks, b] };
        save();
      },
      deleteBookmark: async (bookId, id) => {
        state = { ...state, bookmarks: state.bookmarks.filter((b) => b.id !== id) };
        save();
      },
      createNote: async (bookId, n) => {
        state = { ...state, notes: [...state.notes, n] };
        save();
      },
      updateNote: async (bookId, n) => {
        state = { ...state, notes: state.notes.map((x) => (x.id === n.id ? n : x)) };
        save();
      },
      deleteNote: async (bookId, id) => {
        state = { ...state, notes: state.notes.filter((n) => n.id !== id) };
        save();
      },
      createSticky: async (bookId, s) => {
        state = { ...state, stickies: [...state.stickies, s] };
        save();
      },
      updateSticky: async (bookId, s) => {
        state = { ...state, stickies: state.stickies.map((x) => (x.id === s.id ? s : x)) };
        save();
      },
      deleteSticky: async (bookId, id) => {
        state = { ...state, stickies: state.stickies.filter((s) => s.id !== id) };
        save();
      },
      saveSketch: async (bookId, s) => {
        const exists = state.sketches.some((x) => x.id === s.id);
        state = {
          ...state,
          sketches: exists ? state.sketches.map((x) => (x.id === s.id ? s : x)) : [...state.sketches, s],
        };
        save();
      },
      deleteSketch: async (bookId, id) => {
        state = { ...state, sketches: state.sketches.filter((s) => s.id !== id) };
        save();
      },
    },
    desk: {
      listDocs: async (bookId) =>
        state.deskDocs
          .filter((d) => d.bookId === bookId)
          .sort((a, b) => b.updatedAt - a.updatedAt),
      createDoc: async (bookId, d) => {
        // idempotent: a retried create after a confirmed save must not duplicate
        if (state.deskDocs.some((x) => x.id === d.id)) return;
        state = { ...state, deskDocs: [...state.deskDocs, d] };
        save();
      },
      updateDoc: async (bookId, d) => {
        // insert-if-missing mirrors the desktop store's honest fallback —
        // an optimistic doc that outran its create must never drop
        state = {
          ...state,
          deskDocs: state.deskDocs.some((x) => x.id === d.id)
            ? state.deskDocs.map((x) => (x.id === d.id ? d : x))
            : [...state.deskDocs, d],
        };
        save();
      },
      deleteDoc: async (bookId, id) => {
        state = { ...state, deskDocs: state.deskDocs.filter((d) => d.id !== id) };
        save();
      },
    },
    archive: {
      marks: async () => {
        const entries: ArchiveEntry[] = [];
        for (const h of state.highlights) {
          const book = state.books.find((b) => b.id === h.bookId);
          if (!book) continue;
          entries.push({
            id: h.id,
            kind: 'highlight',
            bookId: book.id,
            bookTitle: book.title,
            bookAuthors: book.authors,
            bookFormat: book.format,
            text: h.text,
            note: h.note,
            color: h.color,
            chapter: h.chapter,
            question: false,
            deskKind: null,
            deskTitle: null,
            deskBody: null,
            sourceRefs: [],
            anchor: h.anchor,
            createdAt: h.createdAt,
            updatedAt: h.updatedAt,
          });
        }
        for (const b of state.bookmarks) {
          const book = state.books.find((x) => x.id === b.bookId);
          if (!book) continue;
          entries.push({
            id: b.id,
            kind: 'bookmark',
            bookId: book.id,
            bookTitle: book.title,
            bookAuthors: book.authors,
            bookFormat: book.format,
            text: b.label ?? b.chapter ?? 'bookmark',
            note: null,
            color: null,
            chapter: b.chapter,
            question: false,
            deskKind: null,
            deskTitle: null,
            deskBody: null,
            sourceRefs: [],
            anchor: b.anchor,
            createdAt: b.createdAt,
            updatedAt: b.createdAt,
          });
        }
        /* L11 — the mind's own work: margin notes (questions flagged) + documents */
        for (const n of state.notes) {
          const book = state.books.find((x) => x.id === n.bookId);
          if (!book) continue;
          entries.push({
            id: n.id,
            kind: 'note',
            bookId: book.id,
            bookTitle: book.title,
            bookAuthors: book.authors,
            bookFormat: book.format,
            text: n.body,
            note: null,
            color: null,
            chapter: n.chapter,
            question: n.question ?? false,
            deskKind: null,
            deskTitle: null,
            deskBody: null,
            sourceRefs: [],
            anchor: n.anchor,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          });
        }
        for (const d of state.deskDocs) {
          const book = state.books.find((x) => x.id === d.bookId);
          if (!book) continue;
          const latestRef = d.sourceRefs.length > 0 ? d.sourceRefs[d.sourceRefs.length - 1] : null;
          entries.push({
            id: d.id,
            kind: 'deskdoc',
            bookId: book.id,
            bookTitle: book.title,
            bookAuthors: book.authors,
            bookFormat: book.format,
            text: d.title || d.body.slice(0, 80) || 'untitled document',
            note: null,
            color: null,
            chapter: latestRef?.chapter ?? null,
            question: false,
            deskKind: d.kind,
            deskTitle: d.title || null,
            deskBody: d.body.slice(0, 400),
            sourceRefs: d.sourceRefs,
            anchor: {
              format: book.format,
              primary: latestRef?.locator ?? `deskdoc:${d.id}`,
              textRange: null,
              position: null,
            },
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          });
        }
        entries.sort((a, b) => b.updatedAt - a.updatedAt);
        return entries;
      },
    },
    collections: {
      list: async () => state.collections,
      create: async (name) => {
        const c: Collection = { id: uid(), name, description: null, createdAt: Date.now() };
        state = { ...state, collections: [...state.collections, { collection: c, count: 0 }] };
        save();
        return c;
      },
      remove: async (id) => {
        state = { ...state, collections: state.collections.filter((c) => c.collection.id !== id) };
        save();
      },
      rename: async (id, name) => {
        state = {
          ...state,
          collections: state.collections.map((c) =>
            c.collection.id === id ? { collection: { ...c.collection, name }, count: c.count } : c,
          ),
        };
        save();
      },
      assign: async () => undefined,
      unassign: async () => undefined,
      books: async () => [],
    },
    search: {
      query: async (q) => {
        const ql = q.toLowerCase();
        const hits: SearchHit[] = [];
        for (const b of state.books) {
          if (b.title.toLowerCase().includes(ql) || b.authors.join(' ').toLowerCase().includes(ql)) {
            hits.push({ kind: 'book', id: b.id, title: b.title, context: b.authors.join(', ') || null, bookId: b.id, locator: null, highlightId: null });
          }
        }
        for (const h of state.highlights) {
          if (h.text.toLowerCase().includes(ql) || (h.note ?? '').toLowerCase().includes(ql)) {
            hits.push({ kind: 'highlight', id: h.id, title: h.text.slice(0, 80), context: h.note ?? h.chapter, bookId: h.bookId, locator: h.anchor.primary, highlightId: h.id });
          }
        }
        for (const n of state.notes) {
          if (n.body.toLowerCase().includes(ql)) {
            hits.push({ kind: 'note', id: n.id, title: n.body.slice(0, 80), context: n.chapter, bookId: n.bookId, locator: n.anchor.primary, highlightId: null });
          }
        }
        for (const d of state.deskDocs) {
          if (d.title.toLowerCase().includes(ql) || d.body.toLowerCase().includes(ql)) {
            hits.push({ kind: 'deskdoc', id: d.id, title: (d.title || d.body).slice(0, 80), context: d.body.slice(0, 120) || null, bookId: d.bookId, locator: null, highlightId: null });
          }
        }
        return hits;
      },
    },
    settings: {
      get: async () => state.settings,
      set: async (s) => {
        state = { ...state, settings: s };
        save();
      },
      pickBooksDir: async () => null,
    },
    exportNotes: {
      save: async () => null,
    },
    dev: {
      rebuildIndex: async () => ({
        books: state.books.length,
        highlights: state.highlights.length,
        bookmarks: 0,
      }),
      reconcile: async () => null,
    },
    recovery: {
      note: async () => null,
    },
    diagnostics: {
      report: async () => ({
        appVersion: 'web',
        platform: 'web',
        generatedAt: Date.now(),
        schemaVersion: null,
        library: { books: state.books.length, highlights: state.highlights.length },
        lastReconciliation: null,
        eventCounts: {},
        events: [],
      }),
      export: async () => null,
    },
  };
  return mock;
}

/** web-only extra: file-object import for the browser dev loop */
const maybeImport = (api as { importFiles?: (files: File[]) => ImportResult[] }).importFiles;
export const webExtras: { importFiles: (files: File[]) => ImportResult[] } | null = maybeImport
  ? { importFiles: maybeImport }
  : null;
