import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { BookWithProgress } from '@arivo/core';
import { api, platform } from '../services/api.ts';
import { useLibrary } from '../stores/library.ts';
import { useRoom } from '../stores/room.ts';
import { Button, IconButton } from '@arivo/ui';
import { IconX, IconNote, IconBookmark, IconTag, IconPencil, IconBook } from '../components/icons.tsx';

function fmtBytes(n: number): string {
  if (n <= 0) return '—';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtFullDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** tag editor — chips plus a quiet inline input; enter commits, esc cancels */
function TagEditor({ book }: { book: BookWithProgress }): ReactNode {
  const setBookTags = useLibrary((s) => s.setBookTags);
  const toast = useRoom((s) => s.toast);
  const [draft, setDraft] = useState('');
  const tags = book.tags;

  const commit = (next: string[]): void => {
    if (next.length > 50) return;
    void setBookTags(book.id, next);
  };
  const addDraft = (): void => {
    const t = draft.trim().toLowerCase();
    setDraft('');
    if (!t) return;
    if (tags.includes(t)) return;
    if (t.length > 100) {
      toast('that tag is too long');
      return;
    }
    commit([...tags, t]);
  };

  return (
    <div className="detail-tags">
      {tags.map((t) => (
        <span key={t} className="chip chip-tag">
          <IconTag />
          {t}
          <button
            className="tag-remove"
            aria-label={`remove tag ${t}`}
            onClick={() => commit(tags.filter((x) => x !== t))}
          >
            <IconX />
          </button>
        </span>
      ))}
      <form
        className="chip-form"
        onSubmit={(e) => {
          e.preventDefault();
          addDraft();
        }}
      >
        <input
          className="tag-input"
          value={draft}
          placeholder={tags.length === 0 ? 'add a tag…' : 'another…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setDraft('')}
          aria-label="add tag"
          maxLength={100}
        />
      </form>
    </div>
  );
}

/** which collections hold this book — assign / unassign, right here */
function CollectionsEditor({ book }: { book: BookWithProgress }): ReactNode {
  const { collections, assign, unassign } = useLibrary();
  const [member, setMember] = useState<Set<string>>(new Set());

  useEffect(() => {
    let disposed = false;
    void Promise.all(
      collections.map(({ collection }) =>
        api.collections.books(collection.id).then((ids) => [collection.id, ids.includes(book.id)] as const),
      ),
    ).then((pairs) => {
      if (disposed) return;
      setMember(new Set(pairs.filter(([, inIt]) => inIt).map(([id]) => id)));
    });
    return () => {
      disposed = true;
    };
  }, [collections, book.id]);

  if (collections.length === 0) {
    return <p className="meta-label">no lists yet — make one in the library bar</p>;
  }
  return (
    <div className="detail-tags">
      {collections.map(({ collection }) => {
        const on = member.has(collection.id);
        return (
          <button
            key={collection.id}
            className={`chip chip-tag${on ? ' chip-active' : ''}`}
            aria-pressed={on}
            onClick={() => {
              if (on) void unassign(collection.id, book.id);
              else void assign(collection.id, book.id);
            }}
          >
            {on ? '✓' : '+'}&nbsp;{collection.name}
          </button>
        );
      })}
    </div>
  );
}

export function BookDetail(): ReactNode {
  const detailBookId = useRoom((s) => s.detailBookId);
  const closeBookDetail = useRoom((s) => s.closeBookDetail);
  const goDesk = useRoom((s) => s.goDesk);
  const books = useLibrary((s) => s.books);
  const [counts, setCounts] = useState<{ highlights: number; bookmarks: number } | null>(null);

  const book: BookWithProgress | undefined = useMemo(
    () => books.find((b) => b.id === detailBookId),
    [books, detailBookId],
  );

  useEffect(() => {
    if (!detailBookId) return;
    setCounts(null);
    void api.annotations.list(detailBookId).then(({ highlights, bookmarks }) =>
      setCounts({ highlights: highlights.length, bookmarks: bookmarks.length }),
    );
  }, [detailBookId, books.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeBookDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeBookDetail]);

  if (!detailBookId || !book) return null;

  const pct = book.progress ? Math.round(book.progress.percent * 100) : 0;
  const showImg = platform === 'electron' && book.coverPath;
  const facts: { label: string; value: string }[] = [
    { label: 'publisher', value: book.publisher ?? '—' },
    { label: 'published', value: book.publishedYear ?? '—' },
    { label: 'language', value: (book.language ?? '—').toUpperCase() },
    { label: 'format', value: `${book.format.toUpperCase()} · ${fmtBytes(book.fileSize)}` },
    { label: 'added', value: fmtFullDate(book.addedAt) },
  ];

  return (
    <>
      <div className="menu-scrim" onClick={closeBookDetail} />
      <aside className="drawer drawer-right rise detail-drawer" aria-label="book details">
        <header className="drawer-head">
          <span className="meta-label">about this book</span>
          <IconButton label="close details" onClick={closeBookDetail}>
            <IconX />
          </IconButton>
        </header>
        <div className="drawer-body detail-body">
          <div className="detail-hero">
            <div className="book-cover" style={{ width: '180px', height: '270px', flexShrink: 0 }}>
              {showImg ? (
                <img src={api.book.coverUrl(book.id)} alt="" />
              ) : (
                <div className="book-cover-fallback">
                  <span className="book-cover-title">{book.title}</span>
                  <span className="book-cover-author">{book.authors[0] ?? ''}</span>
                </div>
              )}
            </div>
            <div className="detail-hero-meta">
              <h2 className="detail-title display">{book.title}</h2>
              {book.subtitle && <p className="detail-subtitle">{book.subtitle}</p>}
              <p className="detail-author">{book.authors.join(' · ') || 'unknown author'}</p>
              {book.progress ? (
                <div className="detail-progress">
                  <div className="book-progress" aria-label={`${pct}% read`}>
                    <div className="book-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="meta-label">
                    {pct}% · {book.progress.chapter ?? 'in progress'}
                  </span>
                </div>
              ) : (
                <span className="meta-label">not started</span>
              )}
              <Button
                variant="solid"
                onClick={() => {
                  closeBookDetail();
                  goDesk(book.id);
                }}
              >
                <IconBook />
                {book.progress ? 'jump back in' : 'start reading'}
              </Button>
              <div className="detail-marks meta-label">
                <span>
                  <IconNote /> {counts ? counts.highlights : '…'} marks
                </span>
                <span>
                  <IconBookmark /> {counts ? counts.bookmarks : '…'} bookmarks
                </span>
              </div>
            </div>
          </div>

          {book.description && (
            <section className="detail-section">
              <div className="meta-label section-label">
                <IconPencil /> description
              </div>
              <p className="detail-description">{book.description}</p>
            </section>
          )}

          <section className="detail-section">
            <div className="meta-label section-label">
              <IconTag /> tags
            </div>
            <TagEditor book={book} />
          </section>

          <section className="detail-section">
            <div className="meta-label section-label">lists</div>
            <CollectionsEditor book={book} />
          </section>

          <section className="detail-section">
            <div className="meta-label section-label">the details</div>
            <dl className="detail-facts">
              {facts.map((f) => (
                <div key={f.label} className="detail-fact">
                  <dt className="meta-label">{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </aside>
    </>
  );
}
