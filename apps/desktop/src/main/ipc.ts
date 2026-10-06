/** the ipc surface — every channel, one file, typed both ways. */
import { ipcMain } from 'electron';
import type { Services } from './services.ts';
import type {
  AppSettings,
  Bookmark,
  Highlight,
  ImportResult,
  ReadingProgress,
  SearchHit,
} from '@arivo/core';
import type { BookWithProgress } from '@arivo/core';

const ch = (name: string) => `arivo:${name}`;

export function registerIpc(getServices: () => Services): void {
  const s = () => getServices();

  const handle = <T>(name: string, fn: () => T | Promise<T>): void => {
    ipcMain.handle(ch(name), () => fn());
  };
  const handleArg = <A, T>(name: string, fn: (a: A) => T | Promise<T>): void => {
    ipcMain.handle(ch(name), (_e, a: A) => fn(a));
  };

  handle('library:list', () => s().store.listBooks());
  handle('library:pick-import', () => {
    const paths = s().pickFiles();
    return s().importPaths(paths);
  });
  handleArg<string[], ImportResult[]>('library:import', (paths) => s().importPaths(paths));
  handleArg<{ id: string; deleteFiles: boolean }, void>('library:remove', ({ id, deleteFiles }) =>
    s().removeBook(id, deleteFiles),
  );

  handleArg<string, BookWithProgress | null>('book:get', (id) => s().store.getBook(id));

  handleArg<{ bookId: string; progress: ReadingProgress }, void>('progress:save', ({ bookId, progress }) =>
    s().store.saveProgress(bookId, progress),
  );

  handleArg<{ bookId: string; startPercent: number }, string>('session:begin', ({ bookId, startPercent }) =>
    s().store.beginSession(bookId, startPercent),
  );
  handleArg<{ sessionId: string; endPercent: number }, void>('session:end', ({ sessionId, endPercent }) =>
    s().store.endSession(sessionId, endPercent),
  );

  handleArg<string, { highlights: Highlight[]; bookmarks: Bookmark[] }>('annotations:list', (bookId) => ({
    highlights: s().store.listHighlights(bookId),
    bookmarks: s().store.listBookmarks(bookId),
  }));
  handleArg<{ bookId: string; h: Highlight }, void>('highlight:create', ({ bookId, h }) =>
    s().store.createHighlight(bookId, h),
  );
  handleArg<{ bookId: string; h: Highlight }, void>('highlight:update', ({ bookId, h }) =>
    s().store.updateHighlight(bookId, h),
  );
  handleArg<{ bookId: string; id: string }, void>('highlight:delete', ({ bookId, id }) =>
    s().store.deleteHighlight(bookId, id),
  );
  handleArg<{ bookId: string; b: Bookmark }, void>('bookmark:create', ({ bookId, b }) =>
    s().store.createBookmark(bookId, b),
  );
  handleArg<{ bookId: string; id: string }, void>('bookmark:delete', ({ bookId, id }) =>
    s().store.deleteBookmark(bookId, id),
  );

  handle('collections:list', () => s().store.listCollections());
  handleArg<{ name: string; description: string | null }, ReturnType<Services['store']['createCollection']>>(
    'collections:create',
    ({ name, description }) => s().store.createCollection(name, description),
  );
  handleArg<string, void>('collections:remove', (id) => s().store.deleteCollection(id));
  handleArg<{ collectionId: string; bookId: string }, void>('collections:assign', ({ collectionId, bookId }) =>
    s().store.assignToCollection(collectionId, bookId),
  );
  handleArg<{ collectionId: string; bookId: string }, void>('collections:unassign', ({ collectionId, bookId }) =>
    s().store.removeFromCollection(collectionId, bookId),
  );
  handleArg<string, string[]>('collections:books', (collectionId) =>
    s().store.listCollectionBooks(collectionId),
  );

  handleArg<string, SearchHit[]>('search:query', (q) => s().store.search(q));

  handle('settings:get', () => s().getSettings());
  handleArg<AppSettings, void>('settings:set', (settings) => s().setSettings(settings));

  handleArg<string, string | null>('export:save-notes', (bookId) => s().saveNotes(bookId));

  handle('dev:rebuild-index', () => s().rebuildIndex());
}
