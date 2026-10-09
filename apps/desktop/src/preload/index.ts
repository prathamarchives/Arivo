/**
 * the preload — the ONLY bridge. contextIsolation on, nodeIntegration off.
 * the renderer gets a typed api and nothing else. main resolves with typed
 * error envelopes; unwrap here so codes survive into the renderer.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { unwrapEnvelope, type ArivoApi, type AppSettings, type AnnotationLink, type ArchiveEntry, type Bookmark, type DeskDoc, type Highlight, type Note, type ImportResult, type NotebookPage, type SearchHit, type ReconciliationReport, type DiagnosticsReport, type SessionStats, type Sketch, type StickyNote } from '@arivo/core';
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
    list: (bookId) =>
      invoke<{
        highlights: Highlight[];
        bookmarks: Bookmark[];
        notes: Note[];
        stickies: StickyNote[];
        sketches: Sketch[];
      }>('annotations:list', bookId),
    createHighlight: (bookId, h) => invoke<void>('highlight:create', { bookId, h }),
    updateHighlight: (bookId, h) => invoke<void>('highlight:update', { bookId, h }),
    deleteHighlight: (bookId, id) => invoke<void>('highlight:delete', { bookId, id }),
    createBookmark: (bookId, b) => invoke<void>('bookmark:create', { bookId, b }),
    deleteBookmark: (bookId, id) => invoke<void>('bookmark:delete', { bookId, id }),
    createNote: (bookId, n) => invoke<void>('note:create', { bookId, n }),
    updateNote: (bookId, n) => invoke<void>('note:update', { bookId, n }),
    deleteNote: (bookId, id) => invoke<void>('note:delete', { bookId, id }),
    createSticky: (bookId, s) => invoke<void>('sticky:create', { bookId, s }),
    updateSticky: (bookId, s) => invoke<void>('sticky:update', { bookId, s }),
    deleteSticky: (bookId, id) => invoke<void>('sticky:delete', { bookId, id }),
    saveSketch: (bookId, s) => invoke<void>('sketch:save', { bookId, s }),
    deleteSketch: (bookId, id) => invoke<void>('sketch:delete', { bookId, id }),
  },
  desk: {
    listDocs: (bookId) => invoke<DeskDoc[]>('desk:listDocs', { bookId }),
    createDoc: (bookId, d) => invoke<void>('desk:createDoc', { bookId, d }),
    updateDoc: (bookId, d) => invoke<void>('desk:updateDoc', { bookId, d }),
    deleteDoc: (bookId, id) => invoke<void>('desk:deleteDoc', { bookId, id }),
  },
  archive: {
    marks: () => invoke<ArchiveEntry[]>('archive:marks'),
  },
  notebook: {
    /** the book of you: write-in pages, links, where you left off */
    get: () => invoke<{ pages: NotebookPage[]; links: AnnotationLink[]; state: { currentPage: number } }>('notebook:get'),
    savePage: (p) => invoke<void>('notebook:savePage', { p }),
    deletePage: (id) => invoke<void>('notebook:deletePage', { id }),
    saveLink: (l) => invoke<void>('notebook:saveLink', { l }),
    deleteLink: (id) => invoke<void>('notebook:deleteLink', { id }),
    setPage: (currentPage) => invoke<void>('notebook:setPage', { currentPage }),
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
