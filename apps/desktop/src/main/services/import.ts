/**
 * the import workflow — THE CRASH-SAFE STATE MACHINE.
 *
 *   DISCOVERED → VALIDATING (shape + limits) → EXTRACTING (staging folder) →
 *   COMMITTING (one atomic rename into library/) → INDEXING → READY
 *
 * a crash before the rename leaves only staging (swept at next startup);
 * after it, the book exists completely and reconciliation finishes indexing.
 * the journal records what was in flight so recovery can explain itself.
 */
import path from 'node:path';
import fs from 'node:fs';
import { ArivoStore } from '@arivo/database';
import { inspectFile, writeBookFolder, commitBookFolder, ImportError } from '@arivo/documents';
import { MutationJournal } from '@arivo/persistence';
import { uuidv7, type ImportResult } from '@arivo/core';
import { validateImportSource } from './paths.ts';

export interface ImportDeps {
  store: ArivoStore;
  libraryRoot(): string;
}

export function createImportService({ store, libraryRoot }: ImportDeps) {
  const journal = new MutationJournal(libraryRoot());

  async function importOne(rawPath: string): Promise<ImportResult> {
    // DISCOVERED → VALIDATING
    let source: string;
    try {
      source = validateImportSource(rawPath);
    } catch (err) {
      return {
        ok: false,
        bookId: null,
        title: path.basename(rawPath),
        reason: err instanceof Error ? err.message : 'import failed',
      };
    }

    const bookId = uuidv7();
    const op = `import:${bookId}`;
    journal.begin(op, source);
    try {
      const inspected = await inspectFile(source); // typed rejection on bad input
      if (store.findByHash(inspected.hash)) {
        journal.commit(op);
        return { ok: false, bookId: null, title: inspected.title, reason: 'already in library' };
      }

      // EXTRACTING: the complete folder, written under arivo's scratch
      const stagingDir = path.join(libraryRoot(), 'library', '.staging', bookId);
      fs.rmSync(stagingDir, { recursive: true, force: true });
      const record = await writeBookFolder(stagingDir, source, inspected, bookId);

      // COMMITTING: one atomic rename — the book appears complete or not at all
      const bookDir = path.join(libraryRoot(), 'library', bookId);
      await commitBookFolder(stagingDir, bookDir);

      // INDEXING: the row appears only after the folder is committed
      store.indexBook(record);
      journal.commit(op);
      return { ok: true, bookId, title: inspected.title, reason: null };
    } catch (err) {
      // any failure leaves the library exactly as it was
      journal.commit(op); // the attempt is OVER (swept); truth never landed
      const reason =
        err instanceof ImportError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'import failed';
      return { ok: false, bookId: null, title: path.basename(source), reason };
    }
  }

  return {
    async importPaths(paths: string[]): Promise<ImportResult[]> {
      const results: ImportResult[] = [];
      for (const p of paths) {
        results.push(await importOne(p));
      }
      return results;
    },
    importOne,
  };
}

export type ImportService = ReturnType<typeof createImportService>;
