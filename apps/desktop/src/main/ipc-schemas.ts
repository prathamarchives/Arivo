/**
 * THE IPC SCHEMAS — the runtime contract for every channel payload.
 * electron-free: hostile inputs are tested directly against these, in
 * vitest, without booting the app (I-25, I-27).
 */
import {
  v,
  type Validator,
  type Anchor,
  type TextRange,
  type AnchorPosition,
  type Highlight,
  type HighlightColor,
  type ResolutionStatus,
  type Bookmark,
  type Note,
  type ReadingProgress,
  type AppSettings,
} from '@arivo/core';

const id = v.id();
const chapterName = v.nullable(v.string({ max: 500 }));

const anchorPosition: Validator<AnchorPosition> = v.object({
  spineIndex: v.optional(v.number({ int: true, min: 0, max: 100_000 })),
  page: v.optional(v.number({ int: true, min: 0, max: 100_000 })),
  percent: v.optional(v.number({ min: 0, max: 1 })),
  chapter: v.optional(v.string({ max: 500 })),
});

const textRange: Validator<TextRange> = v.object({
  exact: v.string({ max: 20_000 }),
  prefix: v.string({ max: 500 }),
  suffix: v.string({ max: 500 }),
});

const anchor: Validator<Anchor> = v.object({
  format: v.enum('epub', 'pdf'),
  primary: v.string({ max: 4096 }),
  textRange: v.nullable(textRange),
  position: v.nullable(anchorPosition),
});

const highlight: Validator<Highlight> = v.object({
  id,
  bookId: id,
  anchor,
  color: v.enum('yellow', 'blue', 'green', 'pink', 'gray') as Validator<HighlightColor>,
  text: v.string({ max: 20_000 }),
  chapter: chapterName,
  note: v.nullable(v.string({ max: 20_000 })),
  status: v.enum('resolved', 'drifted', 'ambiguous', 'orphaned') as Validator<ResolutionStatus>,
  createdAt: v.number({ min: 0 }),
  updatedAt: v.number({ min: 0 }),
});

const bookmark: Validator<Bookmark> = v.object({
  id,
  bookId: id,
  anchor,
  label: v.nullable(v.string({ max: 500 })),
  chapter: chapterName,
  createdAt: v.number({ min: 0 }),
});

const note: Validator<Note> = v.object({
  id,
  bookId: id,
  anchor,
  body: v.string({ min: 1, max: 20_000 }),
  chapter: chapterName,
  createdAt: v.number({ min: 0 }),
  updatedAt: v.number({ min: 0 }),
});

const progress: Validator<ReadingProgress> = v.object({
  bookId: id,
  locator: v.string({ min: 1, max: 4096 }),
  percent: v.number({ min: 0, max: 1 }),
  chapter: chapterName,
  startedAt: v.nullable(v.number({ min: 0 })),
  lastReadAt: v.number({ min: 0 }),
  completedAt: v.boolean(),
});

const settings: Validator<AppSettings> = v.object({
  theme: v.enum('paper', 'sepia', 'night'),
  fontStep: v.number({ int: true, min: 0, max: 4 }),
  flow: v.enum('paginated', 'scrolled'),
  libraryView: v.enum('grid', 'list'),
  librarySize: v.enum('s', 'm', 'l'),
  booksDir: v.nullable(v.string({ min: 1, max: 1024 })),
});


export const schemas = {
  importPaths: v.array(v.string({ min: 1, max: 2048 }), { max: 50 }),
  remove: v.object({ id, deleteFiles: v.boolean() }),
  bookGet: id,
  bookSetTags: v.object({
    id,
    tags: v.array(v.string({ min: 1, max: 100 }), { max: 50 }),
  }),
  progressSave: v.object({ bookId: id, progress }),
  sessionBegin: v.object({ bookId: id, startPercent: v.number({ min: 0, max: 1 }) }),
  sessionEnd: v.object({ sessionId: id, endPercent: v.number({ min: 0, max: 1 }) }),
  annotationsList: id,
  highlightCreate: v.object({ bookId: id, h: highlight }),
  highlightUpdate: v.object({ bookId: id, h: highlight }),
  highlightDelete: v.object({ bookId: id, id: v.id() }),
  bookmarkCreate: v.object({ bookId: id, b: bookmark }),
  bookmarkDelete: v.object({ bookId: id, id: v.id() }),
  noteCreate: v.object({ bookId: id, n: note }),
  noteUpdate: v.object({ bookId: id, n: note }),
  noteDelete: v.object({ bookId: id, id: v.id() }),
  collectionsCreate: v.object({
    name: v.string({ min: 1, max: 200 }),
    description: v.nullable(v.string({ max: 2000 })),
  }),
  collectionsRemove: id,
  collectionsRename: v.object({ id, name: v.string({ min: 1, max: 200 }) }),
  collectionsAssign: v.object({ collectionId: id, bookId: id }),
  collectionsUnassign: v.object({ collectionId: id, bookId: id }),
  collectionsBooks: id,
  searchQuery: v.string({ min: 1, max: 512 }),
  settingsSet: settings,
  exportNotes: id,
};
