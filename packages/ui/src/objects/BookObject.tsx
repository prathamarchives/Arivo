/**
 * BookObject — the book as an object (L7 composite, completed by L9's
 * shelf object system). the canonical physical interaction lives here:
 *
 *   pointer approaches → the book acknowledges (lift, glide) →
 *   light/shadow responds (contact+ambient bloom, the aura wakes in den) →
 *   a pull-forward feeling (press: the object tips toward the hand) →
 *   contextual actions reveal (the dots, on hover and on keyboard focus)
 *
 *   no bounce, no gimmicky 3d, no scale-only hover — mass, lift, shadow.
 *
 * the object carries its truth states honestly: format (pdf badge),
 * missing file (the shelf's flag — annotations are safe), progress
 * (the hairline), the current-book privilege (den booklight aura),
 * long titles (clamped, never truncated mid-thought), and the designed
 * typographic fallback when the author shipped no art (D-019).
 *
 * object continuity: `onOpen` is the pull-forward's destination hook —
 * the shared-element flight to the desk lands with L10; the press
 * receipt here is its seed. `onActions` reveals the object's context
 * menu (add to list, export, remove) without leaving the shelf.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Text, Metadata } from '../components/Typography.tsx';
import { ProgressMarker } from '../components/Reader.tsx';
import { Icon } from '../components/Icon.tsx';

export interface BookAura {
  /** the book tints the light — h/s/l the pipeline derived from the cover */
  h: number;
  s: number;
  l: number;
}

export interface BookObjectProps {
  title: string;
  author?: string;
  /** cover image url; absent → the designed typographic fallback */
  cover?: string;
  /** 0..1 reading progress; undefined = unread */
  progress?: number;
  selected?: boolean;
  /** the pull-forward launch: the object was taken — the desk opens */
  opening?: boolean;
  /** the open intent carries the pointer event: ctrl/cmd+click is the
   *  shelf's selection shortcut (the event is how the shelf learns) */
  onOpen?: (e?: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  /** contextual actions — the dots reveal on hover/focus; the shelf's
   *  book menu (collections, export, remove) lives behind it */
  onActions?: (x: number, y: number) => void;
  /** the den booklight slot — the pipeline writes it for the current
   *  book; lab suppresses it via the root alpha */
  aura?: BookAura;
  /** selection mode: the tap becomes a checkbox (aria-pressed) — the
   *  object's identity stays, its immediate job changes */
  selectionMode?: boolean;
  /** pdf is a truth about the object, shown as the quiet format badge */
  format?: 'epub' | 'pdf';
  /** the file is gone but truth remains — shown honestly, never hidden */
  missing?: boolean;
  /** the current-book privilege: the object that owns the desk */
  current?: boolean;
  size?: 'md' | 'sm';
}

export function BookObject({
  title,
  author,
  cover,
  progress,
  selected,
  opening,
  onOpen,
  onActions,
  aura,
  format,
  missing,
  current,
  selectionMode = false,
  size = 'md',
}: BookObjectProps): ReactNode {
  /* a broken cover is a missing cover: the designed typographic
   * fallback speaks (D-019) — never a broken-image glyph */
  const [broken, setBroken] = useState(false);
  const showCover = cover && !broken;
  const auraStyle = aura
    ? ({
        '--aura-h': `${aura.h}`,
        '--aura-s': `${aura.s}%`,
        '--aura-l': `${aura.l}%`,
      } as React.CSSProperties)
    : undefined;

  const state = opening ? 'opening' : selected ? 'selected' : current ? 'current' : 'rest';

  return (
    <div
      className={`book-object bo-${size} ${selected ? 'is-selected' : ''} ${current ? 'is-current' : ''} ${opening ? 'is-opening' : ''}`.trim()}
      style={auraStyle}
      data-aura={aura ? 'on' : 'off'}
      data-state={state}
    >
      {aura ? <span className="bo-aura" aria-hidden="true" /> : null}
      <button
        type="button"
        className="bo-tap"
        onClick={(e) => onOpen?.({ ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey })}
        aria-pressed={selectionMode ? Boolean(selected) : undefined}
        aria-label={
          selectionMode
            ? `${selected ? 'deselect' : 'select'} ${title}`
            : author
              ? `${title} — ${author}${progress ? `, ${Math.round(progress * 100)}%` : ''}`
              : title
        }
      >
        <span className="bo-cover">
          {showCover ? (
            <img
              className="bo-img"
              src={cover}
              alt=""
              loading="lazy"
              onError={() => setBroken(true)}
            />
          ) : (
            <span className="bo-fallback">
              <span className="bo-fallback-title">{title}</span>
              <span className="bo-spine" aria-hidden="true" />
            </span>
          )}
          {/* the spine fold — covers are physical: they fold toward the
              spine. matte, 1 token, never decoration */}
          {showCover ? <span className="bo-fold" aria-hidden="true" /> : null}
          {format === 'pdf' ? (
            <span className="bo-badge" aria-label="pdf">
              PDF
            </span>
          ) : null}
          {missing ? (
            <span className="bo-badge bo-badge-missing" aria-label="file missing">
              missing
            </span>
          ) : null}
        </span>
        <span className="bo-meta">
          <Text as="span" role="control" className="bo-title">
            {title}
          </Text>
          {author ? (
            <Text as="span" role="quiet" className="bo-author">
              {author}
            </Text>
          ) : null}
          {progress !== undefined ? <ProgressMarker value={progress} label={`${title} progress`} /> : null}
        </span>
      </button>
      <div className="bo-foot">
        {progress !== undefined && progress > 0 && progress < 1 ? (
          <Metadata className="bo-progress-label">{Math.round(progress * 100)}%</Metadata>
        ) : progress !== undefined && progress >= 1 ? (
          <Metadata className="bo-progress-label">finished</Metadata>
        ) : (
          <span />
        )}
        {onActions ? (
          <button
            type="button"
            className="bo-actions"
            aria-label={`${title} actions`}
            onClick={(e) => {
              e.stopPropagation();
              onActions(e.clientX, e.clientY);
            }}
          >
            <Icon name="dots" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
