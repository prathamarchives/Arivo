/** the domain model. pure data, zero deps, runs anywhere. */

export type BookFormat = 'epub' | 'pdf';

/**
 * THE FOLDER CONTRACT (the portability law's on-disk shape): metadata.json.
 * a book folder is {id}/book.epub|pdf + cover.jpg + metadata.json +
 * annotations.json. this type is the single source of truth for that file —
 * the documents layer writes it, the database layer reads it.
 */
export interface BookFolderMeta {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  language: string | null;
  publisher: string | null;
  publishedYear: string | null;
  coverPath: string | null;
  format: BookFormat;
  /** sha256 of the book file — content identity, not path identity */
  hash: string;
  fileName: string;
  fileSize: number;
  tags: string[];
  addedAt?: number;
  updatedAt?: number;
  /**
   * fingerprint fast path: mtime of the book file at last agreement.
   * absent in v0.1 folders — first scan hashes once and backfills it.
   */
  fileMtime?: number;
  /** set by reconciliation when this folder was suppressed as a duplicate */
  duplicateOf?: string | null;
  /** set by reconciliation when the book file is gone but truth remains */
  fileMissing?: boolean;
}

export type ReadingTheme = 'paper' | 'sepia' | 'night';

export type ReadingFlow = 'paginated' | 'scrolled';

export type LibraryView = 'grid' | 'list';

export type LibrarySize = 's' | 'm' | 'l';

/** fonts come from the catalyst family: instrument serif (display), literata (reading), inter (ui) */
export interface ReaderSettings {
  theme: ReadingTheme;
  /** index into the type steps: 16 / 18 / 20 / 22 / 24 */
  fontStep: number;
  flow: ReadingFlow;
}

export interface AppSettings extends ReaderSettings {
  libraryView: LibraryView;
  librarySize: LibrarySize;
  /** null = default ~/Arivo */
  booksDir: string | null;
}

export const FONT_STEPS = [16, 18, 20, 22, 24] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'paper',
  fontStep: 1,
  flow: 'paginated',
  libraryView: 'grid',
  librarySize: 'm',
  booksDir: null,
};

/** THE ANCHOR — every annotation's immortality contract. */
export interface Anchor {
  format: BookFormat;
  /** primary: epub CFI, pdf page+offset */
  primary: string;
  textRange: TextRange | null;
  position: AnchorPosition | null;
}

export interface TextRange {
  /** the selected text itself */
  exact: string;
  /** ~48 chars before, for disambiguation and repair */
  prefix: string;
  /** ~48 chars after */
  suffix: string;
}

export interface AnchorPosition {
  spineIndex?: number;
  page?: number;
  percent?: number;
  chapter?: string;
}

export type ResolutionStatus = 'resolved' | 'drifted' | 'ambiguous' | 'orphaned';

export type HighlightColor = 'yellow' | 'blue' | 'green' | 'pink' | 'gray';

export interface Highlight {
  id: string;
  bookId: string;
  anchor: Anchor;
  color: HighlightColor;
  /** the highlighted text, kept verbatim for display + fallback matching */
  text: string;
  chapter: string | null;
  /** the attached note (kindle model — notes ride with their highlight in v0.1) */
  note: string | null;
  /** last known resolution — drift is visible, never silent */
  status: ResolutionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  anchor: Anchor;
  label: string | null;
  chapter: string | null;
  createdAt: number;
}

/**
 * a margin note — thinking attached to a place, no highlight required.
 * where highlights keep what the author said, notes keep what YOU thought.
 */
export interface Note {
  id: string;
  bookId: string;
  anchor: Anchor;
  body: string;
  chapter: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  language: string | null;
  publisher: string | null;
  publishedYear: string | null;
  coverPath: string | null;
  format: BookFormat;
  /** sha256 of the file — identity for dedup */
  hash: string;
  fileName: string;
  fileSize: number;
  addedAt: number;
  updatedAt: number;
  tags: string[];
  /** reconciliation state: the book file is gone but truth remains (ORPHANED_DATA) */
  fileMissing?: boolean;
}

export interface ReadingProgress {
  bookId: string;
  /** the locator to restore: epub CFI / pdf page marker */
  locator: string;
  percent: number;
  chapter: string | null;
  startedAt: number | null;
  lastReadAt: number;
  completedAt: boolean;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  startPercent: number;
  endPercent: number | null;
}

// ---------- reading life (quiet numbers — sessions are index telemetry) ----------

export interface SessionDayStat {
  /** local-midnight epoch ms of the day bucket */
  day: number;
  /** total ms read that day */
  ms: number;
}

export interface BookTimeStat {
  bookId: string;
  title: string;
  /** total ms spent in this book */
  ms: number;
  lastReadAt: number | null;
}

export interface SessionStats {
  totalMs: number;
  /** the last 7 days, ms */
  weekMs: number;
  /** consecutive reading days ending today or yesterday; 0 = none yet */
  streakDays: number;
  /** finished sessions, all time */
  sessions: number;
  /** the last 14 days, sparse (absent = no reading that day) */
  days: SessionDayStat[];
  /** where the time went, most-first, capped */
  books: BookTimeStat[];
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
}

export interface CollectionItem {
  collectionId: string;
  bookId: string;
}

export type SearchHitKind = 'book' | 'highlight' | 'note' | 'collection' | 'tag';

export interface SearchHit {
  kind: SearchHitKind;
  id: string;
  title: string;
  context: string | null;
  /** for jumps: the book + locator to open */
  bookId: string | null;
  locator: string | null;
  /** for highlights: the highlight id, so the reader can focus it */
  highlightId: string | null;
}

/** import state machine: validating → parsing → extracting → indexing → done | failed */
export type ImportPhase =
  | 'validating'
  | 'parsing'
  | 'extracting'
  | 'indexing'
  | 'done'
  | 'failed';

export interface ImportResult {
  ok: boolean;
  bookId: string | null;
  title: string | null;
  reason: string | null;
}

export interface ImportProgress {
  fileName: string;
  phase: ImportPhase;
  percent: number;
}
