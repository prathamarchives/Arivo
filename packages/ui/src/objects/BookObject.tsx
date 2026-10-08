/**
 * BookObject — the first serious composite (W6.1). it must teach the
 * whole foundation to hold together:
 *
 *   material (paper/fallback cover) · depth (contact+ambient) ·
 *   booklight (aura slot, den only) · hover (component glide, lift-m +
 *   shadow bloom — the quiet precursor; the physical shelf-hover is L9) ·
 *   cover treatment (image + scrim, or the designed typographic
 *   fallback) · metadata hierarchy (title/author, two inks) ·
 *   progress (the hairline, transform) · selection (ink ring + sunken) ·
 *   accessibility (a button that opens; a checkbox-row pattern for
 *   selection mode is L9's concern) · object continuity (open = the
 *   object is the same thing, never a page swap — L10 wires the actual
 *   shared-element handoff; the hover vocabulary here is its seed).
 */
import type { ReactNode } from 'react';
import { Text, Metadata } from '../components/Typography.tsx';
import { ProgressMarker } from '../components/Reader.tsx';

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
  onOpen?: () => void;
  /** the den booklight slot — lab/pipeline writes it, lab suppresses it */
  aura?: BookAura;
  size?: 'md' | 'sm';
}

export function BookObject({
  title,
  author,
  cover,
  progress,
  selected,
  onOpen,
  aura,
  size = 'md',
}: BookObjectProps): ReactNode {
  const auraStyle = aura
    ? ({
        '--aura-h': `${aura.h}`,
        '--aura-s': `${aura.s}%`,
        '--aura-l': `${aura.l}%`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={`book-object bo-${size} ${selected ? 'is-selected' : ''}`.trim()}
      style={auraStyle}
      data-aura={aura ? 'on' : 'off'}
    >
      {aura ? <span className="bo-aura" aria-hidden="true" /> : null}
      <button
        type="button"
        className="bo-tap"
        onClick={onOpen}
        aria-label={author ? `${title} — ${author}` : title}
      >
        <span className="bo-cover">
          {cover ? (
            <img className="bo-img" src={cover} alt="" loading="lazy" />
          ) : (
            <span className="bo-fallback">
              <span className="bo-fallback-title">{title}</span>
              <span className="bo-spine" aria-hidden="true" />
            </span>
          )}
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
      {progress !== undefined && progress > 0 && progress < 1 ? (
        <Metadata className="bo-progress-label">
          {Math.round(progress * 100)}%
        </Metadata>
      ) : progress !== undefined && progress >= 1 ? (
        <Metadata className="bo-progress-label">finished</Metadata>
      ) : null}
    </div>
  );
}
