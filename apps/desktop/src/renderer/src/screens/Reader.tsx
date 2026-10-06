import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AnnotationView,
  Bookmark,
  BookWithProgress,
  FormatReaderHooks,
  Highlight,
  HighlightColor,
  RelocatedEvent,
  SelectionInfo,
  FormatReader,
  ReaderSettings,
} from '@arivo/core';
import { uuidv7, FONT_STEPS } from '@arivo/core';
import { EpubAdapter, PdfAdapter, type PdfAnchorData } from '@arivo/reader';
import { IconButton, Button, Kbd } from '@arivo/ui';
import { api } from '../services/api.ts';
import { BOOK_FONT_FACE_CSS } from '../lib/book-fonts.ts';
import { useSettings } from '../stores/settings.ts';
import { useUi } from '../stores/ui.ts';
import { useLibrary } from '../stores/library.ts';
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

// ---------------- selection menu ----------------

function SelectionMenu({
  selection,
  onColor,
  onNote,
  onBookmark,
  onClose,
}: {
  selection: SelectionInfo;
  onColor: (color: HighlightColor) => void;
  onNote: () => void;
  onBookmark: () => void;
  onClose: () => void;
}): ReactNode {
  const x = selection.rect ? Math.min(Math.max(selection.rect.x + selection.rect.w / 2, 90), window.innerWidth - 90) : window.innerWidth / 2;
  const y = selection.rect ? Math.max(selection.rect.y - 56, 60) : window.innerHeight / 2 - 60;
  return (
    <>
      <div className="menu-scrim" onMouseDown={onClose} />
      <div className="selection-menu glass rise" style={{ left: x, top: y }} role="menu">
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
        <button className="sel-action" onClick={onNote}>
          <IconNote />
          note
        </button>
        <button className="sel-action" onClick={onBookmark}>
          <IconBookmark />
          bookmark
        </button>
        <button
          className="sel-action"
          onClick={() => {
            void navigator.clipboard?.writeText(selection.text);
            onClose();
          }}
        >
          <IconDownload />
          copy
        </button>
      </div>
    </>
  );
}

// ---------------- notebook ----------------

