/**
 * the arivo wordmark — v0.3.2, the simplification: the name IS the mark.
 *
 * "arivo" speaks the wordmark cut (Helvetica Light, lowercase, tight);
 * the period is drawn, not typed — a filled dot that lands on the
 * baseline like a reader's dot. drawn marks survive scale and theme
 * (currentColor) where a styled text period would not.
 *
 * compact: "a." — the monogram (the letter + the drawn period), the
 * rail's collapsed voice and the app icon's grammar. full: the name +
 * the period.
 */
import type { ReactNode } from 'react';

function Period({ size }: { size: number }): ReactNode {
  return (
    <span
      className="wordmark-period"
      aria-hidden="true"
      style={{ width: size, height: size }}
    />
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }): ReactNode {
  if (compact) {
    return (
      <span className="wordmark wordmark-compact" aria-label="arivo">
        <span className="wordmark-compact-letter" aria-hidden="true">
          a
        </span>
        <Period size={4} />
      </span>
    );
  }
  return (
    <span className="wordmark" aria-label="arivo">
      <span className="wordmark-text" aria-hidden="true">
        arivo
      </span>
      <Period size={6} />
    </span>
  );
}
