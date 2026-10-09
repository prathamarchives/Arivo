/**
 * the notebook (v0.3.3) — the book of you. the compounded record of
 * every learning: auto-generated pages from the annotation timeline,
 * your own written pages, and the links between them.
 *
 * you read books. the notebook reads you. every highlight, note, and
 * document arrives automatically — nothing is filed, nothing is
 * organized by hand. pages compose APPEND-ONLY (see
 * lib/notebook-compose.ts): a new capture lands at the tail, the old
 * pages never reflow, the page numbers are furniture. you turn through
 * your own mind.
 *
 * anatomy:
 *   the cover   the closed notebook — the a. mark, the stats, the door
 *   the pages   sheets of cards (quotes with citations, notes,
 *               documents) and written pages (your text + the pen)
 *   the links   the compounding: card ↔ card with the one-line reason
 *               written at link-time. chips on the cards; click a chip,
 *               jump to the other end.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AnnotationLink,
  ArchiveEntry,
  LinkRef,
  NotebookPage,
  SearchHit,
  Sketch,
} from '@arivo/core';
import { uuidv7 } from '@arivo/core';
import { IconButton, Button, Kbd } from '@arivo/ui';
import { api } from '../services/api.ts';
import { useRoom } from '../stores/room.ts';
import { useDraft } from '../lib/useDraft.ts';
import {
  composeSheets,
  findSheet,
  linksForSheet,
  linkKey,
  type EntryCard,
} from '../lib/notebook-compose.ts';
import { InkLayer, InkToolbar, type InkWidthStep } from './PageObjects.tsx';
import type { InkColor, InkTool } from '@arivo/core';
import {
  IconX,
  IconSearch,
  IconNote,
  IconBookmark,
  IconChevronRight,
  IconTrash,
  IconPlus,
  IconNotebook,
} from '../components/icons.tsx';
import { Wordmark } from '../components/Wordmark.tsx';

// ---------------- the cover ----------------

function Cover({ stats, onOpen }: { stats: { highlights: number; notes: number; pages: number; links: number }; onOpen: () => void }): ReactNode {
  return (
    <div className="notebook-cover-stage fade-in">
      <button type="button" className="notebook-cover rise" onClick={onOpen} aria-label="open the notebook">
        <div className="notebook-cover-mark">
          <Wordmark />
        </div>
        <div className="notebook-cover-title">the notebook</div>
        <div className="notebook-cover-stats meta-label">
          {stats.highlights} {stats.highlights === 1 ? 'highlight' : 'highlights'} ·{' '}
          {stats.notes} {stats.notes === 1 ? 'note' : 'notes'} · {stats.pages}{' '}
          {stats.pages === 1 ? 'written page' : 'written pages'} · {stats.links}{' '}
          {stats.links === 1 ? 'link' : 'links'}
        </div>
        <div className="notebook-cover-hint meta-label">click to open</div>
      </button>
    </div>
  );
}

// ---------------- one entry card ----------------

function Card({
  card,
  links,
  onOpen,
  onLink,
  onDeleteLink,
  onJumpLink,
}: {
  card: EntryCard;
  links: AnnotationLink[];
  onOpen: (e: ArchiveEntry) => void;
  onLink: (card: EntryCard) => void;
  onDeleteLink: (id: string) => void;
  onJumpLink: (ref: { kind: string; id: string }) => void;
}): ReactNode {
  const e = card.entry;
  return (
    <div className="notebook-card" data-kind={card.kind}>
      <button type="button" className="notebook-card-open" onClick={() => onOpen(e)}>
        {card.kind === 'highlight' && (
          <>
            <div className="notebook-card-head">
              <span className={`sel-dot sel-dot-${e.color}`} aria-hidden="true" />
              <span className="meta-label notebook-card-chapter">{e.chapter ?? ''}</span>
            </div>
            <blockquote className="notebook-card-quote">{e.text}</blockquote>
            {e.note ? <p className="notebook-card-note">{e.note}</p> : null}
          </>
        )}
        {card.kind === 'note' && (
          <>
            <div className="notebook-card-head">
              <IconNote />
              <span className="meta-label notebook-card-chapter">
                {e.question ? 'question · ' : ''}
                {e.chapter ?? 'margin note'}
              </span>
            </div>
            <p className="notebook-card-note notebook-card-note-own">{e.text}</p>
          </>
        )}
        {card.kind === 'deskdoc' && (
          <>
            <div className="notebook-card-head">
              <IconNotebook />
              <span className="meta-label notebook-card-chapter">{e.deskKind ?? 'document'}</span>
            </div>
            <div className="notebook-card-doc-title">{e.deskTitle || e.text.slice(0, 60)}</div>
            {e.deskBody ? <p className="notebook-card-note">{e.deskBody}</p> : null}
          </>
        )}
        <div className="notebook-card-source">
          <IconChevronRight />
          <span className="notebook-card-book">{e.bookTitle}</span>
        </div>
      </button>
      {links.length > 0 && (
        <div className="notebook-card-links">
          {links.map((l) => {
            const other = linkKey(l.from) === card.key ? l.to : l.from;
            return (
              <span key={l.id} className="notebook-link-chip">
                <button
                  type="button"
                  className="notebook-link-chip-open"
                  onClick={() => onJumpLink(other)}
                  aria-label={`follow link: ${l.reason}`}
                >
                  <IconBookmark />
                  <span className="notebook-link-reason">{l.reason}</span>
                </button>
                <button
                  type="button"
                  className="notebook-link-chip-x"
                  onClick={() => onDeleteLink(l.id)}
                  aria-label="remove this link"
                >
                  <IconX />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className="notebook-card-link-add sel-action"
        onClick={() => onLink(card)}
      >
        <IconBookmark />
        link
      </button>
    </div>
  );
}

// ---------------- the link composer ----------------

function LinkComposer({
  from,
  onClose,
  onSave,
}: {
  from: LinkRef;
  onClose: () => void;
  onSave: (l: AnnotationLink) => void;
}): ReactNode {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [target, setTarget] = useState<LinkRef | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    void api.notebook.get().then((n) => setPages(n.pages.filter((p) => p.id !== from.id || from.kind !== 'page')));
  }, [from]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length >= 2) void api.search.query(q.trim()).then(setHits);
      else setHits([]);
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  const localPages = useMemo(
    () =>
      pages.filter((p) =>
        q.trim().length === 0
          ? true
          : `${p.title ?? ''} ${p.body}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [pages, q],
  );

  const save = (): void => {
    if (!target || !reason.trim()) return;
    onSave({
      id: uuidv7(),
      from,
      to: target,
      reason: reason.trim(),
      createdAt: Date.now(),
    });
  };

  return (
    <>
      <div className="notebook-composer-scrim" onMouseDown={onClose} />
      <div className="notebook-composer glass rise" role="dialog" aria-label="link two thoughts">
        <div className="meta-label">link this to…</div>
        <input
          className="notebook-composer-search"
          value={q}
          placeholder="search your highlights, notes, pages…"
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          aria-label="search annotations to link"
        />
        <div className="notebook-composer-results">
          {hits
            .filter((h) => h.kind === 'highlight' || h.kind === 'note')
            .map((h) => (
              <button
                key={`hl-${h.id}`}
                type="button"
                className={`notebook-composer-hit${target?.id === h.id && target.kind === 'highlight' ? ' is-target' : ''}`}
                onClick={() => setTarget({ kind: 'highlight', id: h.id })}
              >
                <span className="notebook-composer-hit-title">{h.title}</span>
                <span className="meta-label">{h.context ?? ''}</span>
              </button>
            ))}
          {localPages.map((p) => (
            <button
              key={`pg-${p.id}`}
              type="button"
              className={`notebook-composer-hit${target?.id === p.id && target.kind === 'page' ? ' is-target' : ''}`}
              onClick={() => setTarget({ kind: 'page', id: p.id })}
            >
              <span className="notebook-composer-hit-title">{p.title || p.body.slice(0, 60) || 'a written page'}</span>
              <span className="meta-label">your page</span>
            </button>
          ))}
          {hits.length === 0 && localPages.length === 0 && q.trim().length >= 2 && (
            <div className="notebook-composer-empty meta-label">nothing found</div>
          )}
        </div>
        <input
          className="notebook-composer-reason"
          value={reason}
          placeholder="why are these the same thought? one line…"
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && target && reason.trim()) save();
            if (e.key === 'Escape') onClose();
          }}
          aria-label="the reason for this link"
        />
        <div className="notebook-composer-actions">
          <span className="meta-label">
            <Kbd>↵</Kbd> ties the thread
          </span>
          <Button variant="solid" disabled={!target || !reason.trim()} onClick={save}>
            link
          </Button>
        </div>
      </div>
    </>
  );
}

// ---------------- the written page (view + edit) ----------------

function WrittenPage({
  page,
  editing,
  onEdit,
  onSave,
  onDelete,
}: {
  page: NotebookPage;
  editing: boolean;
  onEdit: () => void;
  onSave: (p: NotebookPage) => void;
  onDelete: (id: string) => void;
}): ReactNode {
  /* user text rides the draft engine — the mirror law (never lose a
   * keystroke, never save what was not asked for) */
  const draft = useDraft({
    key: `arivo.draft.notebook.${page.id}`,
    loadStore: async () => page.body,
    save: async (t) => onSave({ ...page, body: t, updatedAt: Date.now() }),
    autoSave: false,
  });
  const [titleDraft, setTitleDraft] = useState(page.title ?? '');

  return (
    <div className="notebook-written">
      {editing ? (
        <>
          <input
            className="notebook-written-title-input"
            value={titleDraft}
            placeholder="title…"
            onChange={(e) => setTitleDraft(e.target.value)}
            aria-label="page title"
          />
          <textarea
            className="notebook-written-input"
            value={draft.text}
            placeholder="write…"
            autoFocus
            onChange={(e) => draft.edit(e.target.value)}
            rows={10}
          />
          <div className="notebook-written-foot">
            <span className="meta-label" data-status={draft.status}>
              ctrl+enter saves
            </span>
            <Button
              variant="solid"
              onClick={() => {
                onSave({
                  ...page,
                  title: titleDraft.trim() || null,
                  body: draft.text,
                  updatedAt: Date.now(),
                });
              }}
            >
              save page
            </Button>
          </div>
        </>
      ) : (
        <>
          {page.title ? <div className="notebook-written-title">{page.title}</div> : null}
          {page.body ? (
            <div className="notebook-written-body">{page.body}</div>
          ) : (
            <div className="notebook-written-empty meta-label">a blank page — yours</div>
          )}
          <div className="notebook-written-tools">
            <button type="button" className="sel-action" onClick={onEdit}>
              <IconNote />
              write
            </button>
            <button type="button" className="sel-action danger" onClick={() => onDelete(page.id)}>
              <IconTrash />
              remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- the notebook screen ----------------

export function NotebookScreen(): ReactNode {
  const closeNotebook = useRoom((s) => s.closeNotebook);
  const goDesk = useRoom((s) => s.goDesk);
  const toast = useRoom((s) => s.toast);

  const [phase, setPhase] = useState<'cover' | 'pages'>('cover');
  const [feed, setFeed] = useState<ArchiveEntry[] | null>(null);
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [links, setLinks] = useState<AnnotationLink[]>([]);
  const [current, setCurrent] = useState(0);
  const [search, setSearch] = useState('');
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<LinkRef | null>(null);
  /* the write-in pen (the pencil family, reused on notebook paper) */
  const [pageInk, setPageInk] = useState<{ pageId: string } | null>(null);
  const [inkTool, setInkTool] = useState<InkTool>('pencil');
  const [inkColor, setInkColor] = useState<InkColor>('ink');
  const [inkWidth, setInkWidth] = useState<InkWidthStep>(1);
  const paperRef = useRef<HTMLDivElement | null>(null);

  /* boot: the feed + the notebook's own truth */
  useEffect(() => {
    let disposed = false;
    void Promise.all([api.archive.marks(), api.notebook.get()]).then(([f, n]) => {
      if (disposed) return;
      setFeed(f);
      setPages(n.pages);
      setLinks(n.links);
      setCurrent(n.state.currentPage);
    });
    return () => {
      disposed = true;
    };
  }, []);

  const sheets = useMemo(() => (feed ? composeSheets(feed, pages) : []), [feed, pages]);
  const sheet = sheets[current] ?? null;
  const sheetLinks = useMemo(() => (sheet ? linksForSheet(links, sheet) : []), [links, sheet]);

  /* where you left off persists — quietly */
  useEffect(() => {
    if (phase !== 'pages' || sheets.length === 0) return;
    void api.notebook.setPage(Math.min(current, sheets.length - 1));
  }, [current, sheets.length, phase]);

  const turn = useCallback(
    (dir: 1 | -1): void => {
      setCurrent((c) => Math.min(Math.max(c + dir, 0), Math.max(sheets.length - 1, 0)));
    },
    [sheets.length],
  );

  /* keyboard: the notebook owns the keys while it is open */
  useEffect(() => {
    if (!useRoom.getState().notebookOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (e.key === 'Escape') {
        if (linkFrom) setLinkFrom(null);
        else if (editingPageId || pageInk) {
          setEditingPageId(null);
          setPageInk(null);
        } else if (phase === 'pages') setPhase('cover');
        else closeNotebook();
        return;
      }
      if (typing) return;
      if (e.key === 'ArrowRight') turn(1);
      if (e.key === 'ArrowLeft') turn(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [linkFrom, editingPageId, pageInk, phase, turn, closeNotebook]);

  const jumpToLink = useCallback(
    (ref: { kind: string; id: string }): void => {
      const key = linkKey(ref as LinkRef);
      const idx = sheets.findIndex((s) => s.firstKey === key || s.lastKey === key || s.cards.some((c) => c.key === key));
      if (idx === -1) {
        toast('the other end of this thread is not in the notebook yet');
        return;
      }
      setCurrent(idx);
    },
    [sheets, toast],
  );

  const openSource = useCallback(
    (e: ArchiveEntry): void => {
      closeNotebook();
      goDesk(e.bookId, e.anchor.primary, e.kind === 'highlight' ? e.id : null);
    },
    [closeNotebook, goDesk],
  );

  const savePage = useCallback((p: NotebookPage): void => {
    void api.notebook.savePage(p);
    setPages((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      return i === -1 ? [...prev, p] : prev.map((x) => (x.id === p.id ? p : x));
    });
    setEditingPageId(null);
  }, []);

  const deletePage = useCallback((id: string): void => {
    void api.notebook.deletePage(id);
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const newPage = useCallback((): void => {
    const p: NotebookPage = {
      id: uuidv7(),
      title: null,
      body: '',
      strokes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    void api.notebook.savePage(p);
    setPages((prev) => [...prev, p]);
    setPhase('pages');
    setCurrent(sheets.length);
    setEditingPageId(p.id);
  }, [sheets.length]);

  const saveLink = useCallback((l: AnnotationLink): void => {
    void api.notebook.saveLink(l);
    setLinks((prev) => [...prev, l]);
    setLinkFrom(null);
    toast('linked');
  }, [toast]);

  const deleteLink = useCallback(
    (id: string): void => {
      void api.notebook.deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast('link removed');
    },
    [toast],
  );

  const doSearch = useCallback((): void => {
    const idx = findSheet(sheets, search);
    if (idx === -1) {
      toast('nothing in the notebook matches');
      return;
    }
    setPhase('pages');
    setCurrent(idx);
  }, [sheets, search, toast]);

  const stats = useMemo(
    () => ({
      highlights: feed?.filter((e) => e.kind === 'highlight').length ?? 0,
      notes: feed?.filter((e) => e.kind === 'note').length ?? 0,
      pages: pages.length,
      links: links.length,
    }),
    [feed, pages, links],
  );

  const open = useRoomVisible();
  if (!open) return null;

  const editingSheet = sheet?.kind === 'freeform' ? sheet.page : null;
  const inkActive =
    pageInk !== null &&
    editingSheet !== null &&
    pageInk.pageId === editingSheet.id &&
    sheet?.kind === 'freeform';

  return (
    <div className="notebook-surface" role="dialog" aria-label="the notebook">
      {phase === 'cover' ? (
        <Cover stats={stats} onOpen={() => setPhase('pages')} />
      ) : (
        <>
          <header className="notebook-head">
            <button type="button" className="notebook-head-title" onClick={() => setPhase('cover')}>
              the notebook
            </button>
            <div className="notebook-head-search">
              <IconSearch />
              <input
                value={search}
                placeholder="search the notebook…"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') doSearch();
                }}
                aria-label="search the notebook"
              />
            </div>
            <div className="row">
              <IconButton label="write a page" onClick={newPage}>
                <IconPlus />
              </IconButton>
              <IconButton label="close the notebook" onClick={closeNotebook}>
                <IconX />
              </IconButton>
            </div>
          </header>

          <div className="notebook-book" ref={paperRef}>
            {feed === null ? (
              <div className="notebook-empty meta-label">binding the pages…</div>
            ) : sheets.length === 0 ? (
              <div className="notebook-empty">
                <div className="type-title">the notebook is empty</div>
                <p className="meta-label">
                  highlight a passage while reading — it lands here, with its source.
                  or write the first page.
                </p>
                <Button onClick={newPage}>
                  <IconPlus />
                  write the first page
                </Button>
              </div>
            ) : (
              <>
                {current > 0 && (
                  <button
                    type="button"
                    className="notebook-edge notebook-edge-prev"
                    onClick={() => turn(-1)}
                    aria-label="previous page"
                  >
                    <IconChevronRight />
                  </button>
                )}
                <div className="notebook-sheet" key={sheet?.key}>
                  <div className="notebook-sheet-head">
                    <span className="meta-label">{sheet?.dateLabel}</span>
                    <span className="meta-label">
                      page {current + 1} of {sheets.length}
                    </span>
                  </div>
                  <div className="notebook-sheet-body">
                    {sheet?.kind === 'auto' && (
                      <div className="notebook-cards">
                        {sheet.cards.map((card) => {
                          const cardLinks = sheetLinks.filter(
                            (l) => linkKey(l.from) === card.key || linkKey(l.to) === card.key,
                          );
                          return (
                            <Card
                              key={card.key}
                              card={card}
                              links={cardLinks}
                              onOpen={openSource}
                              onLink={(c) => setLinkFrom({ kind: c.kind, id: c.entry.id })}
                              onDeleteLink={deleteLink}
                              onJumpLink={jumpToLink}
                            />
                          );
                        })}
                      </div>
                    )}
                    {sheet?.kind === 'freeform' && editingSheet && (
                      <div className="notebook-paper">
                        <WrittenPage
                          page={editingSheet}
                          editing={editingPageId === editingSheet.id}
                          onEdit={() => setEditingPageId(editingSheet.id)}
                          onSave={savePage}
                          onDelete={deletePage}
                        />
                        {inkActive && editingSheet && (
                          <InkLayer
                            sketch={pageAsSketch(editingSheet)}
                            active
                            tool={inkTool}
                            color={inkColor}
                            widthStep={inkWidth}
                            onCommitStrokes={(strokes) => savePage({ ...editingSheet, strokes, updatedAt: Date.now() })}
                          />
                        )}
                        {pageInk?.pageId === editingSheet.id && (
                          <InkToolbar
                            tool={inkTool}
                            color={inkColor}
                            widthStep={inkWidth}
                            onTool={setInkTool}
                            onColor={setInkColor}
                            onWidth={setInkWidth}
                            onUndo={() => {
                              if (!editingSheet) return;
                              savePage({
                                ...editingSheet,
                                strokes: editingSheet.strokes.slice(0, -1),
                                updatedAt: Date.now(),
                              });
                            }}
                            onClear={() => savePage({ ...editingSheet, strokes: [], updatedAt: Date.now() })}
                            onExit={() => setPageInk(null)}
                            canUndo={editingSheet.strokes.length > 0}
                          />
                        )}
                        <div className="notebook-paper-tools">
                          <button
                            type="button"
                            className="sel-action"
                            onClick={() =>
                              setPageInk(pageInk?.pageId === editingSheet.id ? null : { pageId: editingSheet.id })
                            }
                            aria-pressed={inkActive}
                          >
                            draw
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {current < sheets.length - 1 && (
                  <button
                    type="button"
                    className="notebook-edge notebook-edge-next"
                    onClick={() => turn(1)}
                    aria-label="next page"
                  >
                    <IconChevronRight />
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {linkFrom && (
        <LinkComposer from={linkFrom} onClose={() => setLinkFrom(null)} onSave={saveLink} />
      )}
    </div>
  );
}

/* small adapters kept out of the render path */

/** a NotebookPage wears a Sketch's clothes for the InkLayer (same
 *  strokes, an id, honest placeholders for the fields it never uses) */
function pageAsSketch(p: NotebookPage): Sketch {
  return {
    id: p.id,
    bookId: 'notebook',
    anchor: { format: 'epub', primary: `notebook:${p.id}`, textRange: null, position: null },
    strokes: p.strokes,
    chapter: null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** a tiny subscribe shim so the dialog re-renders when the room opens it */
function useRoomVisible(): boolean {
  const [visible, setVisible] = useState(useRoom.getState().notebookOpen);
  useEffect(() => {
    const unsub = useRoom.subscribe((s) => {
      setVisible(s.notebookOpen);
    });
    return unsub;
  }, []);
  return visible;
}
