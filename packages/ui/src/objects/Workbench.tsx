/**
 * Workbench — the third composite (W6.3): the right-side contextual
 * workspace. the bridge to the desk: it supports open/close/resize/
 * attachments and stays semantically generic — at L10 it BECOMES the
 * desk's instrument column without redesign.
 *
 * resize is direct manipulation: width follows the pointer with NO
 * transition (dragging a transitioned width feels like pulling taffy —
 * the motion law governs state changes, not the user's own hand). the
 * width range is recorded geometry (D-020). open/close enter at surface
 * mass; close is a prop contract (parent owns the unmount timing).
 */
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from '../components/Actions.tsx';
import { Icon } from '../components/Icon.tsx';
import { Stack } from '../layout/Stack.tsx';

const WIDTH_MIN = 300;
const WIDTH_MAX = 460;
const WIDTH_DEFAULT = 360;

export interface WorkbenchAttachment {
  id: string;
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
}

export interface WorkbenchProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
  attachments?: readonly WorkbenchAttachment[];
  /** content above the fold: the current context line */
  context?: ReactNode;
}

export function Workbench({ title, open, onClose, children, attachments, context }: WorkbenchProps): ReactNode {
  const [width, setWidth] = useState(WIDTH_DEFAULT);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { startX: e.clientX, startWidth: width };
    },
    [width],
  );

  const onHandlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return;
    // the workbench grows leftward from the right edge
    const next = drag.current.startWidth - (e.clientX - drag.current.startX);
    setWidth(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, next)));
  }, []);

  const onHandlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  if (!open) return null;

  return (
    <aside className="workbench" style={{ width: `${width}px` }} aria-label={title}>
      <div className="workbench-handle" role="separator" aria-orientation="vertical" aria-label="resize workbench" tabIndex={0}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      />
      <div className="workbench-inner">
        <header className="workbench-head">
          <span className="workbench-title">{title}</span>
          <IconButton label="close workbench" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        {context ? <div className="workbench-context">{context}</div> : null}
        <Stack gap="s3" className="workbench-body">
          {children}
        </Stack>
        {attachments?.length ? (
          <footer className="workbench-attachments">
            {attachments.map((a) => (
              <span key={a.id} className="workbench-attachment">
                <Icon name={a.icon} />
                <span className="workbench-attachment-label">{a.label}</span>
              </span>
            ))}
          </footer>
        ) : null}
      </div>
    </aside>
  );
}
