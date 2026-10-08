/**
 * ArchiveRoom — the archive's ledger (L11): evidence of a mind at work.
 * every object carries its provenance — artifact → note → selection →
 * chapter → book — and every entry returns to the exact place it came
 * from. highlights and bookmarks are the marks; margin notes (their
 * questions flagged) and desk documents (the workbench's papers, with
 * their collected passages) are the work itself.
 *
 * deliberately NOT: a notes database, a file manager, a dashboard, a
 * graph. time groups are honest structure; the rest is presentation
 * deferred until the object model is proven (L11's own law).
 *
 * voice: a ledger of a mind at work — quiet cards, the quote in the
 * author's voice (literata), the source under it, time in mono. never
 * a database table, never statistics.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ArchiveEntry } from '@arivo/core';
import { api } from '../services/api.ts';
import { useRoom, type DeskMode } from '../stores/room.ts';
import { IconBookmark, IconNote, IconSearch, IconPencil, IconInfo, IconChevronRight } from '../components/icons.tsx';

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const same = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'today';
  if (same(d, yesterday)) return 'yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** the object's glyph — kind at a glance, ink not hue */
function KindGlyph({ mark }: { mark: ArchiveEntry }): ReactNode {
  if (mark.kind === 'highlight' && mark.color) {
    return <span className={`sel-dot sel-dot-${mark.color}`} aria-hidden="true" />;
  }
  if (mark.kind === 'note') return <span className="archive-mark-glyph" aria-hidden="true">{mark.question ? <IconInfo /> : <IconNote />}</span>;
  if (mark.kind === 'deskdoc') {
    return (
      <span className="archive-mark-glyph" aria-hidden="true">
        {mark.deskKind === 'research' ? <IconSearch /> : mark.deskKind === 'make' ? <IconPencil /> : <IconNote />}
      </span>
    );
  }
  return (
    <span className="archive-mark-glyph" aria-hidden="true">
      <IconBookmark />
    </span>
  );
}

function ArchiveMark({ mark }: { mark: ArchiveEntry }): ReactNode {
  const goDesk = useRoom((s) => s.goDesk);
  const setDeskMode = useRoom((s) => s.setDeskMode);
  const setWorkbenchDoc = useRoom((s) => s.setWorkbenchDoc);

  /* source return: the anchor rides with the object — the passage is
   * one click away, at the exact place it was made. a document opens
   * back into its own workbench surface (Archive → Desk, the world
   * model's transition: artifact → source → exact context). */
  const open = (): void => {
    if (mark.kind === 'deskdoc' && mark.deskKind) {
      goDesk(mark.bookId);
      setDeskMode(mark.deskKind as DeskMode);
      setWorkbenchDoc(mark.id);
      return;
    }
    goDesk(
      mark.bookId,
      mark.anchor.primary,
      mark.kind === 'highlight' ? mark.id : null,
    );
  };

  const openRef = (locator: string): void => {
    goDesk(mark.bookId, locator);
  };

  return (
    <div className="archive-mark" data-kind={mark.kind}>
      <button type="button" className="archive-mark-open" onClick={open}>
        <div className="archive-mark-head">
          <KindGlyph mark={mark} />
          <span className="meta-label archive-mark-time">
            {mark.question ? 'question · ' : ''}
            {mark.kind === 'deskdoc' ? `${mark.deskKind ?? 'document'} · ` : ''}
            {mark.chapter ?? dayLabel(mark.updatedAt)} · {timeLabel(mark.updatedAt)}
          </span>
        </div>
        {mark.kind === 'deskdoc' ? (
          <>
            <div className="archive-mark-doc-title">{mark.deskTitle || mark.text}</div>
            {mark.deskBody ? <p className="archive-mark-doc-body">{mark.deskBody.slice(0, 200)}</p> : null}
          </>
        ) : mark.kind === 'note' ? (
          <blockquote className={`note-text archive-mark-text${mark.question ? ' archive-mark-question' : ''}`}>
            {mark.text}
          </blockquote>
        ) : mark.kind === 'highlight' ? (
          <blockquote className="note-text archive-mark-text">{mark.text}</blockquote>
        ) : (
          <div className="archive-mark-bookmark-label">{mark.text}</div>
        )}
        {mark.note ? <p className="archive-mark-note">{mark.note}</p> : null}
        <div className="archive-mark-source">
          <span className="archive-mark-book">{mark.bookTitle}</span>
          {mark.bookAuthors.length > 0 ? (
            <span className="meta-label"> · {mark.bookAuthors.join(', ')}</span>
          ) : null}
        </div>
      </button>
      {mark.kind === 'deskdoc' && mark.sourceRefs.length > 0 && (
        <div className="archive-mark-refs">
          <div className="meta-label">
            {mark.sourceRefs.length} {mark.sourceRefs.length === 1 ? 'passage' : 'passages'} kept
          </div>
          {mark.sourceRefs.slice(0, 3).map((r, i) => (
            <button
              key={`${r.locator}-${i}`}
              type="button"
              className="archive-ref"
              onClick={() => openRef(r.locator)}
              aria-label={`return to this passage in ${mark.bookTitle}`}
            >
              <blockquote className="note-text archive-ref-quote">{r.quote}</blockquote>
              <span className="meta-label archive-ref-chapter">
                <IconChevronRight />
                {r.chapter ?? 'passage'}
              </span>
            </button>
          ))}
          {mark.sourceRefs.length > 3 && (
            <span className="meta-label">… and {mark.sourceRefs.length - 3} more in the document</span>
          )}
        </div>
      )}
    </div>
  );
}

