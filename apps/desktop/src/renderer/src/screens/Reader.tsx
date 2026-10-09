import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import type {
  AnnotationView,
  Bookmark,
  BookWithProgress,
  FormatReaderHooks,
  Highlight,
  HighlightColor,
  InkStroke,
  InkTool,
  Note,
  RelocatedEvent,
  SelectionInfo,
  SourceRef,
  FormatReader,
  ReaderSettings,
  Sketch,
  StickyColor,
  StickyNote,
} from '@arivo/core';
import { uuidv7, FONT_STEPS, LINE_HEIGHTS, MEASURES, READING_PROFILES, activeProfile, type ReadingProfile } from '@arivo/core';
import { EpubAdapter, PdfAdapter, type PdfAnchorData, type ZoomMode } from '@arivo/reader';
import { zoomLabel, stepZoom, parsePageTarget } from '@arivo/reader';
import { IconButton, Button, Input, Kbd, Tabs } from '@arivo/ui';
import { api } from '../services/api.ts';
import { BOOK_FONT_FACE_CSS } from '../lib/book-fonts.ts';
import { useSettings } from '../stores/settings.ts';
import { useRoom, type NotesTab } from '../stores/room.ts';
import { useLibrary } from '../stores/library.ts';
import { Workbench, type WorkbenchHandle } from '../features/desk/Workbench.tsx';
import { draftStatusText } from '../lib/drafts.ts';
import { useDraft } from '../lib/useDraft.ts';
import { plainError } from '../lib/voice.ts';
import {
  StickyLayer,
  InkLayer,
  InkToolbar,
  onVisiblePage,
  pageAnchor,
  newSketch,
} from './PageObjects.tsx';
import {
  IconBack,
  IconToc,
  IconNote,
  IconType,
  IconBookmark,
  IconX,
  IconTrash,
  IconDownload,
  IconSun,
  IconLamp,
  IconMoon,
  IconChevronRight,
  IconFitWidth,
  IconFitPage,
  IconPencil,
  IconSearch,
  IconInfo,
  IconSticky,
  IconCopy,
} from '../components/icons.tsx';

const COLORS: HighlightColor[] = ['yellow', 'blue', 'green', 'pink', 'gray'];

function parsePdfRects(anchor: { primary: string }): PdfAnchorData['rects'] | undefined {
  try {
    const data = JSON.parse(anchor.primary) as PdfAnchorData;
    return data.rects;
  } catch {
    return undefined;
  }
}

/** clamp a centered popover's x so its width never leaves the window */
function clampCenter(x: number, half: number): number {
  return Math.min(Math.max(x, half + 8), window.innerWidth - half - 8);
}

// ---------------- selection menu ----------------

/**
 * the selection menu — the signature moment, rebuilt (v0.3.1): a compact
 * instrument that floats ABOVE the selection's first line (below it when
 * the line is near the top), clamped so it can never clip. colors speak
 * as dots; the actions speak as icons with names — narrow enough to sit
 * over one line of text without becoming furniture.
 */
function SelectionMenu({
  selection,
  onColor,
  onNote,
  onQuestion,
  onSticky,
  onBookmark,
  onCollect,
  onClose,
}: {
  selection: SelectionInfo;
  onColor: (color: HighlightColor) => void;
  onNote: () => void;
  onQuestion: () => void;
  onSticky: () => void;
  onBookmark: () => void;
  onCollect: () => void;
  onClose: () => void;
}): ReactNode {
  const HALF = 170;
  const cx = selection.rect ? selection.rect.x + selection.rect.w / 2 : window.innerWidth / 2;
  const x = clampCenter(cx, HALF);
  const aboveY = selection.rect ? selection.rect.y - 52 : window.innerHeight / 2 - 60;
  /* near the top of the window: flip below the selection, never clipped */
  const belowY = selection.rect ? selection.rect.y + (selection.rect.h || 24) + 44 : window.innerHeight / 2;
  const y = aboveY >= 64 ? aboveY : belowY;
  return (
    <>
      <div className="menu-scrim" onMouseDown={onClose} />
      <div className="selection-menu glass rise" style={{ left: x, top: y }} role="menu" aria-label="selection actions">
        <div className="sel-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`sel-dot sel-dot-${c}`}
              aria-label={`highlight ${c}`}
              onClick={() => onColor(c)}
            />
          ))}
        </div>
        <div className="sel-sep" />
        <button className="sel-icon" onClick={onNote} title="note on this passage" aria-label="note on this passage">
          <IconNote />
        </button>
        <button className="sel-icon" onClick={onQuestion} title="keep a question here" aria-label="keep a question here">
          <IconInfo />
        </button>
        <button className="sel-icon" onClick={onSticky} title="pin a sticky note on this page" aria-label="pin a sticky note on this page">
          <IconSticky />
        </button>
        <button className="sel-icon" onClick={onBookmark} title="bookmark this passage" aria-label="bookmark this passage">
          <IconBookmark />
        </button>
        <button className="sel-icon" onClick={onCollect} title="collect into the notebook" aria-label="collect into the notebook">
          <IconSearch />
        </button>
        <button
          className="sel-icon"
          onClick={() => {
            void navigator.clipboard?.writeText(selection.text);
            onClose();
          }}
          title="copy"
          aria-label="copy"
        >
          <IconCopy />
        </button>
      </div>
    </>
  );
}

// ---------------- notebook (the marks tab) ----------------

