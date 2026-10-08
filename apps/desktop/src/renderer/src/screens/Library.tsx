import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import type { BookWithProgress } from '@arivo/core';
import { platform, api } from '../services/api.ts';
import { useLibrary, type SortMode } from '../stores/library.ts';
import { useSettings } from '../stores/settings.ts';
import { useRoom } from '../stores/room.ts';
import { IconButton, Button, Input, Kbd, BookObject, type BookAura } from '@arivo/ui';
import { computeAura, applyRoomAura } from '../lib/booklight.ts';
import {
  IconSearch,
  IconPlus,
  IconGrid,
  IconList,
  IconSun,
  IconLamp,
  IconMoon,
  IconDots,
  IconTrash,
  IconDownload,
  IconCollection,
  IconBook,
  IconCheck,
} from '../components/icons.tsx';

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** the shelf's canonical object — the book as an object, never a card.
 *  one system (BookObject), the grid's zoom is recorded geometry. */
function ShelfObject({
  book,
  current,
  aura,
  openingId,
  selectionMode,
  selected,
  onOpen,
  onMenu,
  size = 'md',
}: {
  book: BookWithProgress;
  current?: boolean;
  aura?: BookAura;
  openingId: string | null;
  selectionMode?: boolean;
  selected?: boolean;
  onOpen: (
    book: BookWithProgress,
    e?: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  ) => void;
  onMenu: (book: BookWithProgress, x: number, y: number) => void;
  size?: 'md' | 'sm';
}): ReactNode {
  return (
    <BookObject
      title={book.title}
      author={book.authors.join(', ') || undefined}
      cover={
        platform === 'electron' && book.coverPath ? api.book.coverUrl(book.id) : undefined
      }
      progress={book.progress?.percent ?? undefined}
      format={book.format}
      missing={book.fileMissing}
      current={current}
      aura={aura}
      opening={openingId === book.id}
      selectionMode={selectionMode}
      selected={selected}
      size={size}
      onOpen={(e) => onOpen(book, e)}
      onActions={(x, y) => onMenu(book, x, y)}
    />
  );
}

/** the list view: a ledger camera over the same library — the spine,
 *  not a second card system. same identity inks, same states. */
function BookRow({
  book,
  onMenu,
}: {
  book: BookWithProgress;
  onMenu: (book: BookWithProgress, x: number, y: number) => void;
}): ReactNode {
  const goDesk = useRoom((s) => s.goDesk);
  const [broken, setBroken] = useState(false);
  const showImg = platform === 'electron' && book.coverPath && !broken;
  const pct = book.progress ? Math.round(book.progress.percent * 100) : 0;
  return (
    <div
      className="book-row"
      role="button"
      tabIndex={0}
      onClick={() => goDesk(book.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') goDesk(book.id);
      }}
    >
      <span className="row-cover" aria-hidden="true">
        {showImg ? (
          <img src={api.book.coverUrl(book.id)} alt="" loading="lazy" onError={() => setBroken(true)} />
        ) : null}
        {book.format === 'pdf' && <span className="bo-badge">PDF</span>}
        {book.fileMissing && <span className="bo-badge bo-badge-missing">missing</span>}
      </span>
      <div className="book-row-title">
        <span className="book-title">{book.title}</span>
        <span className="book-author">{book.authors.join(', ') || '—'}</span>
      </div>
      <div className="book-row-progress">{pct > 0 ? `${pct}%` : fmtDate(book.addedAt)}</div>
      <button
        className="book-menu"
        aria-label="book actions"
        onClick={(e) => {
          e.stopPropagation();
          onMenu(book, e.clientX, e.clientY);
        }}
      >
        <IconDots />
      </button>
    </div>
  );
}

