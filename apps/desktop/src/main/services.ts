/** the services — where the store meets the app lifecycle. */
import { app, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { ArivoStore, openDb, readSettings, writeSettings } from '@arivo/database';
import { inspectFile, writeBookFolder, ImportError } from '@arivo/documents';
import { uuidv7, ArivoError, DEFAULT_SETTINGS, type AppSettings, type ImportResult } from '@arivo/core';

export interface Services {
  store: ArivoStore;
  libraryRoot(): string;
  libraryFile(id: string, cover: boolean): string | null;
  importPaths(paths: string[]): Promise<ImportResult[]>;
  pickFiles(): string[];
  removeBook(id: string, deleteFiles: boolean): void;
  saveNotes(bookId: string): string | null;
  getSettings(): AppSettings;
  setSettings(s: AppSettings): void;
  rebuildIndex(): { books: number; highlights: number; bookmarks: number };
  autoSeed(seedDir: string): Promise<void>;
}

export function createServices(): Services {
  const homeArivo = path.join(app.getPath('home'), 'Arivo');
  fs.mkdirSync(homeArivo, { recursive: true });

  const settingsDir = path.join(homeArivo, 'config');
  let settings = readSettings(settingsDir, {
    ...DEFAULT_SETTINGS,
  }) as unknown as AppSettings;

  let root = settings.booksDir ?? homeArivo;
  fs.mkdirSync(path.join(root, 'library'), { recursive: true });

  // the index lives in app data — never inside the synced library folder
  const dbPath = path.join(app.getPath('userData'), 'index.db');

  /** corruption at open is recovered, never fatal: backup → fresh → rebuild */
  function openStoreWithRecovery(): { store: ArivoStore; recovered: boolean; note?: string } {
    try {
      return { store: new ArivoStore(openDb(dbPath), root), recovered: false };
    } catch (err) {
      if (!(err instanceof ArivoError) || err.code !== 'DATABASE_CORRUPT') throw err;
      // move the damaged index aside (forensics, never silent loss)
      const backup = `${dbPath}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(dbPath, backup);
        for (const side of ['-wal', '-shm']) {
          if (fs.existsSync(`${dbPath}${side}`)) fs.renameSync(`${dbPath}${side}`, `${backup}${side}`);
        }
      } catch {
        /* the fresh db below will replace whatever remains */
      }
      const store = new ArivoStore(openDb(dbPath), root);
      const rebuilt = store.rebuildIndex();
      return {
        store,
        recovered: true,
        note: `index was damaged — rebuilt from your library: ${rebuilt.books} books, ${rebuilt.highlights} highlights, ${rebuilt.bookmarks} bookmarks, 0 truth records lost`,
      };
    }
  }

  const opened = openStoreWithRecovery();
  const store = opened.store;

  async function importOne(p: string): Promise<ImportResult> {
    try {
      const inspected = await inspectFile(p);
      if (store.findByHash(inspected.hash)) {
        return { ok: false, bookId: null, title: inspected.title, reason: 'already in library' };
      }
      const bookId = uuidv7();
      const bookDir = path.join(root, 'library', bookId);
      const record = await writeBookFolder(bookDir, p, inspected, bookId);
      store.indexBook(record);
      return { ok: true, bookId, title: inspected.title, reason: null };
    } catch (err) {
      return {
        ok: false,
        bookId: null,
        title: path.basename(p),
        reason: err instanceof ImportError ? err.message : 'import failed',
      };
    }
  }

  return {
    store,
    libraryRoot: () => root,
    libraryFile(id, cover) {
      try {
        const dir = path.join(root, 'library', id);
        if (cover) {
          const coverPath = path.join(dir, 'cover.jpg');
          return fs.existsSync(coverPath) ? coverPath : null;
        }
        const meta = path.join(dir, 'metadata.json');
        if (!fs.existsSync(meta)) return null;
        const rec = JSON.parse(fs.readFileSync(meta, 'utf-8')) as { fileName: string };
        const file = path.join(dir, rec.fileName);
        return fs.existsSync(file) ? file : null;
      } catch {
        return null;
      }
    },
    async importPaths(paths) {
      const results: ImportResult[] = [];
      for (const p of paths) {
        results.push(await importOne(p));
      }
      return results;
    },
    pickFiles() {
      const picked = dialog.showOpenDialogSync({
        title: 'Import books',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Books', extensions: ['epub', 'pdf'] }],
      });
      return picked ?? [];
    },
    removeBook(id, deleteFiles) {
      store.removeBook(id, deleteFiles);
    },
    saveNotes(bookId) {
      const md = store.exportNotes(bookId);
      if (!md) return null;
      const book = store.getBook(bookId);
      const safe = (book?.title ?? 'reading notes').replace(/[\\/:*?"<>|]/g, '_');
      const target = dialog.showSaveDialogSync({
        title: 'Export reading notes',
        defaultPath: `${safe} — reading notes.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!target) return null;
      fs.writeFileSync(target, md, 'utf-8');
      return target;
    },
    getSettings: () => settings,
    setSettings(s) {
      settings = s;
      writeSettings(settingsDir, s as unknown as Record<string, unknown>);
      if (s.booksDir && s.booksDir !== root) {
        root = s.booksDir;
        fs.mkdirSync(path.join(root, 'library'), { recursive: true });
      }
    },
    rebuildIndex: () => store.rebuildIndex(),
    async autoSeed(seedDir) {
      try {
        const books = store.listBooks();
        if (books.length > 0) return;
        if (!fs.existsSync(seedDir)) return;
        const files = fs
          .readdirSync(seedDir)
          .filter((f) => f.toLowerCase().endsWith('.epub') || f.toLowerCase().endsWith('.pdf'))
          .map((f) => path.join(seedDir, f));
        for (const file of files) {
          await importOne(file);
        }
      } catch {
        /* seeding is best-effort, never fatal */
      }
    },
  };
}
