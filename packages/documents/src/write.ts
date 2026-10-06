/** writing the book folder: the library is human-browsable, deletion is unambiguous.
 * every file lands atomically — a crash mid-import leaves no partial truth. */
import { copyFile, mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFileSyncAtomic } from '@arivo/persistence';
import type { BookFolderMeta } from '@arivo/core';
import type { InspectedFile } from './inspect.ts';

export type BookFolderRecord = BookFolderMeta;

/**
 * the folder shape (the library IS the truth):
 *   {book-id}/book.epub | book.pdf
 *   {book-id}/cover.jpg
 *   {book-id}/metadata.json
 *   {book-id}/annotations.json
 */
export async function writeBookFolder(
  bookDir: string,
  sourcePath: string,
  inspected: InspectedFile,
  bookId: string,
): Promise<BookFolderRecord> {
  await mkdir(bookDir, { recursive: true });

  const dest = join(bookDir, inspected.fileName);
  await copyFile(sourcePath, dest);

  let coverPath: string | null = null;
  if (inspected.cover) {
    coverPath = 'cover.jpg';
    writeFileSyncAtomic(join(bookDir, 'cover.jpg'), new Uint8Array(inspected.cover));
  }

  const fileStat = await stat(dest);
  const record: BookFolderRecord = {
    id: bookId,
    title: inspected.title,
    subtitle: inspected.subtitle,
    authors: inspected.authors,
    description: inspected.description,
    language: inspected.language,
    publisher: inspected.publisher,
    publishedYear: inspected.publishedYear,
    coverPath,
    format: inspected.format,
    hash: inspected.hash,
    fileName: inspected.fileName,
    fileSize: inspected.fileSize,
    tags: [],
    addedAt: Date.now(),
    updatedAt: Date.now(),
    fileMtime: fileStat.mtimeMs,
  };

  writeFileSyncAtomic(join(bookDir, 'metadata.json'), JSON.stringify(record, null, 2));
  writeFileSyncAtomic(
    join(bookDir, 'annotations.json'),
    JSON.stringify({ version: 1, bookId, progress: null, highlights: [], bookmarks: [] }, null, 2),
  );

  return record;
}

/**
 * the staging commit — THE crash-safe import boundary.
 * prepare the folder under {library}/.staging/{bookId}/, then this renames
 * it into place: one atomic rename on the same filesystem. a crash before
 * the rename leaves only staging (swept at next startup); after it, the
 * book exists completely.
 */
export async function commitBookFolder(stagingDir: string, bookDir: string): Promise<void> {
  await rename(stagingDir, bookDir);
}