function ArchiveEmpty(): ReactNode {
  const goShelf = useRoom((s) => s.goShelf);
  return (
    <div className="archive-empty fade-in">
      <div className="archive-empty-glyph" aria-hidden="true">
        <IconBookmark />
      </div>
      <h1 className="type-title">your work will gather here</h1>
      <p className="empty-sub">
        highlight a passage, leave a note or a question, collect a quote,
        write a reflection —
        <br />
        each one becomes an object that remembers where it came from.
      </p>
      <button type="button" className="chip" onClick={goShelf}>
        go to the shelf
      </button>
    </div>
  );
}

export function ArchiveRoom(): ReactNode {
  const [marks, setMarks] = useState<ArchiveEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const archiveScroll = useRoom((s) => s.archiveScroll);
  const setArchiveScroll = useRoom((s) => s.setArchiveScroll);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    void api.archive
      .marks()
      .then((m) => {
        if (!disposed) setMarks(m);
      })
      .catch((err: unknown) => {
        if (!disposed) setError(err instanceof Error ? err.message : 'the archive could not be read');
      });
    return () => {
      disposed = true;
    };
  }, []);

  /* spatial memory: the archive restores its scroll like every room */
  useEffect(() => {
    const body = bodyRef.current;
    if (body && archiveScroll > 0) body.scrollTop = archiveScroll;
  }, [archiveScroll]);

  const captureScroll = (): void => {
    const body = bodyRef.current;
    if (body) setArchiveScroll(body.scrollTop);
  };

  if (error) {
    return (
      <div className="archive-error fade-in">
        <div className="type-title">the archive could not be read</div>
        <p className="meta-label">{error}</p>
      </div>
    );
  }

  /* day groups — time structure is honest structure, not decoration */
  const groups: { label: string; marks: ArchiveEntry[] }[] = [];
  if (marks) {
    for (const m of marks) {
      const label = dayLabel(m.updatedAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.marks.push(m);
      else groups.push({ label, marks: [m] });
    }
  }

  const markCount = marks?.filter((m) => m.kind === 'highlight' || m.kind === 'bookmark').length ?? 0;
  const noteCount = marks?.filter((m) => m.kind === 'note').length ?? 0;
  const docCount = marks?.filter((m) => m.kind === 'deskdoc').length ?? 0;

  return (
    <div className="archive" data-region="work">
      <header className="archive-head">
        <h1 className="archive-title">the archive</h1>
        <span className="meta-label">
          {marks === null
            ? 'reading the ledger…'
            : `${marks.length} ${marks.length === 1 ? 'object' : 'objects'} — ${markCount} ${markCount === 1 ? 'mark' : 'marks'}, ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}, ${docCount} ${docCount === 1 ? 'document' : 'documents'}`}
        </span>
      </header>
      <div className="archive-body" ref={bodyRef} onScroll={captureScroll}>
        {marks !== null && marks.length === 0 && <ArchiveEmpty />}
        {groups.map((g) => (
          <section key={g.label} className="archive-group" aria-label={g.label}>
            <div className="meta-label archive-group-label">{g.label}</div>
            <div className="archive-group-marks">
              {g.marks.map((m) => (
                <ArchiveMark key={`${m.kind}-${m.id}`} mark={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