function BookMenu({
  book,
  x,
  y,
  onClose,
}: {
  book: BookWithProgress;
  x: number;
  y: number;
  onClose: () => void;
}): ReactNode {
  const { collections, assign, removeBook } = useLibrary();
  const toast = useRoom((s) => s.toast);
  const [confirm, setConfirm] = useState(false);
  const style = {
    left: Math.min(x, window.innerWidth - 260),
    top: Math.min(y, window.innerHeight - 320),
  };
  return (
    <>
      <div className="menu-scrim" onClick={onClose} />
      <div className="menu glass rise" style={style} role="menu">
        <div className="meta-label menu-head">add to</div>
        {collections.length === 0 && <div className="menu-empty">no collections yet</div>}
        {collections.map(({ collection, count }) => (
          <button
            key={collection.id}
            className="menu-item"
            onClick={() => {
              void assign(collection.id, book.id);
              toast(`added to ${collection.name} (${count + 1})`);
              onClose();
            }}
          >
            <IconCollection />
            {collection.name}
          </button>
        ))}
        <div className="menu-sep" />
        <button
          className="menu-item"
          onClick={async () => {
            const saved = await api.exportNotes.save(book.id);
            toast(saved ? 'reading notes saved' : 'export cancelled');
            onClose();
          }}
        >
          <IconDownload />
          export reading notes
        </button>
        {!confirm ? (
          <button className="menu-item danger" onClick={() => setConfirm(true)}>
            <IconTrash />
            remove from library…
          </button>
        ) : (
          <>
            <button
              className="menu-item danger"
              onClick={async () => {
                await removeBook(book.id, false);
                toast('removed — files kept');
                onClose();
              }}
            >
              remove, keep files
            </button>
            <button
              className="menu-item danger"
              onClick={async () => {
                await removeBook(book.id, true);
                toast('removed with files');
                onClose();
              }}
            >
              remove and delete files
            </button>
          </>
        )}
      </div>
    </>
  );
}

function EmptyState(): ReactNode {
  const importDialog = useLibrary((s) => s.importDialog);
  const toast = useRoom((s) => s.toast);
  return (
    <div className="empty-state fade-in">
      {/* the room is waiting: the shelf line exists, one object's place
       * is sunken into it — absence with a shape, not "no items found" */}
      <div className="empty-shelf" aria-hidden="true">
        <span className="empty-shelf-ghost" />
      </div>
      <h1 className="type-title">your shelf is waiting</h1>
      <p className="empty-sub">
        drop epubs or pdfs anywhere on this page, or pick a folder.
        <br />
        arivo keeps them as files — yours, browsable, portable.
      </p>
      <Button
        variant="solid"
        size="lg"
        onClick={async () => {
          const results = await importDialog();
          const ok = results.filter((r) => r.ok).length;
          toast(ok > 0 ? `${ok} imported` : 'import cancelled');
        }}
      >
        <IconPlus />
        import books
      </Button>
    </div>
  );
}

function Toolbar({
  selectionMode,
  onToggleSelection,
}: {
  selectionMode: boolean;
  onToggleSelection: () => void;
}): ReactNode {
  const { query, setQuery, sort, setSort } = useLibrary();
  const { settings, set } = useSettings();
  const importDialog = useLibrary((s) => s.importDialog);
  const toast = useRoom((s) => s.toast);
  const themes = [
    { key: 'paper', icon: <IconSun />, label: 'paper' },
    { key: 'sepia', icon: <IconLamp />, label: 'sepia' },
    { key: 'night', icon: <IconMoon />, label: 'night' },
  ] as const;
  const themeIcon = themes.find((t) => t.key === settings.theme)?.icon ?? <IconSun />;

  return (
    <header className="library-toolbar">
      {/* the room's mark lives in the orientation rail — the toolbar is
          the shelf's working surface, not the brand bar */}
      <div className="toolbar-search">
        <IconSearch />
        <input
          className="search-input"
          placeholder="search your library"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="search library"
        />
      </div>
      <div className="toolbar-actions">
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          aria-label="sort"
        >
          <option value="recent">recent</option>
          <option value="title">title</option>
          <option value="author">author</option>
          <option value="progress">progress</option>
        </select>
        {settings.libraryView === 'grid' && (
          <IconButton
            label={selectionMode ? 'leave selection' : 'select books'}
            onClick={onToggleSelection}
          >
            <IconCheck />
          </IconButton>
        )}
        <IconButton
          label="reading theme"
          onClick={() => {
            const order = ['paper', 'sepia', 'night'] as const;
            const next = order[(order.indexOf(settings.theme) + 1) % 3]!;
            set({ theme: next });
          }}
        >
          {themeIcon}
        </IconButton>
        <IconButton
          label={settings.libraryView === 'grid' ? 'list view' : 'grid view'}
          onClick={() => set({ libraryView: settings.libraryView === 'grid' ? 'list' : 'grid' })}
        >
          {settings.libraryView === 'grid' ? <IconList /> : <IconGrid />}
        </IconButton>
        {settings.libraryView === 'grid' && (
          <IconButton
            label="cover size"
            onClick={() => {
              const order = ['s', 'm', 'l'] as const;
              const next = order[(order.indexOf(settings.librarySize) + 1) % 3]!;
              set({ librarySize: next });
            }}
          >
            <span className="size-cycle" aria-hidden="true">
              {settings.librarySize.toUpperCase()}
            </span>
          </IconButton>
        )}
        <Button
          onClick={async () => {
            const results = await importDialog();
            const ok = results.filter((r) => r.ok).length;
            toast(ok > 0 ? `${ok} imported` : 'import cancelled');
          }}
        >
          <IconPlus />
          import
        </Button>
        <span className="palette-hint meta-label">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>
    </header>
  );
}

