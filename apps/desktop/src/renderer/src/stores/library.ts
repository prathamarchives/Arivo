import { create } from 'zustand';
import type { Collection, ImportResult } from '@arivo/core';
import type { BookWithProgress } from '@arivo/core';
import { api, platform, getPathForFile, webExtras } from '../services/api.ts';

export type SortMode = 'recent' | 'title' | 'author' | 'progress';

interface LibraryState {
  books: BookWithProgress[];
  collections: { collection: Collection; count: number }[];
  query: string;
  activeCollection: string | null;
  /** the tag the library is filtered to (null = no filter) */
  activeTag: string | null;
  sort: SortMode;
  loading: boolean;
  refresh: () => Promise<void>;
  importDialog: () => Promise<ImportResult[]>;
  importDropped: (files: File[]) => Promise<ImportResult[]>;
  removeBook: (id: string, deleteFiles: boolean) => Promise<void>;
  createCollection: (name: string) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  assign: (collectionId: string, bookId: string) => Promise<void>;
  unassign: (collectionId: string, bookId: string) => Promise<void>;
  setBookTags: (bookId: string, tags: string[]) => Promise<void>;
  setQuery: (q: string) => void;
  setSort: (s: SortMode) => void;
  setActiveCollection: (id: string | null) => void;
  setActiveTag: (tag: string | null) => void;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  books: [],
  collections: [],
  query: '',
  activeCollection: null,
  activeTag: null,
  sort: 'recent',
  loading: false,

  refresh: async () => {
    set({ loading: true });
    const [books, collections] = await Promise.all([
      api.library.list(),
      api.collections.list(),
    ]);
    set({ books, collections, loading: false });
  },

  importDialog: async () => {
    const results = await api.library.pickAndImport();
    await get().refresh();
    return results;
  },

  importDropped: async (files) => {
    if (platform === 'electron') {
      const paths = files.map((f) => getPathForFile(f)).filter((p): p is string => !!p);
      if (paths.length === 0) return [];
      const results = await api.library.importPaths(paths);
      await get().refresh();
      return results;
    }
    if (!webExtras) return [];
    const results = webExtras.importFiles(files);
    await get().refresh();
    return results;
  },

  removeBook: async (id, deleteFiles) => {
    await api.library.remove(id, deleteFiles);
    await get().refresh();
  },

  createCollection: async (name) => {
    await api.collections.create(name, null);
    await get().refresh();
  },

  renameCollection: async (id, name) => {
    await api.collections.rename(id, name);
    await get().refresh();
  },

  removeCollection: async (id) => {
    await api.collections.remove(id);
    set({ activeCollection: null });
    await get().refresh();
  },

  assign: async (collectionId, bookId) => {
    await api.collections.assign(collectionId, bookId);
    await get().refresh();
  },

  unassign: async (collectionId, bookId) => {
    await api.collections.unassign(collectionId, bookId);
    await get().refresh();
  },

  setBookTags: async (bookId, tags) => {
    await api.book.setTags(bookId, tags);
    await get().refresh();
  },

  setQuery: (q) => set({ query: q }),
  setSort: (s) => set({ sort: s }),
  setActiveCollection: (id) => set({ activeCollection: id }),
  setActiveTag: (tag) => set({ activeTag: tag }),
}));