function Notebook({
  book,
  highlights,
  bookmarks,
  onJump,
  onUpdate,
  onDelete,
  onDeleteBookmark,
  onClose,
  focusId,
}: {
  book: BookWithProgress;
  highlights: Highlight[];
  bookmarks: Bookmark[];
  onJump: (h: Highlight) => void;
  onUpdate: (h: Highlight) => void;
  onDelete: (id: string) => void;
  onDeleteBookmark: (id: string) => void;
  onClose: () => void;
  focusId: string | null;
}): ReactNode {
  const toast = useUi((s) => s.toast);
  const [noteDraft, setNoteDraft] = useState<{ id: string; body: string } | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <aside className="drawer drawer-right rise" aria-label="notebook">
      <header className="drawer-head">
        <span className="meta-label">
          notebook · {highlights.length} highlights · {bookmarks.length} bookmarks
        </span>
        <div className="row">
          <IconButton label="export reading notes" onClick={async () => {
            const saved = await api.exportNotes.save(book.id);
            toast(saved ? 'reading notes saved' : 'export cancelled');
          }}>
            <IconDownload />
          </IconButton>
          <IconButton label="close notebook" onClick={onClose}>
            <IconX />
          </IconButton>
        </div>
      </header>
      <div className="drawer-body">
        {sorted.length === 0 && bookmarks.length === 0 && (
          <div className="drawer-empty">
            <div className="display">nothing marked yet</div>
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
              <span className="meta-label note-chapter">{b.chapter ?? b.label ?? 'bookmark'}</span>
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
      </div>
    </aside>
  );
}

// ---------------- typography panel ----------------

function TypographyPanel({
  settings,
  onSet,
  isPdf,
  onZoom,
  onClose,
}: {
  settings: ReaderSettings;
  onSet: (partial: Partial<ReaderSettings>) => void;
  isPdf: boolean;
  onZoom: (z: 'fit-width' | 'fit-page' | '100%') => void;
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
        </>
      )}
      {isPdf && (
        <>
          <div className="meta-label type-label">zoom</div>
          <div className="type-flow">
            <button className="chip" onClick={() => onZoom('fit-width')}>
              <IconFitWidth /> fit width
            </button>
            <button className="chip" onClick={() => onZoom('fit-page')}>
              <IconFitPage /> fit page
            </button>
            <button className="chip" onClick={() => onZoom('100%')}>
              100%
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- the reader screen ----------------

export function ReaderScreen({ bookId }: { bookId: string }): ReactNode {
  const backToLibrary = useUi((s) => s.backToLibrary);
  const toast = useUi((s) => s.toast);
  const refresh = useLibrary((s) => s.refresh);
  const { settings, set: setSettings } = useSettings();

  const [book, setBook] = useState<BookWithProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [chapter, setChapter] = useState('');
  const [chromeShown, setChromeShown] = useState(true);
  const [chapters, setChapters] = useState<{ label: string; target: string }[]>([]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<FormatReader | null>(null);
  const sessionRef = useRef<string | null>(null);
  const progressRef = useRef<RelocatedEvent | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
            setPercent(e.percent);
            setChapter(e.chapter ?? '');
            persistProgress(false);
          },
          onSelection: (s) => {
            setSelection(s);
            if (s) setChromeShown(true);
          },
          onAnnotationClick: (id) => {
            setNotebookOpen(true);
            setFocusId(id);
          },
        };

        const adapter =
          book.format === 'pdf'
            ? new PdfAdapter(hooks)
            : new EpubAdapter(hooks);
        adapterRef.current = adapter;
        adapter.setFontFace(BOOK_FONT_FACE_CSS);

        await adapter.open(host, bytes);
        if (disposed) return;
        adapter.applySettings(readerSettingsRef.current);
        setChapters(adapter.getChapters().map((c) => ({ label: c.label, target: c.target })));

        // annotations + the drift pass
        const { highlights, bookmarks } = await api.annotations.list(bookId);
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
        rerenderAnnotations(final);

        const startPercent = book.progress?.percent ?? 0;
        const session = await api.sessions.begin(bookId, startPercent);
        sessionRef.current = session;

        await adapter.display(book.progress?.locator ?? undefined);
      } catch (err) {
        if (!disposed) {
          console.error(err);
          setError(err instanceof Error ? err.message : 'the book failed to open');
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

  // ---- chrome fade: the text is the interface ----
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const nearTop = e.clientY < 72;
      const nearBottom = e.clientY > window.innerHeight - 84;
      const engaged = selection || notebookOpen || tocOpen || typeOpen;
      if (nearTop || nearBottom || engaged) {
        setChromeShown(true);
        if (idleTimer.current) clearTimeout(idleTimer.current);
        if (!engaged) {
          idleTimer.current = setTimeout(() => setChromeShown(false), 2800);
        }
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [selection, notebookOpen, tocOpen, typeOpen]);

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing) return;
      const adapter = adapterRef.current;
      if (!adapter) return;
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
          if (!isPdf) setSettings({ fontStep: Math.min(FONT_STEPS.length - 1, settings.fontStep + 1) });
          break;
        case '-':
          if (!isPdf) setSettings({ fontStep: Math.max(0, settings.fontStep - 1) });
          break;
        case 'b':
        case 'B':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            void addBookmark();
          }
          break;
        case 'Escape':
          if (tocOpen || typeOpen) {
            setTocOpen(false);
            setTypeOpen(false);
          } else if (selection) {
            setSelection(null);
            setNoteMode(false);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPdf, settings.fontStep, tocOpen, typeOpen, selection, percent, chapter]);

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
    adapterRef.current?.clearSelection();
    setSelection(null);
    toast('bookmarked');
  }, [book, toast]);

  if (error) {
    return (
      <div className="reader-error fade-in">
        <div className="display">this book won't open</div>
        <p className="meta-label">{error}</p>
        <Button onClick={backToLibrary}>
          <IconBack />
          back to library
        </Button>
      </div>
    );
  }

  return (
    <div className="reader" data-format={book?.format ?? 'epub'}>
      <div className={`reader-chrome reader-chrome-top${chromeShown ? '' : ' chrome-faded'}`}>
        <IconButton label="back to library" onClick={backToLibrary}>
          <IconBack />
        </IconButton>
        <div className="reader-title">
          <span className="reader-title-main display">{book?.title ?? ''}</span>
          <span className="meta-label">{book?.authors.join(', ') ?? ''}</span>
        </div>
        <div className="reader-actions">
          {isPdf && (
            <IconButton label="zoom" onClick={() => setTypeOpen(true)}>
              <IconType />
            </IconButton>
          )}
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
            }}
          >
            <IconToc />
          </IconButton>
          <IconButton label="bookmark this position" onClick={() => void addBookmark()}>
            <IconBookmark />
          </IconButton>
          <IconButton
            label="notebook"
            onClick={() => {
              setNotebookOpen((v) => !v);
              setFocusId(null);
            }}
          >
            <IconNote />
          </IconButton>
        </div>
      </div>

      <div className="reader-host" ref={hostRef} />

      {book && notebookOpen && (
        <Notebook
          book={book}
          highlights={highlights}
          bookmarks={bookmarks}
          onJump={(h) => {
            if (h.anchor) void adapterRef.current?.jumpTo(h.anchor.primary);
          }}
          onUpdate={(h) => void updateHighlight(h)}
          onDelete={(id) => void deleteHighlight(id)}
          onDeleteBookmark={(id) => {
            if (!book) return;
            void api.annotations.deleteBookmark(book.id, id);
            setBookmarks((prev) => prev.filter((b) => b.id !== id));
          }}
          onClose={() => setNotebookOpen(false)}
          focusId={focusId}
        />
      )}

      {tocOpen && (
        <aside className="drawer drawer-left rise" aria-label="contents">
          <header className="drawer-head">
            <span className="meta-label">contents</span>
            <IconButton label="close contents" onClick={() => setTocOpen(false)}>
              <IconX />
            </IconButton>
          </header>
          <div className="drawer-body">
            {chapters.map((c) => (
              <button
                key={c.target}
                className={`toc-item${c.label === chapter ? ' toc-current' : ''}`}
                onClick={() => {
                  void adapterRef.current?.display(c.target);
                  setTocOpen(false);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </aside>
      )}

      {typeOpen && (
        <TypographyPanel
          settings={settings}
          onSet={(partial) => setSettings(partial)}
          isPdf={!!isPdf}
          onZoom={(z) => {
            const pdf = adapterRef.current as PdfAdapter | null;
            if (pdf?.setZoom) pdf.setZoom(z === '100%' ? 1 : z);
          }}
          onClose={() => setTypeOpen(false)}
        />
      )}

      {selection && !noteMode && (
        <SelectionMenu
          selection={selection}
          onColor={(c) => void createHighlight(c, null)}
          onNote={() => setNoteMode(true)}
          onBookmark={() => {
            void createBookmarkFromSelection();
            setSelection(null);
          }}
          onClose={() => setSelection(null)}
        />
      )}

      {selection && noteMode && (
        <NoteComposer
          selection={selection}
          onSave={(note) => void createHighlight('yellow', note)}
          onClose={() => {
            setNoteMode(false);
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
  onSave,
  onClose,
}: {
  selection: SelectionInfo;
  onSave: (note: string) => void;
  onClose: () => void;
}): ReactNode {
  const [body, setBody] = useState('');
  const x = selection.rect
    ? Math.min(Math.max(selection.rect.x + selection.rect.w / 2, 160), window.innerWidth - 160)
    : window.innerWidth / 2;
  const y = selection.rect ? Math.max(selection.rect.y - 140, 64) : window.innerHeight / 2 - 120;
  return (
    <>
      <div className="menu-scrim" onMouseDown={onClose} />
      <div className="note-composer glass rise" style={{ left: x, top: y }}>
        <div className="meta-label">note on this passage</div>
        <blockquote className="note-text note-text-draft">{selection.text.slice(0, 140)}</blockquote>
        <textarea
          className="note-input"
          autoFocus
          value={body}
          placeholder="what did it make you think?"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSave(body.trim());
            if (e.key === 'Escape') onClose();
          }}
          rows={4}
        />
        <div className="note-composer-actions">
          <span className="meta-label">
            <Kbd>Ctrl</Kbd>
            <Kbd>↵</Kbd> save
          </span>
          <Button variant="solid" onClick={() => onSave(body.trim())}>
            save note
          </Button>
        </div>
      </div>
    </>
  );
}