function CollectionsBar(): ReactNode {
  const { collections, activeCollection, setActiveCollection, createCollection } = useLibrary();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  return (
    <div className="collections-bar">
      <button
        className={`chip ${activeCollection === null ? 'chip-active' : ''}`}
        onClick={() => setActiveCollection(null)}
      >
        all books
      </button>
      {collections.map(({ collection, count }) => (
        <button
          key={collection.id}
          className={`chip ${activeCollection === collection.id ? 'chip-active' : ''}`}
          onClick={() => setActiveCollection(collection.id)}
        >
          {collection.name}
          <span className="chip-count">{count}</span>
        </button>
      ))}
      {naming ? (
        <form
          className="chip-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void createCollection(name.trim());
            setName('');
            setNaming(false);
          }}
        >
          <Input
            autoFocus
            value={name}
            placeholder="collection name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNaming(false)}
            onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
            aria-label="new collection name"
          />
        </form>
      ) : (
        <button className="chip chip-add" onClick={() => setNaming(true)}>
          <IconPlus />
          new list
        </button>
      )}
    </div>
  );
}

function ContinueReading({
  books,
  currentId,
  aura,
  openingId,
  onOpen,
}: {
  books: BookWithProgress[];
  currentId: string | null;
  aura: BookAura | null;
  openingId: string | null;
  onOpen: (
    book: BookWithProgress,
    e?: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  ) => void;
}): ReactNode {
  if (books.length === 0) return null;
  return (
    <section className="continue-reading" aria-label="in progress">
      <div className="meta-label section-label">in progress</div>
      <div className="continue-row">
        {books.map((b) => (
          <ShelfObject
            key={b.id}
            book={b}
            size="sm"
            current={b.id === currentId}
            aura={b.id === currentId ? (aura ?? undefined) : undefined}
            openingId={openingId}
            onOpen={onOpen}
            onMenu={() => undefined}
          />
        ))}
      </div>
    </section>
  );
}

/** the bulk bar — objects in hand. quiet structure: count, the two
 *  real actions (gather into a list, remove), and the door out. */
