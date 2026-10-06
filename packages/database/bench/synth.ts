/**
 * the synthetic library generator — N unique books, H highlights each.
 * books are SMALL on purpose: the benchmark measures the engine's overhead
 * (scan, index, fts, rebuild), not disk bandwidth.
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export interface SynthOptions {
  books: number;
  highlightsPerBook: number;
  root: string;
}

export function generateSyntheticLibrary({ books, highlightsPerBook, root }: SynthOptions): {
  libraryDir: string;
  totalHighlights: number;
} {
  const libraryDir = join(root, 'library');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(libraryDir, { recursive: true });

  const titles = [
    'The Burnout Society',
    'Profound Boredom',
    'The Vanity of the Hour',
    'Notes on a Quiet Life',
    'The Achievement Subject',
    'A Grammar of Rest',
    'Meditations on Attention',
    'The Pace of Machines',
    'On Doing Nothing',
    'The Leisure Imperative',
  ];
  const authors = ['Byung-Chul Han', 'Anne Yesterday', 'Josef Pieper', 'Mara Sundial', 'Ivo Ceruse'];

  let totalHighlights = 0;
  for (let i = 0; i < books; i++) {
    const id = `bk-${i.toString().padStart(6, '0')}`;
    const dir = join(libraryDir, id);
    mkdirSync(dir, { recursive: true });
    const unique = `content-${id}-${i * 7919}`;
    const bytes = Buffer.from(`${'book-bytes'.repeat(40)}-${unique}`);
    const hash = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(join(dir, 'book.epub'), bytes);
    const highlights = Array.from({ length: highlightsPerBook }, (_, h) => ({
      id: `${id}-hl-${h}`,
      bookId: id,
      anchor: {
        format: 'epub',
        primary: `epubcfi(/6/${(h % 12) + 2}!/4/2,/1:${h * 10},/1:${h * 10 + 40})`,
        textRange: {
          exact: `highlight ${h} of the quiet chapter ${i % 20}`,
          prefix: 'the sentence before the annotation ',
          suffix: ' and the sentence that followed it',
        },
        position: { spineIndex: h % 12, percent: (h % 100) / 100 },
      },
      color: ['yellow', 'blue', 'green', 'pink', 'gray'][h % 5] as string,
      text: `highlight ${h} of the quiet chapter ${i % 20}`,
      chapter: `Chapter ${(i % 20) + 1}`,
      note: h % 3 === 0 ? `a margin note about attention ${h}` : null,
      status: 'resolved',
      createdAt: 1_000_000 + i * 100 + h,
      updatedAt: 1_000_000 + i * 100 + h,
    }));
    totalHighlights += highlights.length;
    writeFileSync(
      join(dir, 'metadata.json'),
      JSON.stringify(
        {
          id,
          title: `${titles[i % titles.length]}, vol. ${Math.floor(i / titles.length) + 1}`,
          subtitle: null,
          authors: [authors[i % authors.length]],
          description: 'a synthetic book for benchmarking the engine, not for reading',
          language: 'en',
          publisher: 'Arivo Bench Press',
          publishedYear: String(1990 + (i % 30)),
          coverPath: null,
          format: 'epub',
          hash,
          fileName: 'book.epub',
          fileSize: bytes.length,
          tags: [],
          addedAt: 1_700_000_000_000 + i * 1000,
          updatedAt: 1_700_000_000_000 + i * 1000,
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(dir, 'annotations.json'),
      JSON.stringify(
        { version: 1, bookId: id, progress: null, highlights, bookmarks: [] },
        null,
        2,
      ),
    );
  }
  return { libraryDir, totalHighlights };
}
