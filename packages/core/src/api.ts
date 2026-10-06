/**
 * the command surface — the entire renderer↔main boundary, typed.
 * the renderer cannot touch the filesystem; it can only ask.
 */
import type {
  AppSettings,
  Book,
  Bookmark,
  Collection,
  Highlight,
  ImportResult,
  ReadingProgress,
  SearchHit,
} from './types.ts';

/** a book joined with its progress — what the library shows */
export interface BookWithProgress extends Book {
  progress: ReadingProgress | null;
}

export interface ArivoApi {
  platform: 'electron' | 'web';
  library: {
    list(): Promise<BookWithProgress[]>;
    pickAndImport(): Promise<ImportResult[]>;
    importPaths(paths: string[]): Promise<ImportResult[]>;
    remove(id: string, deleteFiles: boolean): Promise<void>;
  };
  book: {
    /** the fetchable source url for the book binary */
    openUrl(id: string): string;
    coverUrl(id: string): string;
    get(id: string): Promise<BookWithProgress | null>;
  };
  progress: {
    save(bookId: string, progress: ReadingProgress): Promise<void>;
  };
  sessions: {
    begin(bookId: string, startPercent: number): Promise<string>;
    end(sessionId: string, endPercent: number): Promise<void>;
  };
  annotations: {
    list(bookId: string): Promise<{ highlights: Highlight[]; bookmarks: Bookmark[] }>;
    createHighlight(bookId: string, h: Highlight): Promise<void>;
    updateHighlight(bookId: string, h: Highlight): Promise<void>;
    deleteHighlight(bookId: string, id: string): Promise<void>;
    createBookmark(bookId: string, b: Bookmark): Promise<void>;
    deleteBookmark(bookId: string, id: string): Promise<void>;
  };
  collections: {
    list(): Promise<{ collection: Collection; count: number }[]>;
    create(name: string, description: string | null): Promise<Collection>;
    remove(id: string): Promise<void>;
    assign(collectionId: string, bookId: string): Promise<void>;
    unassign(collectionId: string, bookId: string): Promise<void>;
    books(collectionId: string): Promise<string[]>;
  };
  search: {
    query(q: string): Promise<SearchHit[]>;
  };
  settings: {
    get(): Promise<AppSettings>;
    set(s: AppSettings): Promise<void>;
  };
  exportNotes: {
    save(bookId: string): Promise<string | null>;
  };
  dev: {
    rebuildIndex(): Promise<{ books: number; highlights: number; bookmarks: number }>;
  };
}
