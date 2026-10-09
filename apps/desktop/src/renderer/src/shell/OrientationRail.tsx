/**
 * OrientationRail — the room's left region. an OVERLAY instrument
 * (v0.3.1): collapsed to its icon column at rest, it expands on
 * approach — hover or focus — and floats over the work instead of
 * displacing it. the work region is the full window; the reading
 * column centers on the true window center; expanding the rail never
 * reflows a word.
 *
 * v0.3.2 — the simplification: the rail is FOUR things and nothing
 * else — the shelf, the current book (return to reading), the light
 * (dark/light), and settings. the temperament (den/lab), the archive
 * place, and the design lab door are retired. expansion carries motion:
 * the rail glides wide and the labels land from a whisper of blur —
 * the glass language earning its place.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavItem, IconSun, IconMoon } from '@arivo/ui';
import { useLibrary } from '../stores/library.ts';
import { useRoom } from '../stores/room.ts';
import { useSettings } from '../stores/settings.ts';
import { Wordmark } from '../components/Wordmark.tsx';
import { api } from '../services/api.ts';

/** how long the rail stays wide after the cursor leaves — enough to
 *  travel back without a collapse flash, short enough to feel eager */
const DWELL_MS = 240;

export function OrientationRail(): ReactNode {
  const place = useRoom((s) => s.place);
  const desk = useRoom((s) => s.desk);
  const goShelf = useRoom((s) => s.goShelf);
  const returnToDesk = useRoom((s) => s.returnToDesk);
  const setSettingsOpen = useRoom((s) => s.setSettingsOpen);
  const openNotebook = useRoom((s) => s.openNotebook);
  const books = useLibrary((s) => s.books);
  const { settings, set } = useSettings();

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
  const dark = settings.theme === 'dark';

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
          icon="notebook"
          label="notebook"
          onSelect={openNotebook}
          id="nav-notebook"
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
        <button
          type="button"
          className={`rail-light${dark ? ' is-dark' : ''}`}
          role="switch"
          aria-checked={dark}
          aria-label={dark ? 'switch to light' : 'switch to dark'}
          title={dark ? 'light' : 'dark'}
          onClick={() => set({ theme: dark ? 'light' : 'dark' })}
        >
          <span className="rail-light-icon" aria-hidden="true">
            {dark ? <IconMoon /> : <IconSun />}
          </span>
          <span className="nav-item-label rail-light-label">
            {dark ? 'light' : 'dark'}
          </span>
        </button>
        <NavItem
          icon="settings"
          label="settings"
          onSelect={() => setSettingsOpen(true)}
          id="nav-settings"
        />
      </div>
    </nav>
  );
}
