/**
 * the arivo wordmark — the mark + the name, one lockup.
 *
 * the mark: a frame (the book) with one filled place (where you are in
 * it). the name speaks the wordmark cut (Helvetica Light, lowercase,
 * tight); the period is drawn, not typed — a filled dot that lands on
 * the baseline like a reader's dot. drawn marks survive scale and theme
 * (currentColor) where a styled text period would not.
 *
 * compact: the mark alone — the rail's collapsed voice. full: the mark
 * + the name + the drawn period (the rail expanded, the empty rooms).
 */
import type { ReactNode } from 'react';

/** the mark — a frame with a place marked in it */
function Mark({ size }: { size: number }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className="wordmark-mark"
    >
      <rect x="2.75" y="2.75" width="22.5" height="22.5" rx="7.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="14" r="4.75" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }): ReactNode {
  if (compact) return <Mark size={24} />;
  return (
    <span className="wordmark" aria-label="arivo">
      <Mark size={22} />
      <span className="wordmark-text" aria-hidden="true">
        arivo
      </span>
      <span className="wordmark-period" aria-hidden="true" />
    </span>
  );
}
