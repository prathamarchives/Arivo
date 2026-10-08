/**
 * the command surface — the entire renderer↔main boundary, typed.
 * the renderer cannot touch the filesystem; it can only ask.
 */
import type {
  AppSettings,
  ArchiveEntry,
  Book,
  Bookmark,
  Collection,
  Highlight,
  ImportResult,
  Note,
  ReadingProgress,
  SearchHit,
  SessionStats,
} from './types.ts';
import type { SerializedArivoError } from './errors.ts';
import type { DiagnosticsReport } from './diagnostics.ts';

/**
 * THE IPC ENVELOPE — typed errors survive the bridge.
 * main resolves with {ok, value} or {ok: false, error: {code, message}};
 * preload unwraps and rethrows with the code attached. no error object ever
 * has to survive electron's serialization by luck.
 */
export type IpcEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: SerializedArivoError };

/** a renderer-side error that kept its domain code across the bridge */
export class RemoteError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'RemoteError';
    this.code = code;
  }
}

/** unwrap in preload: value through, coded error thrown */
export function unwrapEnvelope<T>(envelope: IpcEnvelope<T>): T {
  if (envelope.ok) return envelope.value;
  throw new RemoteError(envelope.error.code, envelope.error.message);
}

/** a book joined with its progress — what the library shows */
export interface BookWithProgress extends Book {
  progress: ReadingProgress | null;
}

/** the ui-facing reconciliation summary (structurally what the engine returns) */
export interface ReconciliationReport {
  durationMs: number;
  scanned: number;
  indexed: number;
  counts: Record<string, number>;
  fixedPoint: boolean;
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
    /** tags are user-owned truth — written to metadata.json first, then the index */
    setTags(id: string, tags: string[]): Promise<void>;
  };
  progress: {
    save(bookId: string, progress: ReadingProgress): Promise<void>;
  };
  sessions: {
    begin(bookId: string, startPercent: number): Promise<string>;
    end(sessionId: string, endPercent: number): Promise<void>;
    /** the reading-life numbers (quiet, honest, index-derived) */
    stats(): Promise<SessionStats>;
  };
  annotations: {
    list(bookId: string): Promise<{ highlights: Highlight[]; bookmarks: Bookmark[]; notes: Note[] }>;
    createHighlight(bookId: string, h: Highlight): Promise<void>;
    updateHighlight(bookId: string, h: Highlight): Promise<void>;
    deleteHighlight(bookId: string, id: string): Promise<void>;
    createBookmark(bookId: string, b: Bookmark): Promise<void>;
    deleteBookmark(bookId: string, id: string): Promise<void>;
    /** margin notes — thinking attached to a place */
    createNote(bookId: string, n: Note): Promise<void>;
    updateNote(bookId: string, n: Note): Promise<void>;
    deleteNote(bookId: string, id: string): Promise<void>;
  };
  archive: {
    /** every mark across every book, newest first — the archive's ledger.
     *  one call, joined provenance; never n+1 from the renderer. */
    marks(): Promise<ArchiveEntry[]>;
  };
  collections: {
    list(): Promise<{ collection: Collection; count: number }[]>;
    create(name: string, description: string | null): Promise<Collection>;
    remove(id: string): Promise<void>;
    rename(id: string, name: string): Promise<void>;
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
    /** main-side directory picker; returns the chosen path or null (nothing applied yet) */
    pickBooksDir(): Promise<string | null>;
  };
  exportNotes: {
    save(bookId: string): Promise<string | null>;
  };
  dev: {
    rebuildIndex(): Promise<{ books: number; highlights: number; bookmarks: number }>;
    reconcile(): Promise<ReconciliationReport | null>;
  };
  recovery: {
    /** the startup recovery note, when the index was rebuilt */
    note(): Promise<string | null>;
  };
  diagnostics: {
    report(): Promise<DiagnosticsReport>;
    export(): Promise<string | null>;
  };
}
