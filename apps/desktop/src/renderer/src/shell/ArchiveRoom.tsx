/**
 * ArchiveRoom — L8's first camera into the archive. it is downstream of
 * the desk: it shows only real objects (highlights, bookmarks) with
 * their provenance joined, and every entry returns to the exact passage
 * it came from (golden 5). this is deliberately NOT the full archive —
 * L11 designs the views (threads, clusters, walls); L8 proves the loop:
 * read → mark → leave → remember → return.
 *
 * voice: a ledger of a mind at work — quiet cards, the quote in the
 * author's voice (literata), the source under it, time in mono. never
 * a database table, never statistics.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ArchiveEntry } from '@arivo/core';
import { api } from '../services/api.ts';
import { useRoom } from '../stores/room.ts';
import { IconBookmark } from '../components/icons.tsx';

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

function ArchiveMark({ mark }: { mark: ArchiveEntry }): ReactNode {
  const goDesk = useRoom((s) => s.goDesk);
  /* source return: the anchor rides with the object — the passage is
   * one click away, at the exact place it was made */
  const open = (): void =>
    goDesk(
      mark.bookId,
      mark.anchor.primary,
      mark.kind === 'highlight' ? mark.id : null,
    );

  return (
    <button type="button" className="archive-mark" onClick={open}>
      <div className="archive-mark-head">
        {mark.kind === 'highlight' && mark.color ? (
          <span className={`sel-dot sel-dot-${mark.color}`} aria-hidden="true" />
        ) : (
          <span className="archive-mark-glyph" aria-hidden="true">
            <IconBookmark />
          </span>
        )}
        <span className="meta-label archive-mark-time">
          {mark.chapter ?? dayLabel(mark.updatedAt)} · {timeLabel(mark.updatedAt)}
        </span>
      </div>
      {mark.kind === 'highlight' ? (
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
        highlight a passage, leave a note, drop a bookmark —
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

  return (
    <div className="archive" data-region="work">
      <header className="archive-head">
        <h1 className="archive-title">the archive</h1>
        <span className="meta-label">
          {marks === null ? 'reading the ledger…' : `${marks.length} ${marks.length === 1 ? 'mark' : 'marks'}`}
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
