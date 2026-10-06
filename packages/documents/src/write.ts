/** writing the book folder: the library is human-browsable, deletion is unambiguous. */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { InspectedFile } from './inspect.ts';

export interface BookFolderRecord {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  language: string | null;
  publisher: string | null;
  publishedYear: string | null;
  coverPath: string | null;
  format: 'epub' | 'pdf';
  hash: string;
  fileName: string;
  fileSize: number;
  tags: string[];
  addedAt?: number;
  updatedAt?: number;
}

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
    await writeFile(join(bookDir, 'cover.jpg'), inspected.cover);
  }

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
  };

  await writeFile(join(bookDir, 'metadata.json'), JSON.stringify(record, null, 2), 'utf-8');
  await writeFile(
    join(bookDir, 'annotations.json'),
    JSON.stringify({ version: 1, bookId, progress: null, highlights: [], bookmarks: [] }, null, 2),
    'utf-8',
  );

  return record;
}