function SelectionBar({
  count,
  collections,
  onAssign,
  onRemove,
  onDone,
}: {
  count: number;
  collections: { collection: { id: string; name: string }; count: number }[];
  onAssign: (collectionId: string) => void;
  onRemove: (deleteFiles: boolean) => void;
  onDone: () => void;
}): ReactNode {
  const [listOpen, setListOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="select-bar rise" role="toolbar" aria-label="selected books">
      <span className="meta-label">
        {count} {count === 1 ? 'book' : 'books'} selected
      </span>
      <div className="select-bar-actions">
        <div className="select-bar-menu">
          <button type="button" className="chip" onClick={() => setListOpen((v) => !v)}>
            <IconCollection />
            add to list
          </button>
          {listOpen && (
            <div className="menu glass rise" role="menu">
              {collections.length === 0 && <div className="menu-empty">no lists yet</div>}
              {collections.map(({ collection }) => (
                <button
                  key={collection.id}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    onAssign(collection.id);
                    setListOpen(false);
                  }}
                >
                  <IconCollection />
                  {collection.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {!confirm ? (
          <button type="button" className="chip" onClick={() => setConfirm(true)}>
            <IconTrash />
            remove…
          </button>
        ) : (
          <>
            <button type="button" className="chip" onClick={() => onRemove(false)}>
              remove, keep files
            </button>
            <button type="button" className="chip" onClick={() => onRemove(true)}>
              remove with files
            </button>
          </>
        )}
        <button type="button" className="chip chip-add" onClick={onDone}>
          done
        </button>
      </div>
    </div>
  );
}

export function LibraryScreen(): ReactNode {
  const {
    books,
    collections,
    query,
    activeCollection,
    sort,
    loading,
    refresh,
    importDropped,
    removeBook,
    assign,
  } = useLibrary();
  const { settings } = useSettings();
  const toast = useRoom((s) => s.toast);
  const shelfScroll = useRoom((s) => s.shelfScroll);
  const setShelfScroll = useRoom((s) => s.setShelfScroll);
  const bodyRef = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState<{ book: BookWithProgress; x: number; y: number } | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* spatial memory: the shelf restores its exact scroll — leaving and
   * returning is one continuous place, never a reset (golden 6) */
  useEffect(() => {
    const body = bodyRef.current;
    if (body && shelfScroll > 0) body.scrollTop = shelfScroll;
  }, [shelfScroll]);

  const [collectionIds, setCollectionIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!activeCollection) {
      setCollectionIds(null);
      return;
    }
    void api.collections.books(activeCollection).then(setCollectionIds);
  }, [activeCollection, collections]);

  const collectionBooks = useMemo(() => {
    if (!activeCollection) return null;
    const ids = collections
      .map((c) => c)
      .find((c) => c.collection.id === activeCollection);
    return ids ?? null;
  }, [activeCollection, collections]);

  const visible = useMemo(() => {
    let list = books;
    if (collectionIds) list = list.filter((b) => collectionIds.includes(b.id));
    const q = query.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.authors.join(' ').toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'author':
          return (a.authors[0] ?? '').localeCompare(b.authors[0] ?? '');
        case 'progress':
          return (b.progress?.percent ?? 0) - (a.progress?.percent ?? 0);
        default:
          return (b.progress?.lastReadAt ?? b.addedAt) - (a.progress?.lastReadAt ?? a.addedAt);
      }
    });
    return sorted;
  }, [books, query, sort, collectionIds]);

  const continueList = useMemo(
    () =>
      books
        .filter((b) => b.progress && !b.progress.completedAt)
        .sort((a, b) => (b.progress?.lastReadAt ?? 0) - (a.progress?.lastReadAt ?? 0))
        .slice(0, 8),
    [books],
  );

  /* the current book: the one object that owns the desk's memory —
   * the desk context if it exists, else the most recently read */
  const currentBookId = useRoom((s) => (s.desk ? s.desk.bookId : null)) ??
    continueList[0]?.id ?? null;
  const currentBook = books.find((b) => b.id === currentBookId) ?? null;

  /* booklight: the current book tints the light (den only, gate 8).
   * the cover is sampled once per current book; the room's aura slots
   * follow it; identity never moves (golden 7). */
  const [aura, setAura] = useState<BookAura | null>(null);
  const temperament = settings.temperament;
  const currentCover =
    platform === 'electron' && currentBook?.coverPath
      ? api.book.coverUrl(currentBook.id)
      : null;
  useEffect(() => {
    let disposed = false;
    if (!currentCover) {
      applyRoomAura(null, temperament);
      setAura(null);
      return;
    }
    void computeAura(currentCover).then((a) => {
      if (disposed) return;
      setAura(a);
      applyRoomAura(a, temperament);
    });
    return () => {
      disposed = true;
    };
  }, [currentCover, temperament]);

  const onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault();
    setDragging(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length === 0) return;
    const results = await importDropped(files);
    const ok = results.filter((r) => r.ok).length;
    const dup = results.filter((r) => !r.ok && r.reason === 'already in library').length;
    const fail = results.length - ok - dup;
    toast(
      [
        ok > 0 ? `${ok} imported` : null,
        dup > 0 ? `${dup} already there` : null,
        fail > 0 ? `${fail} failed` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'nothing to import',
    );
  };

  /* the pull-forward: the physical open. the object tips toward the
   * hand (elevation-3, the launch state), then the desk opens — the
   * seed of L10's shared-element flight (golden 6). ctrl/cmd+click is
   * the selection shortcut: objects in hand, never an accidental open. */
  const goDesk = useRoom((s) => s.goDesk);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const openBook = (
    book: BookWithProgress,
    e?: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  ): void => {
    if (selectionMode || e?.ctrlKey || e?.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(book.id)) next.delete(book.id);
        else next.add(book.id);
        return next;
      });
      if (!selectionMode) setSelectionMode(true);
      return;
    }
    if (openingId !== null) return;
    setOpeningId(book.id);
    window.setTimeout(() => {
      setOpeningId(null);
      goDesk(book.id);
    }, 150);
  };

  /* Escape leaves selection mode — the door out is always one key away */
  useEffect(() => {
    if (!selectionMode) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setSelectionMode(false);
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectionMode]);

  const exitSelection = (): void => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const removeSelected = (deleteFiles: boolean): void => {
    for (const id of selectedIds) void removeBook(id, deleteFiles);
    toast(`removed ${selectedIds.size} ${selectedIds.size === 1 ? 'book' : 'books'}${deleteFiles ? ' with files' : ' — files kept'}`);
    exitSelection();
  };

  const assignSelected = (collectionId: string): void => {
    const name = collections.find((c) => c.collection.id === collectionId)?.collection.name ?? 'list';
    for (const id of selectedIds) void assign(collectionId, id);
    toast(`added ${selectedIds.size} ${selectedIds.size === 1 ? 'book' : 'books'} to ${name}`);
    exitSelection();
  };

  const size = settings.librarySize;

  return (
    <div
      className="library"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => void onDrop(e)}
    >
      <Toolbar selectionMode={selectionMode} onToggleSelection={() => (selectionMode ? exitSelection() : setSelectionMode(true))} />
      {selectionMode && (
        <SelectionBar
          count={selectedIds.size}
          collections={collections}
          onAssign={assignSelected}
          onRemove={removeSelected}
          onDone={exitSelection}
        />
      )}
      {dragging && (
        <div className="dropzone-overlay fade-in">
          <div className="dropzone-card glass">
            <IconBook />
            <div className="type-wordmark">drop your books</div>
            <div className="meta-label">epub · pdf</div>
          </div>
        </div>
      )}
      <main
        className="library-body"
        ref={bodyRef}
        onScroll={() => {
          const body = bodyRef.current;
          if (body) setShelfScroll(body.scrollTop);
        }}
      >
        {loading && books.length === 0 ? (
          <div className="library-loading meta-label">opening the library…</div>
        ) : books.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <CollectionsBar />
            <ContinueReading
              books={continueList}
              currentId={currentBookId}
              aura={aura}
              openingId={openingId}
              onOpen={openBook}
            />
            <section className="library-grid-section" aria-label="library">
              <div className="meta-label section-label">
                {activeCollection
                  ? (collectionBooks?.collection.name ?? 'collection')
                  : `${visible.length} ${visible.length === 1 ? 'book' : 'books'}`}
              </div>
              {settings.libraryView === 'grid' ? (
                <div className="book-grid" data-size={size}>
                  {visible.map((b) => (
                    <ShelfObject
                      key={b.id}
                      book={b}
                      current={b.id === currentBookId}
                      aura={b.id === currentBookId ? (aura ?? undefined) : undefined}
                      openingId={openingId}
                      selectionMode={selectionMode}
                      selected={selectedIds.has(b.id)}
                      onOpen={openBook}
                      onMenu={(book, x, y) => setMenu({ book, x, y })}
                    />
                  ))}
                </div>
              ) : (
                <div className="book-list">
                  {visible.map((b) => (
                    <BookRow key={b.id} book={b} onMenu={(book, x, y) => setMenu({ book, x, y })} />
                  ))}
                </div>
              )}
              {visible.length === 0 && (
                <div className="no-results meta-label">nothing matches “{query}”</div>
              )}
            </section>
          </>
        )}
      </main>
      {menu && <BookMenu book={menu.book} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </div>
  );
}
