/**
 * Reader — Selection, HighlightMarker, ProgressMarker. the reading
 * surface's own objects: the annotation moment, the wash, the hairline.
 *
 * Selection: the color dots that appear at a text selection — the five
 * identity colors (constant across rooms, law 38) + the note action.
 * the identity is never re-picked here; 'gray' renders as the pencil
 * mark (D-005).
 * HighlightMarker: the wash over text — derived legibility surface that
 * adapts to the light while the identity stays constant.
 * ProgressMarker: the reading progress hairline — sticky chrome, scaleX
 * transform only, never layout.
 */
import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';

export const ANNO_IDENTITY = ['amber', 'sage', 'blue', 'rose', 'violet'] as const;
export type AnnoIdentity = (typeof ANNO_IDENTITY)[number] | 'gray';

export interface SelectionProps {
  /** the five identities + the legacy pencil mark */
  onPick: (identity: AnnoIdentity) => void;
  onNote?: () => void;
  /** keyboard: the dots are radios in a group */
  label?: string;
}

export function Selection({ onPick, onNote, label = 'highlight color' }: SelectionProps): ReactNode {
  return (
    <span className="sel-menu" role="radiogroup" aria-label={label}>
      {ANNO_IDENTITY.map((identity, i) => (
        <button
          key={identity}
          type="button"
          role="radio"
          aria-checked={false}
          aria-label={identity}
          className={`sel-dot sel-${identity}`}
          onClick={() => onPick(identity)}
          tabIndex={i === 0 ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + ANNO_IDENTITY.length) % ANNO_IDENTITY.length;
              const el = document.activeElement?.parentElement?.children[next] as HTMLElement | undefined;
              el?.focus();
            }
          }}
        />
      ))}
      {onNote ? (
        <button
          type="button"
          className="sel-note"
          aria-label="note on selection"
          onClick={onNote}
        >
          <Icon name="note" />
        </button>
      ) : null}
    </span>
  );
}

export function HighlightMarker({
  identity,
  children,
  active,
}: {
  identity: AnnoIdentity;
  children: ReactNode;
  active?: boolean;
}): ReactNode {
  return (
    <mark className={`hl hl-${identity} ${active ? 'is-active' : ''}`.trim()} data-identity={identity}>
      {children}
    </mark>
  );
}

export function ProgressMarker({
  value,
  label = 'reading progress',
}: {
  value: number;
  label?: string;
}): ReactNode {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div className="read-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)}>
      <span className="read-progress-fill" style={{ transform: `scaleX(${clamped})` }} />
    </div>
  );
}
