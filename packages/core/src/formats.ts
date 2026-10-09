/**
 * THE FORMAT CONTRACT — law 11.
 * the reader, annotations, search, and progress speak only to this interface.
 * a new format is a new plugin, never a fork of the reader.
 */
import type {
  Anchor,
  BookFormat,
  Highlight,
  ReaderSettings,
} from './types.ts';

export interface ChapterNode {
  id: string;
  label: string;
  /** epub href / pdf page number as string */
  target: string;
  children: ChapterNode[];
}

export interface SelectionInfo {
  anchor: Anchor;
  text: string;
  chapter: string | null;
  /** approx position of the selection in the reader viewport (for the menu) */
  rect?: { x: number; y: number; w: number; h: number };
}

export interface AnnotationView {
  id: string;
  anchor: Anchor;
  color: Highlight['color'];
  note: string | null;
  /** pdf only: normalized (0-1) rects per page, derived at selection time */
  rects?: { page: number; x: number; y: number; w: number; h: number }[];
}

export interface RelocatedEvent {
  /** the locator to persist (cfi / page marker) */
  locator: string;
  percent: number;
  chapter: string | null;
  /** v0.3.1 — the visible view's identity, for page-pinned objects
   *  (sticky notes, ink): epub spine index + page within it, pdf page.
   *  absent when the adapter cannot know it — the reader falls back to
   *  chapter-level pinning. */
  spineIndex?: number;
  pageInSpine?: number;
  pagesInSpine?: number;
  page?: number;
}

export interface FormatReader {
  readonly format: BookFormat;
  /** load the document into the container. resolves when first render is queued */
  open(container: HTMLElement, source: ArrayBuffer): Promise<void>;
  /** display at a saved locator, a chapter target, or the start */
  display(target?: string): Promise<void>;
  next(): void;
  prev(): void;
  jumpTo(locator: string): Promise<void>;
  /** focus an existing annotation (scroll/scroll+flash) */
  focusAnnotation(id: string): void;
  /** render + re-render the annotation set (colors, notes change) */
  renderAnnotations(items: AnnotationView[]): void;
  removeAnnotation(id: string): void;
  applySettings(settings: ReaderSettings): void;
  getChapters(): ChapterNode[];
  /** dismiss the live text selection (after an annotation action) */
  clearSelection(): void;
  /** the app owns the fonts; reflowable formats inject them into content */
  setFontFace(css: string): void;
  destroy(): void;
}

export interface FormatReaderHooks {
  onRelocated: (e: RelocatedEvent) => void;
  onSelection: (sel: SelectionInfo | null) => void;
  onAnnotationClick: (id: string) => void;
}

export interface FormatPlugin {
  readonly format: BookFormat;
  create(hooks: FormatReaderHooks): FormatReader;
}

/** anchor repair callback: adapter asks the domain to re-mint a primary after text match */
export type RepairAnchor = (
  anchor: Anchor,
  chapterText: string,
  repair: { index: number; end: number },
) => Anchor | null;
