/**
 * THE IPC SURFACE — a security boundary, not a convenience.
 * every channel validates its payload with a runtime schema BEFORE it
 * touches a service; every failure returns a typed, serializable error
 * envelope. no raw filesystem paths become write destinations here.
 */
import { ipcMain } from 'electron';
import type { Services } from './services/index.ts';
import {
  serializeError,
  type Validator,
  type IpcEnvelope,
} from '@arivo/core';
import { schemas } from './ipc-schemas.ts';

const ch = (name: string) => `arivo:${name}`;

const ok = <T>(value: T): IpcEnvelope<T> => ({ ok: true, value });
const fail = (err: unknown): IpcEnvelope<never> => ({ ok: false, error: serializeError(err) });

export function registerIpc(getServices: () => Services): void {
  const s = () => getServices();

  /** no-arg handler: catch → typed envelope */
  const handle = <T>(name: string, fn: () => T | Promise<T>): void => {
    ipcMain.handle(ch(name), async () => {
      try {
        return ok(await fn());
      } catch (err) {
        return fail(err);
      }
    });
  };

  /** validated-arg handler: schema first, service second, envelope always */
  const handleArg = <A, T>(
    name: string,
    schema: Validator<A>,
    fn: (a: A) => T | Promise<T>,
  ): void => {
    ipcMain.handle(ch(name), async (_e, arg) => {
      try {
        const validated = schema(arg);
        return ok(await fn(validated));
      } catch (err) {
        return fail(err);
      }
    });
  };

  handle('library:list', () => s().store.listBooks());
  handle('library:pick-import', () => {
    const paths = s().pickFiles();
    return s().importPaths(paths);
  });
  handleArg('library:import', schemas.importPaths, (paths) => s().importPaths(paths as string[]));
  handleArg('library:remove', schemas.remove, ({ id: bookId, deleteFiles }) =>
    s().removeBook(bookId, deleteFiles),
  );

  handleArg('book:get', schemas.bookGet, (bookId) => s().store.getBook(bookId));

  handleArg('progress:save', schemas.progressSave, ({ bookId, progress }) =>
    s().store.saveProgress(bookId, progress as import('@arivo/core').ReadingProgress),
  );

  handleArg('session:begin', schemas.sessionBegin, ({ bookId, startPercent }) =>
    s().store.beginSession(bookId, startPercent),
  );
  handleArg('session:end', schemas.sessionEnd, ({ sessionId, endPercent }) =>
    s().store.endSession(sessionId, endPercent),
  );

  handleArg('annotations:list', schemas.annotationsList, (bookId) => ({
    highlights: s().store.listHighlights(bookId),
    bookmarks: s().store.listBookmarks(bookId),
  }));
  handleArg('highlight:create', schemas.highlightCreate, ({ bookId, h }) =>
    s().store.createHighlight(bookId, h as import('@arivo/core').Highlight),
  );
  handleArg('highlight:update', schemas.highlightUpdate, ({ bookId, h }) =>
    s().store.updateHighlight(bookId, h as import('@arivo/core').Highlight),
  );
  handleArg('highlight:delete', schemas.highlightDelete, ({ bookId, id: hid }) =>
    s().store.deleteHighlight(bookId, hid),
  );
  handleArg('bookmark:create', schemas.bookmarkCreate, ({ bookId, b }) =>
    s().store.createBookmark(bookId, b as import('@arivo/core').Bookmark),
  );
  handleArg('bookmark:delete', schemas.bookmarkDelete, ({ bookId, id: bid }) =>
    s().store.deleteBookmark(bookId, bid),
  );

  handle('collections:list', () => s().store.listCollections());
  handleArg('collections:create', schemas.collectionsCreate, ({ name, description }) =>
    s().store.createCollection(name, description),
  );
  handleArg('collections:remove', schemas.collectionsRemove, (collectionId) =>
    s().store.deleteCollection(collectionId),
  );
  handleArg('collections:assign', schemas.collectionsAssign, ({ collectionId, bookId }) =>
    s().store.assignToCollection(collectionId, bookId),
  );
  handleArg('collections:unassign', schemas.collectionsUnassign, ({ collectionId, bookId }) =>
    s().store.removeFromCollection(collectionId, bookId),
  );
  handleArg('collections:books', schemas.collectionsBooks, (collectionId) =>
    s().store.listCollectionBooks(collectionId),
  );

  handleArg('search:query', schemas.searchQuery, (q) => s().store.search(q));

  handle('settings:get', () => s().getSettings());
  handleArg('settings:set', schemas.settingsSet, (next) =>
    s().setSettings(next as unknown as import('@arivo/core').AppSettings),
  );

  handleArg('export:save-notes', schemas.exportNotes, (bookId) => s().saveNotes(bookId));

  handle('dev:rebuild-index', () => s().rebuildIndex());
  handle('dev:reconcile', () => s().reconcile());
  handle('recovery:note', () => s().startupNote());
}
