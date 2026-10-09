/**
 * OrientationRail — the room's left region. an OVERLAY instrument
 * (v0.3.1): collapsed to its icon column at rest, it expands on
 * approach — hover or focus — and floats over the work instead of
 * displacing it. the work region is the full window; the reading
 * column centers on the true window center; expanding the rail never
 * reflows a word.
 *
 * the foot: the temperament (den / lab) and settings — room furniture,
 * never chrome. the design lab is a development instrument and ships
 * only under DEV; commands are keyboard-first (Ctrl+K), not rail text.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavItem } from '@arivo/ui';
import { useLibrary } from '../stores/library.ts';
import { useRoom } from '../stores/room.ts';
import { useSettings } from '../stores/settings.ts';
import { Wordmark } from '../components/Wordmark.tsx';
import { api } from '../services/api.ts';

/** how long the rail stays wide after the cursor leaves — enough to
 *  travel back without a collapse flash, short enough to feel eager */
const DWELL_MS = 240;

function TemperamentControl(): ReactNode {
  const { settings, set } = useSettings();
  return (
    <div className="rail-temperament" role="radiogroup" aria-label="temperament">
      {(['den', 'lab'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={settings.temperament === t}
          className={`rail-temperament-option${settings.temperament === t ? ' is-selected' : ''}`}
          onClick={() => set({ temperament: t })}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function OrientationRail(): ReactNode {
  const place = useRoom((s) => s.place);
  const desk = useRoom((s) => s.desk);
  const goShelf = useRoom((s) => s.goShelf);
  const goArchive = useRoom((s) => s.goArchive);
  const returnToDesk = useRoom((s) => s.returnToDesk);
  const setSettingsOpen = useRoom((s) => s.setSettingsOpen);
  const books = useLibrary((s) => s.books);

  const [expanded, setExpanded] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expand = (): void => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
    setExpanded(true);
  };
  const scheduleCollapse = (): void => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setExpanded(false), DWELL_MS);
  };
  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  /* keyboard: Escape folds the rail when focus lives inside it */
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const current = desk ? books.find((b) => b.id === desk.bookId) : undefined;
  const pct = current?.progress ? Math.round(current.progress.percent * 100) : 0;

  return (
    <nav
      className="rail"
      data-region="orientation"
      data-expanded={expanded}
      aria-label="arivo"
      aria-expanded={expanded}
      onMouseEnter={expand}
      onMouseLeave={scheduleCollapse}
      onFocus={expand}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleCollapse();
      }}
    >
      <div className="rail-brand">
        {expanded ? <Wordmark /> : <Wordmark compact />}
      </div>

      <div className="rail-places">
        <NavItem icon="shelf" label="shelf" selected={place === 'shelf'} onSelect={goShelf} id="nav-shelf" />
        <NavItem
          icon="book"
          label="desk"
          selected={place === 'desk'}
          onSelect={returnToDesk}
          id="nav-desk"
          disabled={!desk}
        />
        <NavItem
          icon="archive"
          label="archive"
          selected={place === 'archive'}
          onSelect={goArchive}
          id="nav-archive"
        />
      </div>

      {current ? (
        <button
          type="button"
          className="rail-book"
          onClick={returnToDesk}
          aria-label={`return to ${current.title}`}
        >
          <img
            className="rail-book-cover"
            src={api.book.coverUrl(current.id)}
            alt=""
          />
          <span className="rail-book-meta">
            <span className="rail-book-title">{current.title}</span>
            <span className="rail-book-author meta-label">
              {current.authors[0] ?? current.format}
            </span>
            {pct > 0 ? (
              <span className="rail-book-progress" aria-hidden="true">
                <span className="rail-book-progress-fill" style={{ width: `${pct}%` }} />
              </span>
            ) : null}
          </span>
        </button>
      ) : null}

      <div className="rail-foot">
        <TemperamentControl />
        <NavItem
          icon="settings"
          label="settings"
          onSelect={() => setSettingsOpen(true)}
          id="nav-settings"
        />
        {import.meta.env.DEV ? (
          <button
            type="button"
            className="rail-lab"
            onClick={() => {
              window.location.hash = 'lab';
              window.location.reload();
            }}
          >
            design lab
          </button>
        ) : null}
      </div>
    </nav>
  );
}
