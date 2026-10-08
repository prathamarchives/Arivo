/**
 * the preload — the ONLY bridge. contextIsolation on, nodeIntegration off.
 * the renderer gets a typed api and nothing else. main resolves with typed
 * error envelopes; unwrap here so codes survive into the renderer.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { unwrapEnvelope, type ArivoApi, type AppSettings, type Bookmark, type Highlight, type ImportResult, type SearchHit, type ReconciliationReport, type DiagnosticsReport, type SessionStats } from '@arivo/core';
import type { BookWithProgress, Collection } from '@arivo/core';

const invoke = async <T>(name: string, arg?: unknown): Promise<T> =>
  unwrapEnvelope<T>(await ipcRenderer.invoke(`arivo:${name}`, arg));

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
    setTags: (id, tags) => invoke<void>('book:set-tags', { id, tags }),
  },
  progress: {
    save: (bookId, progress) => invoke<void>('progress:save', { bookId, progress }),
  },
  sessions: {
    begin: (bookId, startPercent) => invoke<string>('session:begin', { bookId, startPercent }),
    end: (sessionId, endPercent) => invoke<void>('session:end', { sessionId, endPercent }),
    stats: () => invoke<SessionStats>('sessions:stats'),
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
    rename: (id, name) => invoke<void>('collections:rename', { id, name }),
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
    pickBooksDir: () => invoke<string | null>('settings:pick-dir'),
  },
  exportNotes: {
    save: (bookId) => invoke<string | null>('export:save-notes', bookId),
  },
  dev: {
    rebuildIndex: () => invoke<{ books: number; highlights: number; bookmarks: number }>('dev:rebuild-index'),
    reconcile: () => invoke<ReconciliationReport | null>('dev:reconcile'),
  },
  recovery: {
    note: () => invoke<string | null>('recovery:note'),
  },
  diagnostics: {
    report: () => invoke<DiagnosticsReport>('diagnostics:report'),
    export: () => invoke<string | null>('diagnostics:export'),
  },
};

contextBridge.exposeInMainWorld('arivo', {
  ...api,
  // drag-and-drop needs the real path — webUtils only, from preload
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
});

export type { ArivoApi };
