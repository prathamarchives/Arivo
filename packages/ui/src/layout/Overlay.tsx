/**
 * Overlay — the scrim + sheet layer of z-space (law 47).
 *
 * overlays live at --z-overlay: drawers, menus with scrims, the composer.
 * the scrim reuses --img-scrim (theme-independent dark, D-016) — a scrim
 * must read as "the room recedes", never as a new color. the sheet itself
 * enters with surface mass (glide in / retreat out — MOTION.md), which
 * the composite layer owns; this primitive is the geometry only.
 */
import type { ReactNode } from 'react';
import { stepClass, type SpacingStep } from './steps.ts';

export interface OverlayProps {
  /** the open state — false unmounts (exits are the parent's transition) */
  open: boolean;
  /** clicking the scrim dismisses (wire to your close intent) */
  onScrimClick?: () => void;
  /** the sheet's breathing */
  pad?: SpacingStep;
  className?: string;
  children?: ReactNode;
}

export function Overlay({ open, onScrimClick, pad = 's6', className = '', children }: OverlayProps): ReactNode {
  if (!open) return null;
  return (
    <div className={`overlay ${className}`.trim()} role="presentation" onClick={onScrimClick}>
      <div
        className={`overlay-sheet overlay-pad-${stepClass(pad)}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          e.stopPropagation(); // the sheet is not the scrim
        }}
      >
        {children}
      </div>
    </div>
  );
}