function Notebook({
  highlights,
  bookmarks,
  notes,
  onJump,
  onJumpNote,
  onUpdate,
  onDelete,
  onDeleteBookmark,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  header,
  focusId,
}: {
  highlights: Highlight[];
  bookmarks: Bookmark[];
  notes: Note[];
  onJump: (h: Highlight) => void;
  onJumpNote: (n: Note) => void;
  onUpdate: (h: Highlight) => void;
  onDelete: (id: string) => void;
  onDeleteBookmark: (id: string) => void;
  onCreateNote: (body: string) => void;
  onUpdateNote: (n: Note) => void;
  onDeleteNote: (id: string) => void;
  header: ReactNode;
  focusId: string | null;
}): ReactNode {
  const [noteDraft, setNoteDraft] = useState<{ id: string; body: string } | null>(null);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newNoteBody, setNewNoteBody] = useState('');
  const [noteEdit, setNoteEdit] = useState<{ id: string; body: string } | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);

  /* leaving the notebook mid-edit must never cost text: unmount saves
   * whatever draft is in hand (the tab switch to the notebook closes
   * this drawer — blur never fires on unmount) */
  const liveRef = useRef({ noteDraft, noteEdit, highlights, notes, onUpdate, onUpdateNote });
  liveRef.current = { noteDraft, noteEdit, highlights, notes, onUpdate, onUpdateNote };
  useEffect(
    () => () => {
      const { noteDraft: nd, noteEdit: ne, highlights: hls, notes: ns, onUpdate: up, onUpdateNote: upn } =
        liveRef.current;
      if (nd) {
        const h = hls.find((x) => x.id === nd.id);
        if (h && (nd.body.trim() || h.note)) up({ ...h, note: nd.body.trim() || null });
      }
      if (ne) {
        const n = ns.find((x) => x.id === ne.id);
        if (n && ne.body.trim() && ne.body.trim() !== n.body) {
          upn({ ...n, body: ne.body.trim(), updatedAt: Date.now() });
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (focusId) {
      const el = document.querySelector(`[data-note-id="${focusId}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [focusId]);

  const sorted = useMemo(() => {
    const byPos = (a: Highlight, b: Highlight) => {
      const pa = a.anchor.position?.spineIndex ?? a.anchor.position?.page ?? 0;
      const pb = b.anchor.position?.spineIndex ?? b.anchor.position?.page ?? 0;
      if (pa !== pb) return pa - pb;
      return (a.anchor.position?.percent ?? 0) - (b.anchor.position?.percent ?? 0);
    };
    return [...highlights].sort(byPos);
  }, [highlights]);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort(
        (a, b) => (a.anchor.position?.percent ?? 0) - (b.anchor.position?.percent ?? 0),
      ),
    [notes],
  );

  return (
    <aside className="drawer drawer-right rise" aria-label="marks">
      {header}
      <div className="drawer-body">
        {/* the margin-note composer — thinking attached to where you are */}
        {newNoteOpen ? (
          <div className="note-card note-composer-card">
            <div className="meta-label">note at this position</div>
            <textarea
              className="note-input"
              autoFocus
              value={newNoteBody}
              placeholder="what are you thinking?"
              onChange={(e) => setNewNoteBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  if (newNoteBody.trim()) onCreateNote(newNoteBody.trim());
                  setNewNoteBody('');
                  setNewNoteOpen(false);
                }
                if (e.key === 'Escape') {
                  setNewNoteBody('');
                  setNewNoteOpen(false);
                }
              }}
              rows={4}
            />
            <div className="note-composer-actions">
              <span className="meta-label">
                <Kbd>Ctrl</Kbd>
                <Kbd>↵</Kbd> save
              </span>
              <span className="meta-label">esc cancels</span>
              <Button
                variant="solid"
                onClick={() => {
                  if (newNoteBody.trim()) onCreateNote(newNoteBody.trim());
                  setNewNoteBody('');
                  setNewNoteOpen(false);
                }}
              >
                save note
              </Button>
            </div>
          </div>
        ) : (
          <button className="chip chip-add note-new" onClick={() => setNewNoteOpen(true)}>
            <IconNote />
            write a note here
          </button>
        )}

        {sorted.length === 0 && bookmarks.length === 0 && sortedNotes.length === 0 && (
          <div className="drawer-empty">
            <div className="type-title">nothing marked yet</div>
            <p className="meta-label">select a passage while reading — it lands here</p>
          </div>
        )}
        {sorted.map((h) => (
          <div
            key={h.id}
            ref={focusId === h.id ? focusRef : undefined}
            data-note-id={h.id}
            className={`note-card${h.status === 'orphaned' ? ' note-orphaned' : ''}${h.status === 'ambiguous' ? ' note-ambiguous' : ''}`}
            onClick={() => onJump(h)}
          >
            <div className="note-card-head">
              <span className={`sel-dot sel-dot-${h.color}`} aria-hidden="true" />
              <span className="meta-label note-chapter">
                {h.status === 'drifted' && <em className="note-flag">re-anchored · </em>}
                {h.status === 'ambiguous' && <em className="note-flag note-flag-review">review required · </em>}
                {h.status === 'orphaned' && <em className="note-flag">orphaned · </em>}
                {h.chapter ?? ''}
              </span>
            </div>
            <blockquote className="note-text">{h.text}</blockquote>
            {noteDraft?.id === h.id ? (
              <div onClick={(e) => e.stopPropagation()}>
                <textarea
                  className="note-input"
                  autoFocus
                  value={noteDraft.body}
                  placeholder="your note…"
                  onChange={(e) => setNoteDraft({ id: h.id, body: e.target.value })}
                  onBlur={() => {
                    onUpdate({ ...h, note: noteDraft.body.trim() || null });
                    setNoteDraft(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setNoteDraft(null);
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      onUpdate({ ...h, note: noteDraft.body.trim() || null });
                      setNoteDraft(null);
                    }
                  }}
                  rows={3}
                />
                <div className="meta-label">ctrl+enter saves · esc cancels</div>
              </div>
            ) : (
              (h.note ?? noteDraft?.id === h.id) !== undefined &&
              h.note !== null && <p className="note-body">{h.note}</p>
            )}
            <div className="note-actions" onClick={(e) => e.stopPropagation()}>
              <button className="sel-action" onClick={() => setNoteDraft({ id: h.id, body: h.note ?? '' })}>
                <IconNote />
                {h.note ? 'edit note' : 'note'}
              </button>
              <button className="sel-action danger" onClick={() => onDelete(h.id)}>
                <IconTrash />
                remove
              </button>
            </div>
          </div>
        ))}
        {bookmarks.map((b) => (
          <div key={b.id} className="note-card note-bookmark" onClick={() => void 0}>
            <div className="note-card-head">
              <IconBookmark />
              <span className="meta-label note-chapter">
                {b.chapter ?? b.label ?? 'bookmark'}
                {b.anchor.position?.percent !== undefined && b.anchor.position.percent !== null
                  ? ` · ${Math.round((b.anchor.position.percent ?? 0) * 100)}%`
                  : ''}
              </span>
            </div>
            <div className="note-actions">
              <button
                className="sel-action"
                onClick={() => onJump({ ...({} as Highlight), id: b.id, anchor: b.anchor } as Highlight)}
              >
                <IconChevronRight />
                jump
              </button>
              <button className="sel-action danger" onClick={() => onDeleteBookmark(b.id)}>
                <IconTrash />
                remove
              </button>
            </div>
          </div>
        ))}

        {sortedNotes.map((n) => (
          <div
            key={n.id}
            className="note-card note-margin"
            data-note-id={n.id}
            onClick={() => onJumpNote(n)}
          >
            <div className="note-card-head">
              <IconNote />
              <span className="meta-label note-chapter">
                {n.question && <em className="note-flag note-flag-question">question · </em>}
                {n.chapter ?? `${Math.round((n.anchor.position?.percent ?? 0) * 100)}%`}
              </span>
            </div>
            {noteEdit?.id === n.id ? (
              <div onClick={(e) => e.stopPropagation()}>
                <textarea
                  className="note-input"
                  autoFocus
                  value={noteEdit.body}
                  onChange={(e) => setNoteEdit({ id: n.id, body: e.target.value })}
                  onBlur={() => {
                    if (noteEdit.body.trim() && noteEdit.body.trim() !== n.body) {
                      onUpdateNote({ ...n, body: noteEdit.body.trim(), updatedAt: Date.now() });
                    }
                    setNoteEdit(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      if (noteEdit.body.trim() && noteEdit.body.trim() !== n.body) {
                        onUpdateNote({ ...n, body: noteEdit.body.trim(), updatedAt: Date.now() });
                      }
                      setNoteEdit(null);
                    }
                    if (e.key === 'Escape') setNoteEdit(null);
                  }}
                  rows={3}
                />
                <div className="meta-label">ctrl+enter saves · esc cancels</div>
              </div>
            ) : (
              <p className="note-body note-body-own">{n.body}</p>
            )}
            <div className="note-actions" onClick={(e) => e.stopPropagation()}>
              <button className="sel-action" onClick={() => setNoteEdit({ id: n.id, body: n.body })}>
                <IconPencil />
                edit
              </button>
              <button className="sel-action danger" onClick={() => onDeleteNote(n.id)}>
                <IconTrash />
                remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ---------------- typography panel ----------------

function TypographyPanel({
  settings,
  onSet,
  isPdf,
  zoom,
  onZoom,
  onClose,
}: {
  settings: ReaderSettings;
  onSet: (partial: Partial<ReaderSettings>) => void;
  isPdf: boolean;
  zoom: ZoomMode;
  onZoom: (z: ZoomMode) => void;
  onClose: () => void;
}): ReactNode {
  const themes = [
    { key: 'paper', label: 'paper', icon: <IconSun /> },
    { key: 'sepia', label: 'sepia', icon: <IconLamp /> },
    { key: 'night', label: 'night', icon: <IconMoon /> },
  ] as const;
  return (
    <div className="type-panel glass rise" role="dialog" aria-label="reading settings">
      <header className="drawer-head">
        <span className="meta-label">reading</span>
        <IconButton label="close" onClick={onClose}>
          <IconX />
        </IconButton>
      </header>
      <div className="type-themes">
        {themes.map((t) => (
          <button
            key={t.key}
            className={`type-theme${settings.theme === t.key ? ' type-theme-active' : ''}`}
            data-preview={t.key}
            onClick={() => onSet({ theme: t.key })}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {!isPdf && (
        <>
          <div className="meta-label type-label">profile</div>
          <div className="type-flow">
            {(Object.keys(READING_PROFILES) as ReadingProfile[]).map((key) => (
              <button
                key={key}
                className={`chip${activeProfile(settings) === key ? ' chip-active' : ''}`}
                onClick={() => onSet(READING_PROFILES[key])}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="meta-label type-label">size</div>
          <div className="type-steps">
            {FONT_STEPS.map((px, i) => (
              <button
                key={px}
                className={`type-step${settings.fontStep === i ? ' type-step-active' : ''}`}
                style={{ fontSize: `${10 + i * 2}px` }}
                onClick={() => onSet({ fontStep: i })}
                aria-label={`${px} pixels`}
              >
                Aa
              </button>
            ))}
          </div>
          <div className="meta-label type-label">leading</div>
          <div className="type-flow">
            {LINE_HEIGHTS.map((lh, i) => (
              <button
                key={lh}
                className={`chip${settings.lineHeight === i ? ' chip-active' : ''}`}
                onClick={() => onSet({ lineHeight: i })}
              >
                {lh}
              </button>
            ))}
          </div>
          <div className="meta-label type-label">measure</div>
          <div className="type-flow">
            {MEASURES.map((m) => (
              <button
                key={m}
                className={`chip${settings.measure === m ? ' chip-active' : ''}`}
                onClick={() => onSet({ measure: m })}
                aria-label={`${m} pixel column`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="meta-label type-label">flow</div>
          <div className="type-flow">
            <button
              className={`chip${settings.flow === 'paginated' ? ' chip-active' : ''}`}
              onClick={() => onSet({ flow: 'paginated' })}
            >
              pages
            </button>
            <button
              className={`chip${settings.flow === 'scrolled' ? ' chip-active' : ''}`}
              onClick={() => onSet({ flow: 'scrolled' })}
            >
              scroll
            </button>
          </div>
          {settings.flow === 'paginated' && (
            <>
              <div className="meta-label type-label">page</div>
              <div className="type-flow">
                <button
                  className={`chip${settings.pageMode === 'single' ? ' chip-active' : ''}`}
                  onClick={() => onSet({ pageMode: 'single' })}
                >
                  one page
                </button>
                <button
                  className={`chip${settings.pageMode === 'auto' ? ' chip-active' : ''}`}
                  onClick={() => onSet({ pageMode: 'auto' })}
                >
                  two pages
                </button>
              </div>
            </>
          )}
        </>
      )}
      {isPdf && (
        <>
          <div className="meta-label type-label">zoom</div>
          <div className="type-flow">
            <button
              className={`chip${zoom === 'fit-width' ? ' chip-active' : ''}`}
              onClick={() => onZoom('fit-width')}
            >
              <IconFitWidth /> fit width
            </button>
            <button
              className={`chip${zoom === 'fit-page' ? ' chip-active' : ''}`}
              onClick={() => onZoom('fit-page')}
            >
              <IconFitPage /> fit page
            </button>
          </div>
          <div className="type-flow">
            <button className="chip" onClick={() => onZoom(stepZoom(zoom, 0.8))} aria-label="zoom out">
              <span aria-hidden="true">−</span>
            </button>
            <span className="meta-label type-zoom-label">{zoomLabel(zoom)}</span>
            <button className="chip" onClick={() => onZoom(stepZoom(zoom, 1.25))} aria-label="zoom in">
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- the reader screen ----------------

export function ReaderScreen({ bookId }: { bookId: string }): ReactNode {
  const goShelf = useRoom((s) => s.goShelf);
  const toast = useRoom((s) => s.toast);
  const attention = useRoom((s) => s.attention);
  const setEngaged = useRoom((s) => s.setEngaged);
  const clearDeskPending = useRoom((s) => s.clearDeskPending);
  /* the notes panel rides the desk context (spatial memory): it
   * survives a shelf roundtrip — same tab, same open document */
  const notesOpen = useRoom((s) => s.desk?.notesOpen ?? false);
  const notesTab = useRoom((s) => s.desk?.notesTab ?? 'marks');
  const workbenchDocId = useRoom((s) => s.desk?.workbenchDocId ?? null);
  const openNotes = useRoom((s) => s.openNotes);
  const closeNotes = useRoom((s) => s.closeNotes);
  const setNotesTab = useRoom((s) => s.setNotesTab);
  const setWorkbenchDoc = useRoom((s) => s.setWorkbenchDoc);
  const refresh = useLibrary((s) => s.refresh);
  const { settings, set: setSettings } = useSettings();

  const [book, setBook] = useState<BookWithProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocTab, setTocTab] = useState<'contents' | 'bookmarks'>('contents');
  const [typeOpen, setTypeOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [chapter, setChapter] = useState('');
  const [chapters, setChapters] = useState<{ label: string; target: string; depth: number }[]>([]);
  const [pdfZoom, setPdfZoom] = useState<ZoomMode>('fit-width');
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pageQuery, setPageQuery] = useState('');
  /* the question instrument, and a quote collected while the notebook
   * tab was closed (consumed when the workbench mounts) */
  const [questionMode, setQuestionMode] = useState(false);
  const [pendingCollect, setPendingCollect] = useState<SourceRef | null>(null);
  const wbRef = useRef<WorkbenchHandle | null>(null);

  /* ---- the page objects (v0.3.1): stickies + ink ---- */
  const [stickies, setStickies] = useState<StickyNote[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [view, setView] = useState<RelocatedEvent | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<InkTool>('pencil');
  const [drawColor, setDrawColor] = useState<StickyColor>('yellow');
  const stageRef = useRef<HTMLDivElement | null>(null);

  /* chrome visibility is the shell's attention model — the reader reports
   * engagement (selection, drawers, drawing), the room decides quiet/absent */
  const chromeShown = attention === 'active';

  const hostRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<FormatReader | null>(null);
  const sessionRef = useRef<string | null>(null);
  const progressRef = useRef<RelocatedEvent | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerSettingsRef = useRef<ReaderSettings>(settings);

  const isPdf = book?.format === 'pdf';

  const persistProgress = useCallback(
    (immediate = false) => {
      const ev = progressRef.current;
      const bookIdNow = bookId;
      if (!ev) return;
      const write = (): void => {
        void api.progress.save(bookIdNow, {
          bookId: bookIdNow,
          locator: ev.locator,
          percent: ev.percent,
          chapter: ev.chapter,
          startedAt: book?.progress?.startedAt ?? Date.now(),
          lastReadAt: Date.now(),
          completedAt: ev.percent >= 0.985,
        });
      };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (immediate) write();
      else saveTimer.current = setTimeout(write, 2000);
    },
    [bookId, book?.progress?.startedAt],
  );

  const rerenderAnnotations = useCallback(
    (hl: Highlight[]) => {
      const adapter = adapterRef.current;
      if (!adapter) return;
      const views: AnnotationView[] = hl.map((h) => ({
        id: h.id,
        anchor: h.anchor,
        color: h.color,
        note: h.note,
        rects: h.anchor.format === 'pdf' ? parsePdfRects(h.anchor) : undefined,
      }));
      adapter.renderAnnotations(views);
    },
    [],
  );

  // ---- boot ----
  useEffect(() => {
    let disposed = false;
    const boot = async (): Promise<void> => {
      try {
        const book = await api.book.get(bookId);
        if (!book) throw new Error('book not found');
        if (disposed) return;
        setBook(book);

        const bytes = await (await fetch(api.book.openUrl(bookId))).arrayBuffer();
        if (disposed) return;

        const host = hostRef.current;
        if (!host) return;

        const hooks: FormatReaderHooks = {
          onRelocated: (e) => {
            progressRef.current = e;
            setView(e);
            setPercent(e.percent);
            setChapter(e.chapter ?? '');
            persistProgress(false);
          },
          onSelection: (s) => {
            setSelection(s);
          },
          onAnnotationClick: (id) => {
            openNotes('marks');
            setFocusId(id);
          },
        };

        const adapter =
          book.format === 'pdf'
            ? new PdfAdapter(hooks)
            : new EpubAdapter(hooks);
        adapterRef.current = adapter;
        adapter.setFontFace(BOOK_FONT_FACE_CSS);
        // settings land BEFORE the first render: the persisted flow is honored
        // at renderTo time, not patched in after (the toggle is real)
        adapter.applySettings(readerSettingsRef.current);

        await adapter.open(host, bytes);
        if (disposed) return;
        // the outline arrives as a tree — the drawer reads it flattened, indented
        const flat: { label: string; target: string; depth: number }[] = [];
        const walkChapters = (nodes: ReturnType<FormatReader['getChapters']>, depth: number): void => {
          for (const c of nodes) {
            flat.push({ label: c.label, target: c.target, depth });
            if (c.children.length > 0) walkChapters(c.children, depth + 1);
          }
        };
        walkChapters(adapter.getChapters(), 0);
        setChapters(flat);
        if (book.format === 'pdf') {
          setPdfPageCount((adapter as PdfAdapter).getPageCount());
        }

        // annotations + the drift pass
        const { highlights, bookmarks, notes, stickies, sketches } = await api.annotations.list(bookId);
        if (disposed) return;

        const final: Highlight[] = [];
        for (const h of highlights) {
          let current = h;
          if (book.format === 'epub' && h.anchor.format === 'epub') {
            const epub = adapter as EpubAdapter;
            const valid = await epub.cfiValid(h.anchor.primary).catch(() => false);
            if (!valid) {
              // the rich repair: ambiguous is surfaced as review required,
              // never silently guessed onto the wrong text
              const outcome = await epub.repairAnchorRich(h.anchor);
              if (outcome.anchor) {
                current = { ...h, anchor: outcome.anchor, status: 'drifted' };
                void api.annotations.updateHighlight(bookId, current);
              } else if (outcome.status === 'ambiguous') {
                if (h.status !== 'ambiguous') {
                  current = { ...h, status: 'ambiguous' };
                  void api.annotations.updateHighlight(bookId, current);
                }
              } else if (h.status !== 'orphaned') {
                current = { ...h, status: 'orphaned' };
                void api.annotations.updateHighlight(bookId, current);
              }
            } else if (h.status !== 'resolved') {
              current = { ...h, status: 'resolved' };
              void api.annotations.updateHighlight(bookId, current);
            }
          }
          final.push(current);
        }
        if (disposed) return;
        setHighlights(final);
        setBookmarks(bookmarks);
        setNotes(notes);
        setStickies(stickies);
        setSketches(sketches);
        rerenderAnnotations(final);

        const startPercent = book.progress?.percent ?? 0;
        const session = await api.sessions.begin(bookId, startPercent);
        sessionRef.current = session;

        /* exact source return: a one-shot locator from the desk context
         * (archive jump, palette jump) takes precedence over progress;
         * once consumed it is cleared — progress is the standing truth */
        const desk = useRoom.getState().desk;
        const pendingLocator = desk?.bookId === bookId ? desk.pendingLocator : null;
        const pendingFocusId = desk?.bookId === bookId ? desk.pendingFocusId : null;
        await adapter.display(pendingLocator ?? book.progress?.locator ?? undefined);
        if (pendingFocusId) {
          openNotes('marks');
          setFocusId(pendingFocusId);
        }
        clearDeskPending();
      } catch (err) {
        if (!disposed) {
          console.error(err);
          // the voice law: only our coded errors speak; parser internals never do
          setError(plainError(err, 'the book failed to open'));
        }
      }
    };
    void boot();

    return () => {
      disposed = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      persistProgress(true);
      if (sessionRef.current) {
        void api.sessions.end(sessionRef.current, progressRef.current?.percent ?? 0);
      }
      adapterRef.current?.destroy();
      adapterRef.current = null;
      void refresh();
    };
  }, [bookId]);

  // ---- settings flow to the adapter ----
  useEffect(() => {
    readerSettingsRef.current = settings;
    adapterRef.current?.applySettings(settings);
  }, [settings]);

  // ---- pdf zoom flows to the adapter ----
  useEffect(() => {
    const pdf = adapterRef.current as PdfAdapter | null;
    if (pdf?.setZoom && book?.format === 'pdf') pdf.setZoom(pdfZoom);
  }, [pdfZoom, book?.format]);

  /* engagement: while the reader holds work in hand (selection,
   * drawers, panels, drawing) the shell stays present — quiet/absent
   * is for unencumbered reading only. */
  useEffect(() => {
    setEngaged(Boolean(selection || notesOpen || tocOpen || typeOpen || drawMode));
    return () => setEngaged(false);
  }, [selection, notesOpen, tocOpen, typeOpen, drawMode, setEngaged]);

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      const adapter = adapterRef.current;
      if (!adapter) return;
      /* the notes panel is one keystroke away — the modes it replaced
       * never were (they needed Alt gymnastics) */
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        if (notesOpen) closeNotes();
        else openNotes();
        return;
      }
      if (typing) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          adapter.next();
          break;
        case ' ':
          e.preventDefault();
          adapter.next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          adapter.prev();
          break;
        case '+':
        case '=':
          if (isPdf) setPdfZoom((z) => stepZoom(z, 1.25));
          else setSettings({ fontStep: Math.min(FONT_STEPS.length - 1, settings.fontStep + 1) });
          break;
        case '-':
          if (isPdf) setPdfZoom((z) => stepZoom(z, 0.8));
          else setSettings({ fontStep: Math.max(0, settings.fontStep - 1) });
          break;
        case 'b':
        case 'B':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            void addBookmark();
          }
          break;
        case 'Escape':
          /* the cascade: transient surfaces first, the selection, then
           * the draw mode, then the notes panel — each keystroke peels
           * one layer back toward the reading */
          if (tocOpen || typeOpen) {
            setTocOpen(false);
            setTypeOpen(false);
          } else if (selection) {
            setSelection(null);
            setNoteMode(false);
            setQuestionMode(false);
          } else if (drawMode) {
            setDrawMode(false);
          } else if (notesOpen) {
            closeNotes();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPdf, settings.fontStep, tocOpen, typeOpen, selection, drawMode, notesOpen, percent, chapter, setSettings, openNotes, closeNotes]);

  useEffect(() => {
    const onBeforeUnload = (): void => persistProgress(true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [persistProgress]);

  // ---- annotation actions ----

  const createHighlight = useCallback(
    async (color: HighlightColor, note: string | null): Promise<void> => {
      const sel = selection;
      if (!sel || !book) return;
      const h: Highlight = {
        id: uuidv7(),
        bookId: book.id,
        anchor: sel.anchor,
        color,
        text: sel.text,
        chapter: sel.chapter,
        note,
        status: 'resolved',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await api.annotations.createHighlight(book.id, h);
      const next = [h, ...highlights];
      setHighlights(next);
      rerenderAnnotations(next);
      adapterRef.current?.clearSelection();
      setSelection(null);
      setNoteMode(false);
    },
    [selection, book, highlights, rerenderAnnotations],
  );

  const updateHighlight = useCallback(
    async (h: Highlight): Promise<void> => {
      if (!book) return;
      const next = { ...h, updatedAt: Date.now() };
      await api.annotations.updateHighlight(book.id, next);
      setHighlights((prev) => prev.map((x) => (x.id === next.id ? next : x)));
      rerenderAnnotations(highlights.map((x) => (x.id === next.id ? next : x)));
    },
    [book, highlights, rerenderAnnotations],
  );

  const deleteHighlight = useCallback(
    async (id: string): Promise<void> => {
      if (!book) return;
      await api.annotations.deleteHighlight(book.id, id);
      const next = highlights.filter((h) => h.id !== id);
      setHighlights(next);
      adapterRef.current?.removeAnnotation(id);
    },
    [book, highlights],
  );

  const addBookmark = useCallback(async (): Promise<void> => {
    const ev = progressRef.current;
    if (!book || !ev) return;
    const b: Bookmark = {
      id: uuidv7(),
      bookId: book.id,
      anchor: {
        format: book.format,
        primary: ev.locator,
        textRange: null,
        position: { percent: ev.percent, chapter: ev.chapter ?? undefined },
      },
      label: ev.chapter ?? null,
      chapter: ev.chapter ?? null,
      createdAt: Date.now(),
    };
    await api.annotations.createBookmark(book.id, b);
    setBookmarks((prev) => [b, ...prev]);
    toast('bookmarked');
  }, [book, toast]);

  // ---- margin notes: thinking attached to the current place ----

  const createNoteAt = useCallback(
    async (body: string): Promise<void> => {
      const ev = progressRef.current;
      if (!book || !ev) return;
      const n: Note = {
        id: uuidv7(),
        bookId: book.id,
        anchor: {
          format: book.format,
          primary: ev.locator,
          textRange: null,
          position: { percent: ev.percent, chapter: ev.chapter ?? undefined },
        },
        body,
        chapter: ev.chapter ?? null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await api.annotations.createNote(book.id, n);
      setNotes((prev) => [n, ...prev]);
      toast('note saved');
    },
    [book, toast],
  );

  /* the question: a margin note that asks rather than asserts, anchored
   * to the passage under the reader's hand */
  const createQuestionNote = useCallback(
    async (body: string): Promise<void> => {
      const sel = selection;
      if (!sel || !book) return;
      const n: Note = {
        id: uuidv7(),
        bookId: book.id,
        anchor: sel.anchor,
        body,
        chapter: sel.chapter,
        question: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await api.annotations.createNote(book.id, n);
      setNotes((prev) => [n, ...prev]);
      setQuestionMode(false);
      setSelection(null);
      adapterRef.current?.clearSelection();
      toast('question kept');
    },
    [selection, book, toast],
  );

  /* collect: the passage enters the notebook with its place kept. if
   * the panel is closed (or on the marks tab), the quote rides the tab
   * switch and lands when the workbench mounts. */
  const collectSelection = useCallback((): void => {
    const sel = selection;
    if (!sel || !book) return;
    const ref: SourceRef = {
      quote: sel.text,
      locator: sel.anchor.primary,
      chapter: sel.chapter ?? null,
      highlightId: null,
      noteId: null,
    };
    setSelection(null);
    adapterRef.current?.clearSelection();
    if (notesOpen && notesTab === 'notebook' && wbRef.current) {
      wbRef.current.collect(ref);
    } else {
      setPendingCollect(ref);
      openNotes('notebook');
    }
  }, [selection, book, notesOpen, notesTab, openNotes]);

  const updateNote = useCallback(
    async (n: Note): Promise<void> => {
      if (!book) return;
      await api.annotations.updateNote(book.id, n);
      setNotes((prev) => prev.map((x) => (x.id === n.id ? n : x)));
    },
    [book],
  );

  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
      if (!book) return;
      await api.annotations.deleteNote(book.id, id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [book],
  );

  // ---- sticky notes (v0.3.1) ----

  const visibleStickies = useMemo(
    () => (book ? stickies.filter((s) => onVisiblePage(s.anchor, view, book.format)) : []),
    [stickies, view, book],
  );

  const createSticky = useCallback(
    (at?: { x: number; y: number }): void => {
      const ev = progressRef.current;
      if (!book || !ev) return;
      const s: StickyNote = {
        id: uuidv7(),
        bookId: book.id,
        anchor: pageAnchor(book, ev),
        body: '',
        color: 'yellow',
        x: at ? Math.min(at.x, 0.86) : 0.56,
        y: at ? Math.min(at.y, 0.8) : 0.18,
        chapter: ev.chapter ?? null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      void api.annotations.createSticky(book.id, s);
      setStickies((prev) => [...prev, s]);
    },
    [book],
  );

  /** selection → sticky: the paper lands where the hand was, in stage
   *  fractions (window coords → stage rect) */
  const stickyFromSelection = useCallback((): void => {
    const sel = selection;
    const stage = stageRef.current;
    let at: { x: number; y: number } | undefined;
    if (sel?.rect && stage) {
      const r = stage.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        at = {
          x: (sel.rect.x + sel.rect.w / 2 - r.left) / r.width,
          y: (sel.rect.y - r.top) / r.height - 0.06,
        };
      }
    }
    setSelection(null);
    adapterRef.current?.clearSelection();
    createSticky(at);
  }, [selection, createSticky]);

  const updateSticky = useCallback(
    (s: StickyNote): void => {
      if (!book) return;
      setStickies((prev) => prev.map((x) => (x.id === s.id ? s : x)));
      void api.annotations.updateSticky(book.id, s);
    },
    [book],
  );

  const deleteSticky = useCallback(
    (id: string): void => {
      if (!book) return;
      setStickies((prev) => prev.filter((s) => s.id !== id));
      void api.annotations.deleteSticky(book.id, id);
    },
    [book],
  );

  // ---- ink (v0.3.1) ----

  const visibleSketch = useMemo(
    () => (book ? sketches.find((k) => onVisiblePage(k.anchor, view, book.format)) ?? null : null),
    [sketches, view, book],
  );

  const commitStrokes = useCallback(
    (strokes: InkStroke[], sketchId: string | null): void => {
      const ev = progressRef.current;
      if (!book || !ev) return;
      let target = visibleSketch;
      if (!target || target.id !== sketchId) {
        if (sketchId) target = sketches.find((k) => k.id === sketchId) ?? null;
        if (!target) target = newSketch(book, pageAnchor(book, ev), ev.chapter ?? null);
      }
      const next: Sketch = { ...target, strokes, updatedAt: Date.now() };
      void api.annotations.saveSketch(book.id, next);
      setSketches((prev) => {
        const i = prev.findIndex((k) => k.id === next.id);
        return i === -1 ? [...prev, next] : prev.map((k) => (k.id === next.id ? next : k));
      });
    },
    [book, visibleSketch, sketches],
  );

  const undoStroke = useCallback((): void => {
    const k = visibleSketch;
    if (!k || k.strokes.length === 0) return;
    commitStrokes(k.strokes.slice(0, -1), k.id);
  }, [visibleSketch, commitStrokes]);

  const clearInk = useCallback((): void => {
    const k = visibleSketch;
    if (!book || !k) return;
    void api.annotations.deleteSketch(book.id, k.id);
    setSketches((prev) => prev.filter((x) => x.id !== k.id));
  }, [book, visibleSketch]);

  // ---- render ----

  if (error) {
    return (
      <div className="reader-error fade-in">
        <div className="type-title">this book won't open</div>
        <p className="meta-label">{error}</p>
        <Button onClick={goShelf}>
          <IconBack />
          back to the shelf
        </Button>
      </div>
    );
  }

  /* the notes panel's shared header — one instrument, two collections.
   * the marks tab carries the export (reading notes are marks); the
   * notebook's export rides its own documents. */
  const notesHeader = (
    <header className="drawer-head">
      <Tabs
        tabs={[
          { id: 'marks', label: 'marks' },
          { id: 'notebook', label: 'notebook' },
        ]}
        selected={notesTab}
        onSelect={(id) => setNotesTab(id as NotesTab)}
        label="notes"
      />
      <div className="row">
        {notesTab === 'marks' ? (
          <IconButton
            label="export reading notes"
            onClick={async () => {
              if (!book) return;
              const saved = await api.exportNotes.save(book.id);
              toast(saved ? 'reading notes saved' : 'export cancelled');
            }}
          >
            <IconDownload />
          </IconButton>
        ) : null}
        <IconButton label="close notes" onClick={closeNotes}>
          <IconX />
        </IconButton>
      </div>
    </header>
  );

  return (
    <div
      className="reader"
      data-format={book?.format ?? 'epub'}
      data-page-mode={settings.pageMode}
      style={{ '--ar-measure': `${settings.measure}px` } as CSSProperties}
    >
      <div className={`reader-chrome reader-chrome-top${chromeShown ? '' : ' chrome-faded'}`}>
        <IconButton label="back to the shelf" onClick={goShelf}>
          <IconBack />
        </IconButton>
        <div className="reader-title">
          <span className="reader-title-main display">{book?.title ?? ''}</span>
          <span className="meta-label">{book?.authors.join(', ') ?? ''}</span>
        </div>
        <div className="reader-actions">
          <IconButton
            label="pin a sticky note on this page"
            onClick={() => createSticky()}
          >
            <IconSticky />
          </IconButton>
          <IconButton
            label={drawMode ? 'stop drawing' : 'draw on the page'}
            aria-pressed={drawMode}
            onClick={() => setDrawMode((v) => !v)}
          >
            <IconPencil />
          </IconButton>
          <IconButton
            label="reading settings"
            onClick={() => {
              setTypeOpen((v) => !v);
              setTocOpen(false);
            }}
          >
            <IconType />
          </IconButton>
          <IconButton
            label="contents"
            onClick={() => {
              setTocOpen((v) => !v);
              setTypeOpen(false);
              if (!tocOpen) setTocTab('contents');
            }}
          >
            <IconToc />
          </IconButton>
          <IconButton
            label="bookmark list"
            onClick={() => {
              setTocOpen((v) => !v);
              setTypeOpen(false);
              if (!tocOpen) setTocTab('bookmarks');
            }}
          >
            <IconBookmark />
          </IconButton>
          <IconButton
            label="notes"
            aria-pressed={notesOpen}
            onClick={() => {
              if (notesOpen) closeNotes();
              else openNotes();
            }}
          >
            <IconNote />
          </IconButton>
        </div>
      </div>

      {/* the stage: the adapter's host + the page objects (stickies, ink)
       * as overlays. the reading column centers on the window; the layers
       * never claim the pointer until a note or the draw mode does. */}
      <div className="reader-stage" ref={stageRef}>
        <div className="reader-host" ref={hostRef} />
        {book && (
          <StickyLayer stickies={visibleStickies} onUpdate={updateSticky} onDelete={deleteSticky} />
        )}
        {book && (
          <InkLayer
            sketch={visibleSketch}
            active={drawMode}
            tool={drawTool}
            color={drawColor}
            onCommitStrokes={commitStrokes}
          />
        )}
        {drawMode && book && (
          <InkToolbar
            tool={drawTool}
            color={drawColor}
            onTool={setDrawTool}
            onColor={setDrawColor}
            onUndo={undoStroke}
            onClear={clearInk}
            onExit={() => setDrawMode(false)}
            canUndo={(visibleSketch?.strokes.length ?? 0) > 0}
          />
        )}
      </div>

      {book && notesOpen && notesTab === 'notebook' && (
        <Workbench
          ref={wbRef}
          book={book}
          kind="all"
          openDocId={workbenchDocId}
          onOpenDoc={setWorkbenchDoc}
          onJump={(loc) => void adapterRef.current?.jumpTo(loc)}
          onClose={closeNotes}
          toast={toast}
          pendingCollect={pendingCollect}
          onPendingConsumed={() => setPendingCollect(null)}
          header={notesHeader}
        />
      )}

      {book && notesOpen && notesTab === 'marks' && (
        <Notebook
          highlights={highlights}
          bookmarks={bookmarks}
          notes={notes}
          onJump={(h) => {
            if (h.anchor) void adapterRef.current?.jumpTo(h.anchor.primary);
          }}
          onJumpNote={(n) => {
            void adapterRef.current?.jumpTo(n.anchor.primary);
          }}
          onUpdate={(h) => void updateHighlight(h)}
          onDelete={(id) => void deleteHighlight(id)}
          onDeleteBookmark={(id) => {
            if (!book) return;
            void api.annotations.deleteBookmark(book.id, id);
            setBookmarks((prev) => prev.filter((b) => b.id !== id));
          }}
          onCreateNote={(body) => void createNoteAt(body)}
          onUpdateNote={(n) => void updateNote(n)}
          onDeleteNote={(id) => void deleteNote(id)}
          header={notesHeader}
          focusId={focusId}
        />
      )}

      {tocOpen && (
        <aside className="drawer drawer-left rise" aria-label="contents and bookmarks">
          <header className="drawer-head">
            <Tabs
              tabs={[
                { id: 'contents', label: 'contents' },
                { id: 'bookmarks', label: 'bookmarks' },
              ]}
              selected={tocTab}
              onSelect={(id) => setTocTab(id as 'contents' | 'bookmarks')}
              label="contents"
            />
            <IconButton label="close" onClick={() => setTocOpen(false)}>
              <IconX />
            </IconButton>
          </header>
          <div className="drawer-body">
            {tocTab === 'contents' ? (
              <>
                {isPdf && pdfPageCount > 0 && (
                  <div className="toc-jump">
                    <Input
                      className="toc-jump-input"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={pdfPageCount}
                      aria-label="go to page"
                      placeholder="page"
                      value={pageQuery}
                      onChange={(e) => setPageQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        const target = parsePageTarget(pageQuery || undefined, pdfPageCount);
                        void adapterRef.current?.display(`page:${target}`);
                        setPageQuery('');
                        setTocOpen(false);
                      }}
                    />
                    <span className="meta-label">
                      of {pdfPageCount} {pdfPageCount === 1 ? 'page' : 'pages'}
                    </span>
                  </div>
                )}
                {chapters.map((c) => (
                  <button
                    key={`${c.target}-${c.label}`}
                    className={`toc-item${c.label === chapter ? ' toc-current' : ''}${c.depth > 0 ? ' toc-child' : ''}`}
                    style={c.depth > 0 ? { paddingLeft: `calc(var(--s4) + ${c.depth} * var(--s2))` } : undefined}
                    onClick={() => {
                      void adapterRef.current?.display(c.target);
                      setTocOpen(false);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </>
            ) : (
              <>
                <button className="chip chip-add" onClick={() => void addBookmark()}>
                  <IconBookmark />
                  bookmark this place
                </button>
                {bookmarks.length === 0 && (
                  <div className="drawer-empty">
                    <div className="type-title">no bookmarks yet</div>
                    <p className="meta-label">ctrl+b drops one wherever you are</p>
                  </div>
                )}
                {[...bookmarks]
                  .sort((a, b) => (b.anchor.position?.percent ?? 0) - (a.anchor.position?.percent ?? 0))
                  .map((b) => (
                    <div key={b.id} className="note-card note-bookmark">
                      <div className="note-card-head">
                        <IconBookmark />
                        <span className="meta-label note-chapter">
                          {b.chapter ?? b.label ?? 'bookmark'}
                          {b.anchor.position?.percent !== undefined && b.anchor.position.percent !== null
                            ? ` · ${Math.round((b.anchor.position.percent ?? 0) * 100)}%`
                            : ''}
                        </span>
                      </div>
                      <div className="note-actions">
                        <button
                          className="sel-action"
                          onClick={() => {
                            void adapterRef.current?.jumpTo(b.anchor.primary);
                            setTocOpen(false);
                          }}
                        >
                          <IconChevronRight />
                          jump
                        </button>
                        <button
                          className="sel-action danger"
                          onClick={() => {
                            if (!book) return;
                            void api.annotations.deleteBookmark(book.id, b.id);
                            setBookmarks((prev) => prev.filter((x) => x.id !== b.id));
                          }}
                        >
                          <IconTrash />
                          remove
                        </button>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </aside>
      )}

      {typeOpen && (
        <TypographyPanel
          settings={settings}
          onSet={(partial) => setSettings(partial)}
          isPdf={!!isPdf}
          zoom={pdfZoom}
          onZoom={(z) => setPdfZoom(z)}
          onClose={() => setTypeOpen(false)}
        />
      )}

      {selection && !noteMode && !questionMode && (
        <SelectionMenu
          selection={selection}
          onColor={(c) => void createHighlight(c, null)}
          onNote={() => setNoteMode(true)}
          onQuestion={() => setQuestionMode(true)}
          onSticky={stickyFromSelection}
          onBookmark={() => {
            void createBookmarkFromSelection();
            setSelection(null);
          }}
          onCollect={() => collectSelection()}
          onClose={() => setSelection(null)}
        />
      )}

      {selection && noteMode && (
        <NoteComposer
          selection={selection}
          draftKey={`arivo.draft.selnote.${book?.id ?? 'x'}.${selection.anchor.primary}`}
          label="note on this passage"
          placeholder="what did it make you think?"
          saveLabel="save note"
          onSave={(note) => createHighlight('yellow', note)}
          onClose={() => {
            setNoteMode(false);
            setSelection(null);
          }}
        />
      )}

      {selection && questionMode && (
        <NoteComposer
          selection={selection}
          draftKey={`arivo.draft.selq.${book?.id ?? 'x'}.${selection.anchor.primary}`}
          label="question at this passage"
          placeholder="what do you want to find out?"
          saveLabel="keep question"
          onSave={(note) => createQuestionNote(note)}
          onClose={() => {
            setQuestionMode(false);
            setSelection(null);
          }}
        />
      )}

      <div className={`reader-chrome reader-chrome-bottom${chromeShown ? '' : ' chrome-faded'}`}>
        <span className="meta-label reader-chapter">{chapter}</span>
        <span className="meta-label">{Math.round(percent * 100)}%</span>
      </div>
      <div className="reader-progress-track" aria-hidden="true">
        <div className="reader-progress-fill" style={{ width: `${percent * 100}%` }} />
      </div>
    </div>
  );

  async function createBookmarkFromSelection(): Promise<void> {
    const sel = selection;
    if (!book || !sel) return;
    const b: Bookmark = {
      id: uuidv7(),
      bookId: book.id,
      anchor: {
        format: book.format,
        primary: sel.anchor.primary,
        textRange: null,
        position: sel.anchor.position ?? { chapter: sel.chapter ?? undefined },
      },
      label: sel.chapter ?? null,
      chapter: sel.chapter ?? null,
      createdAt: Date.now(),
    };
    await api.annotations.createBookmark(book.id, b);
    setBookmarks((prev) => [b, ...prev]);
    toast('bookmarked');
  }
}

function NoteComposer({
  selection,
  draftKey,
  label,
  placeholder,
  saveLabel,
  onSave,
  onClose,
}: {
  selection: SelectionInfo;
  draftKey: string;
  label: string;
  placeholder: string;
  saveLabel: string;
  onSave: (note: string) => Promise<void>;
  onClose: () => void;
}): ReactNode {
  /* the composer's persistence contract: keystrokes mirror to this
   * device, the store only sees a save the user asked for. a death
   * mid-compose resurrects as recovered on this same passage. */
  const draft = useDraft({
    key: draftKey,
    loadStore: async () => null,
    save: (t) => onSave(t),
    autoSave: false,
  });
  /* anchored to the passage, never clipping: above the selection when
   * there is room, below it when there is not — the composer is paper
   * tinted with the amber wash, the note's own color. */
  const HALF = 150;
  const cx = selection.rect
    ? selection.rect.x + selection.rect.w / 2
    : window.innerWidth / 2;
  const x = clampCenter(cx, HALF);
  const EST_H = 210;
  const aboveY = selection.rect ? selection.rect.y - EST_H - 12 : window.innerHeight / 2 - 120;
  const belowY = selection.rect ? selection.rect.y + (selection.rect.h || 24) + 12 : window.innerHeight / 2;
  const y = aboveY >= 60 ? aboveY : Math.min(belowY, window.innerHeight - EST_H - 60);
  return (
    <>
      <div className="menu-scrim" onMouseDown={onClose} />
      <div className="note-composer glass rise" style={{ left: x, top: y }}>
        <div className="meta-label">{label}</div>
        <blockquote className="note-text note-text-draft">{selection.text.slice(0, 140)}</blockquote>
        <textarea
          className="note-input"
          autoFocus
          value={draft.text}
          placeholder={placeholder}
          onChange={(e) => draft.edit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && draft.text.trim()) void draft.flush();
            if (e.key === 'Escape') {
              draft.discard();
              onClose();
            }
          }}
          rows={4}
        />
        <div className="note-composer-actions">
          <span className="meta-label" data-status={draft.status}>
            {draftStatusText(draft.status)}
          </span>
          <span className="meta-label">
            <Kbd>Ctrl</Kbd>
            <Kbd>↵</Kbd> save
          </span>
        </div>
        <div className="note-composer-actions">
          <Button variant="solid" onClick={() => void draft.flush()}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
