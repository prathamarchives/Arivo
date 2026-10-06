import { describe, it, expect } from 'vitest';
import { exportReadingNotes } from './export.ts';
import type { Book, Highlight, Bookmark, ReadingProgress } from './types.ts';

const book: Book = {
  id: 'b1',
  title: 'The Burnout Society',
  subtitle: null,
  authors: ['Byung-Chul Han'],
  description: null,
  language: 'en',
  publisher: null,
  publishedYear: '2010',
  coverPath: 'cover.jpg',
  format: 'epub',
  hash: 'x',
  fileName: 'book.epub',
  fileSize: 100,
  addedAt: 0,
  updatedAt: 0,
  tags: [],
};

describe('exportReadingNotes', () => {
  it('renders a complete, portable markdown document', () => {
    const progress: ReadingProgress = {
      bookId: 'b1',
      locator: 'epubcfi(/6/4)',
      percent: 0.42,
      chapter: 'Profound Boredom',
      startedAt: null,
      lastReadAt: 0,
      completedAt: false,
    };
    const highlights: Highlight[] = [
      {
        id: 'h1',
        bookId: 'b1',
        anchor: { format: 'epub', primary: 'epubcfi(/6/4!/4/10,/1:0,/1:20)', textRange: null, position: null },
        color: 'yellow',
        text: 'The animal laborans leaves a world of scarcity behind and enters a world of excess.',
        chapter: 'Neuronal Power',
        note: 'the key contrast to homo faber',
        status: 'resolved',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'h2',
        bookId: 'b1',
        anchor: { format: 'epub', primary: 'epubcfi(/6/6!/4/2,/1:0,/1:12)', textRange: null, position: null },
        color: 'blue',
        text: 'Multitasking is not progress.',
        chapter: 'Profound Boredom',
        note: null,
        status: 'orphaned',
        createdAt: 2,
        updatedAt: 2,
      },
    ];
    const bookmarks: Bookmark[] = [
      {
        id: 'k1',
        bookId: 'b1',
        anchor: { format: 'epub', primary: 'epubcfi(/6/8)', textRange: null, position: null },
        label: null,
        chapter: 'The Pedagogy of Seeing',
        createdAt: 3,
      },
    ];

    const md = exportReadingNotes(book, highlights, bookmarks, progress);
    expect(md).toContain('# The Burnout Society — Byung-Chul Han');
    expect(md).toContain('## highlights');
    expect(md).toContain('2 highlights, 1 bookmarks');
    expect(md).toContain('progress: 42%');
    expect(md).toContain('> The animal laborans');
    expect(md).toContain('note: the key contrast to homo faber');
    expect(md).toContain('*orphaned — text not found in current edition*');
    expect(md).toContain('## bookmarks');
    expect(md).toContain('*The Pedagogy of Seeing*');
  });

  it('exports cleanly with zero annotations', () => {
    const md = exportReadingNotes(book, [], [], null);
    expect(md).toContain('# The Burnout Society');
    expect(md).not.toContain('## highlights');
  });
});
