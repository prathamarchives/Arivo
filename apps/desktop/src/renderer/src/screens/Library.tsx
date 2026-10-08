import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import type { BookWithProgress } from '@arivo/core';
import { platform, api } from '../services/api.ts';
import { useLibrary, type SortMode } from '../stores/library.ts';
import { useSettings } from '../stores/settings.ts';
import { useRoom } from '../stores/room.ts';
import { IconButton, Button, Input, Kbd } from '@arivo/ui';
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
} from '../components/icons.tsx';

const COVER_SIZES: Record<'s' | 'm' | 'l', number> = { s: 160, m: 200, l: 240 };

function coverStyle(size: number): Record<string, string> {
  return { width: `${size}px`, height: `${Math.round(size * 1.5)}px` };
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Cover({ book, size }: { book: BookWithProgress; size: number }): ReactNode {
  const [broken, setBroken] = useState(false);
  const showImg = platform === 'electron' && book.coverPath && !broken;
  return (
    <div className="book-cover" style={coverStyle(size)} aria-hidden="true">
      {showImg ? (
        <img
          src={api.book.coverUrl(book.id)}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="book-cover-fallback">
          <span className="book-cover-title">{book.title}</span>
          <span className="book-cover-author">{book.authors[0] ?? ''}</span>
        </div>
      )}
      {book.format === 'pdf' && <span className="format-badge">PDF</span>}
    </div>
  );
}

function BookCard({
  book,
  size,
  onMenu,
}: {
  book: BookWithProgress;
  size: number;
  onMenu: (book: BookWithProgress, x: number, y: number) => void;
}): ReactNode {
  const goDesk = useRoom((s) => s.goDesk);
  const pct = book.progress ? Math.round(book.progress.percent * 100) : 0;
  return (
    <div
      className="book-card"
      style={{ width: `${size}px` }}
      role="button"
      tabIndex={0}
      aria-label={`${book.title} by ${book.authors.join(', ')}`}
      onClick={() => goDesk(book.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goDesk(book.id);
        }
      }}
    >
      <Cover book={book} size={size} />
      {book.fileMissing && (
        <div className="book-flag book-flag-missing" title="the book file is missing — annotations are safe">
          missing file
        </div>
      )}
      <div className="book-meta">
        <div className="book-title" title={book.title}>
          {book.title}
        </div>
        <div className="book-author">{book.authors.join(', ') || '—'}</div>
        {pct > 0 && (
          <div className="book-progress" aria-label={`${pct}% read`}>
            <div className="book-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
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

function BookRow({
  book,
  onMenu,
}: {
  book: BookWithProgress;
  onMenu: (book: BookWithProgress, x: number, y: number) => void;
}): ReactNode {
  const goDesk = useRoom((s) => s.goDesk);
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
      <Cover book={book} size={32} />
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
      <div className="empty-glyph">
        <IconBook />
      </div>
      <h1 className="type-title">point me at your books</h1>
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

function Toolbar(): ReactNode {
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

function ContinueReading({ books }: { books: BookWithProgress[] }): ReactNode {
  const goDesk = useRoom((s) => s.goDesk);
  if (books.length === 0) return null;
  return (
    <section className="continue-reading" aria-label="continue reading">
      <div className="meta-label section-label">continue reading</div>
      <div className="continue-row">
        {books.map((b) => {
          const pct = Math.round((b.progress?.percent ?? 0) * 100);
          return (
            <button
              key={b.id}
              className="continue-card"
              onClick={() => goDesk(b.id)}
              aria-label={`continue ${b.title}`}
            >
              <Cover book={b} size={110} />
              <div className="continue-meta">
                <span className="continue-title">{b.title}</span>
                <span className="meta-label">
                  {b.progress?.chapter ?? `${pct}%`}
                </span>
                <div className="book-progress">
                  <div className="book-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
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

  const size = COVER_SIZES[settings.librarySize] ?? 200;

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
      <Toolbar />
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
            <ContinueReading books={continueList} />
            <section className="library-grid-section" aria-label="library">
              <div className="meta-label section-label">
                {activeCollection
                  ? (collectionBooks?.collection.name ?? 'collection')
                  : `${visible.length} ${visible.length === 1 ? 'book' : 'books'}`}
              </div>
              {settings.libraryView === 'grid' ? (
                <div className="book-grid">
                  {visible.map((b) => (
                    <BookCard key={b.id} book={b} size={size} onMenu={(book, x, y) => setMenu({ book, x, y })} />
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
