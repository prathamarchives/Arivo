/**
 * the composition root — every domain service owned in one place.
 * UI → ipc (validated) → these services → store/persistence. nothing else
 * in main touches the store directly.
 */
import { app, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { ArivoStore, readSettings, writeSettings } from '@arivo/database';
import {
  DEFAULT_SETTINGS,
  DiagnosticsRecorder,
  type AppSettings,
  type DiagnosticsReport,
  type ImportResult,
  type ReconciliationReport,
} from '@arivo/core';
import { validateLibraryRoot, ensureInside } from './paths.ts';
import { recoverAtStartup } from './recovery.ts';
import { createImportService } from './import.ts';

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
  reconcile(): ReconciliationReport | null;
  startupNote(): string | null;
  diagnostics(): DiagnosticsReport;
  exportDiagnostics(): string | null;
  autoSeed(seedDir: string): Promise<void>;
}

export function createServices(): Services {
  const homeArivo = path.join(app.getPath('home'), 'Arivo');
  fs.mkdirSync(homeArivo, { recursive: true });

  const settingsDir = path.join(homeArivo, 'config');
  let settings = readSettings(settingsDir, { ...DEFAULT_SETTINGS }) as unknown as AppSettings;

  let root = settings.booksDir ?? homeArivo;
  fs.mkdirSync(path.join(root, 'library'), { recursive: true });

  // the index lives in app data — never inside the synced library folder.
  // startup = open (corruption-recovering) + reconcile to a fixed point.
  const startup = recoverAtStartup(app.getPath('userData'), root);
  const store = startup.store;

  // observability: every significant outcome leaves structured evidence
  const diagnostics = new DiagnosticsRecorder();
  if (startup.dbRecovered) {
    diagnostics.record('database.rebuilt', 'warn', { note: startup.dbRecovered });
  }
  if (startup.reconciliation) {
    diagnostics.setReconciliation(startup.reconciliation);
  }
  diagnostics.setStats({
    appVersion: app.getVersion(),
    platform: `electron/${process.platform}-${process.arch}`,
    schemaVersion: null, // filled below from the live store
    library: { books: store.listBooks().length, highlights: 0 },
  });

  const imports = createImportService({
    store,
    libraryRoot: () => root,
    onResult: (result) => {
      diagnostics.record(
        result.ok ? 'book.import.completed' : 'book.import.failed',
        result.ok ? 'info' : 'warn',
        { title: result.title, reason: result.reason ?? undefined },
      );
    },
  });

  return {
    store,
    libraryRoot: () => root,
    libraryFile(id, cover) {
      try {
        const libDir = path.join(root, 'library');
        const dir = ensureInside(libDir, path.join(libDir, id), 'book folder');
        if (cover) {
          const coverPath = path.join(dir, 'cover.jpg');
          return fs.existsSync(coverPath) ? coverPath : null;
        }
        const meta = path.join(dir, 'metadata.json');
        if (!fs.existsSync(meta)) return null;
        const rec = JSON.parse(fs.readFileSync(meta, 'utf-8')) as { fileName: string };
        const file = ensureInside(dir, path.join(dir, rec.fileName), 'book file');
        return fs.existsSync(file) ? file : null;
      } catch {
        return null;
      }
    },
    importPaths: (paths) => imports.importPaths(paths),
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
      // the destination is main-side (dialog), never renderer-supplied
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
      // the library root is guarded: absolute, real, not a filesystem root
      if (s.booksDir !== null && s.booksDir !== root) {
        validateLibraryRoot(s.booksDir);
        fs.mkdirSync(path.join(s.booksDir, 'library'), { recursive: true });
      }
      settings = s;
      writeSettings(settingsDir, s as unknown as Record<string, unknown>);
      if (s.booksDir && s.booksDir !== root) {
        root = s.booksDir;
      }
    },
    rebuildIndex: () => store.rebuildIndex(),
    reconcile: () => startup.reconciliation,
    startupNote: () => startup.dbRecovered,
    diagnostics: () => diagnostics.export(),
    exportDiagnostics() {
      // the destination is main-side (dialog); the report is scrubbed by the
      // recorder's privacy rule — counts and statuses, never book text
      const report = JSON.stringify(diagnostics.export(), null, 2);
      const target = dialog.showSaveDialogSync({
        title: 'Export diagnostics report',
        defaultPath: `arivo-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!target) return null;
      fs.writeFileSync(target, report, 'utf-8');
      diagnostics.record('diagnostics.exported', 'info');
      return target;
    },
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
          await imports.importOne(file);
        }
      } catch {
        /* seeding is best-effort, never fatal */
      }
    },
  };
}
