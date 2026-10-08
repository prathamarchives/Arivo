/**
 * ReadingMeasure — the sovereign column (law 45).
 *
 * the reading body tops out at 68ch: the author's comfort, not the
 * monitor's width. the room grows around the page. margins are useful
 * space (law 46) — tools, notes, references, booklight breathe there.
 *
 * gate 15 honesty: while the true ch-derived measure lands with L10
 * reader depth, the component clamps the px approximation
 * (520–760px authored range) alongside 68ch — whichever is tighter wins.
 * 68ch resolves against the reading font of the surrounding context:
 * mount this inside the reading surface, not in helvetica chrome.
 */
import type { ReactNode } from 'react';

export interface ReadingMeasureProps {
  as?: 'div' | 'article' | 'main';
  className?: string;
  children?: ReactNode;
}

export function ReadingMeasure({ as: Tag = 'div', className = '', children }: ReadingMeasureProps): ReactNode {
  return (
    <Tag className={`reading-measure ${className}`.trim()}>
      {children}
    </Tag>
  );
}
