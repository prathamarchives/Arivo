/**
 * the preload — the ONLY bridge. contextIsolation on, nodeIntegration off.
 * the renderer gets a typed api and nothing else.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { ArivoApi, AppSettings, Bookmark, Highlight, ImportResult, SearchHit } from '@arivo/core';
import type { BookWithProgress, Collection } from '@arivo/core';

const invoke = <T>(name: string, arg?: unknown): Promise<T> => ipcRenderer.invoke(`arivo:${name}`, arg);

const api: ArivoApi = {
  platform: 'electron',
  library: {
    list: () => invoke<BookWithProgress[]>('library:list'),
    pickAndImport: () => invoke<ImportResult[]>('library:pick-import'),
    importPaths: (paths) => invoke<ImportResult[]>('library:import', paths),
    remove: (id, deleteFiles) => invoke<void>('library:remove', { id, deleteFiles }),
  },
  book: {
    openUrl: (id) => `arivo://book/${id}`,
    coverUrl: (id) => `arivo://cover/${id}`,
    get: (id) => invoke<BookWithProgress | null>('book:get', id),
  },
  progress: {
    save: (bookId, progress) => invoke<void>('progress:save', { bookId, progress }),
  },
  sessions: {
    begin: (bookId, startPercent) => invoke<string>('session:begin', { bookId, startPercent }),
    end: (sessionId, endPercent) => invoke<void>('session:end', { sessionId, endPercent }),
  },
  annotations: {
    list: (bookId) => invoke<{ highlights: Highlight[]; bookmarks: Bookmark[] }>('annotations:list', bookId),
    createHighlight: (bookId, h) => invoke<void>('highlight:create', { bookId, h }),
    updateHighlight: (bookId, h) => invoke<void>('highlight:update', { bookId, h }),
    deleteHighlight: (bookId, id) => invoke<void>('highlight:delete', { bookId, id }),
    createBookmark: (bookId, b) => invoke<void>('bookmark:create', { bookId, b }),
    deleteBookmark: (bookId, id) => invoke<void>('bookmark:delete', { bookId, id }),
  },
  collections: {
    list: () => invoke<{ collection: Collection; count: number }[]>('collections:list'),
    create: (name, description) => invoke<Collection>('collections:create', { name, description }),
    remove: (id) => invoke<void>('collections:remove', id),
    assign: (collectionId, bookId) => invoke<void>('collections:assign', { collectionId, bookId }),
    unassign: (collectionId, bookId) => invoke<void>('collections:unassign', { collectionId, bookId }),
    books: (collectionId) => invoke<string[]>('collections:books', collectionId),
  },
  search: {
    query: (q) => invoke<SearchHit[]>('search:query', q),
  },
  settings: {
    get: () => invoke<AppSettings>('settings:get'),
    set: (s) => invoke<void>('settings:set', s),
  },
  exportNotes: {
    save: (bookId) => invoke<string | null>('export:save-notes', bookId),
  },
  dev: {
    rebuildIndex: () => invoke<{ books: number; highlights: number; bookmarks: number }>('dev:rebuild-index'),
  },
};

contextBridge.exposeInMainWorld('arivo', {
  ...api,
  // drag-and-drop needs the real path — webUtils only, from preload
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
});

export type { ArivoApi };
