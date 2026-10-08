/**
 * SelectionMenu — the second composite (W6.2): the glass instrument that
 * floats AT the selection. it proves:
 *
 *   glass (blur budget spent on exactly this) · z-space (z-floating, over
 *   content, under overlays) · selection state (the dots, identity law) ·
 *   motion (surface-mass glide in — never decorative, always causal) ·
 *   positioning (anchored to the selection rect, clamped to viewport) ·
 *   causality (no selection, no instrument — it exists because text is
 *   selected) · reader chrome (glass over glyphs is allowed HERE because
 *   it is chrome beside the selection, never a blur over the text itself).
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Selection, type AnnoIdentity } from '../components/Reader.tsx';
import { Icon } from '../components/Icon.tsx';

export interface SelectionMenuAction {
  id: string;
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onRun: () => void;
}

export interface SelectionMenuProps {
  /** the anchor rect (from window.getSelection() range) — the cause */
  anchor: { x: number; y: number; width: number; height: number } | null;
  onPick: (identity: AnnoIdentity) => void;
  actions?: readonly SelectionMenuAction[];
  onDismiss?: () => void;
}

const MARGIN = 8;

export function SelectionMenu({ anchor, onPick, actions, onDismiss }: SelectionMenuProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor || !ref.current) return;
    const el = ref.current;
    const { width: mw } = el.getBoundingClientRect();
    // clamp to the viewport: the instrument never leaves the room
    const left = Math.min(
      Math.max(MARGIN, anchor.x + anchor.width / 2 - mw / 2),
      window.innerWidth - mw - MARGIN,
    );
    const top = Math.max(MARGIN, anchor.y - el.offsetHeight - MARGIN);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anchor, onDismiss]);

  if (!anchor) return null;

  return (
    <div ref={ref} className="sel-menu-float" role="toolbar" aria-label="selection actions">
      <Selection onPick={onPick} />
      {actions?.length ? (
        <>
          <span className="sel-menu-rule" aria-hidden="true" />
          {actions.map((a) => (
            <button key={a.id} type="button" className="sel-action" aria-label={a.label} onClick={a.onRun}>
              <Icon name={a.icon} />
            </button>
          ))}
        </>
      ) : null}
    </div>
  );
}
