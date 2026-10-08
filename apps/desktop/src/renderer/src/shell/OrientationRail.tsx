/**
 * OrientationRail — the room's left region (L8). persistent furniture:
 * it never remounts on place change — that is spatial memory. the three
 * places are positions in one room, not routes; the desk item exists
 * only when a desk exists (disabled until a book is opened — the desk
 * is a place you make). the current book rides under the places: the
 * same object that is open on the desk, one click from anywhere.
 *
 * the foot holds the room's settings as furniture: the temperament
 * (den / lab — gate 13: picker + persistence) and the design lab door.
 */
import type { ReactNode } from 'react';
import { NavItem } from '@arivo/ui';
import { useLibrary } from '../stores/library.ts';
import { useRoom } from '../stores/room.ts';
import { useSettings } from '../stores/settings.ts';

function TemperamentControl(): ReactNode {
  const { settings, set } = useSettings();
  const next: 'den' | 'lab' = settings.temperament;
  return (
    <div className="rail-temperament" role="radiogroup" aria-label="temperament">
      {(['den', 'lab'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={next === t}
          className={`rail-temperament-option${next === t ? ' is-selected' : ''}`}
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
  const books = useLibrary((s) => s.books);
  const setPaletteOpen = useRoom((s) => s.setPaletteOpen);

  const current = desk ? books.find((b) => b.id === desk.bookId) : undefined;
  const pct = current?.progress ? Math.round(current.progress.percent * 100) : 0;

  const openLab = (): void => {
    window.location.hash = 'lab';
    window.location.reload();
  };

  return (
    <nav className="rail" data-region="orientation" aria-label="arivo">
      <div className="rail-wordmark type-wordmark" aria-hidden="true">
        arivo.
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
        <button type="button" className="rail-book" onClick={returnToDesk} aria-label={`return to ${current.title}`}>
          <span className="rail-book-title">{current.title}</span>
          <span className="rail-book-author meta-label">
            {current.authors[0] ?? current.format}
          </span>
          {pct > 0 ? (
            <span className="rail-book-progress" aria-hidden="true">
              <span className="rail-book-progress-fill" style={{ width: `${pct}%` }} />
            </span>
          ) : null}
        </button>
      ) : null}

      <div className="rail-foot">
        <TemperamentControl />
        <button type="button" className="rail-lab" onClick={openLab}>
          design lab
        </button>
        <button
          type="button"
          className="rail-command meta-label"
          onClick={() => setPaletteOpen(true)}
        >
          commands
        </button>
      </div>
    </nav>
  );
}
