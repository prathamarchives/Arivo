/**
 * Utility — Tooltip, Kbd, VisuallyHidden. the quiet instruments.
 *
 * Tooltip: a glass instrument at z-floating, focus+hover reachable,
 * delayed entry (the pointer is acknowledged, never chased), Escape and
 * blur dismiss it, aria-describedby carries the name to assistive tech.
 * Kbd: the key receipt — mono, sunken ground, the 2px bottom edge.
 * VisuallyHidden: layout-invisible, reader-always.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const TOOLTIP_DELAY = 400; // proximity acknowledgment, not pointer chasing

export function Tooltip({
  text,
  side = 'top',
  children,
}: {
  text: string;
  side?: 'top' | 'bottom';
  children: ReactNode;
}): ReactNode {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const show = (): void => {
    timer.current = setTimeout(() => setOpen(true), TOOLTIP_DELAY);
  };
  const hide = (): void => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span className="tooltip-host">
      <span
        aria-describedby={open ? id : undefined}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide();
        }}
        className="tooltip-anchor"
      >
        {children}
      </span>
      {open ? (
        <span role="tooltip" id={id} className={`tooltip tooltip-${side}`}>
          {text}
        </span>
      ) : null}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }): ReactNode {
  return <span className="kbd">{children}</span>;
}

export function VisuallyHidden({ children }: { children: ReactNode }): ReactNode {
  return <span className="visually-hidden">{children}</span>;
}
