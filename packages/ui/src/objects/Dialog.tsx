/**
 * Dialog, Panel, Note — the room's remaining structural composites.
 *
 * Dialog: the overlay composite (scrim + sheet + focus contract). focus
 * is trapped inside while open, Escape closes, the scrim closes — the
 * modal is a place you can leave three ways, all of them honest.
 * Panel: a titled section surface — the workbench's child and the
 * notebook's card.
 * NotePreview: the annotation card — identity swatch + the marked text
 * + its source. a recurring product concept, not a visual arrangement.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Surface } from '../components/Surface.tsx';
import { Text } from '../components/Typography.tsx';
import { IconButton } from '../components/Actions.tsx';
import { Icon } from '../components/Icon.tsx';
import { Stack } from '../layout/Stack.tsx';
import { HighlightMarker, type AnnoIdentity } from '../components/Reader.tsx';

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  /** the actions row — buttons, owned by the caller's intent */
  actions?: ReactNode;
}

export function Dialog({ open, title, onClose, children, actions }: DialogProps): ReactNode {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setReturnFocus(document.activeElement as HTMLElement | null);
    const sheet = sheetRef.current;
    const focusables = sheet?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && sheet) {
        // the focus trap — a modal is a room with one door
        const items = [...sheet.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )].filter((el) => !el.hasAttribute('disabled'));
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      returnFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="dialog" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        className="dialog-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-head">
          <Text as="span" role="title" className="dialog-title">
            {title}
          </Text>
          <IconButton label="close dialog" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div className="dialog-body">{children}</div>
        {actions ? <footer className="dialog-actions">{actions}</footer> : null}
      </div>
    </div>
  );
}

export interface PanelProps {
  title?: string;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}

export function Panel({ title, onClose, children, className = '' }: PanelProps): ReactNode {
  return (
    <Surface material="paper" bordered radius="surface" className={`panel ${className}`.trim()}>
      {title ? (
        <header className="panel-head">
          <Text as="span" role="title" className="panel-title">
            {title}
          </Text>
          {onClose ? (
            <IconButton label={`close ${title}`} onClick={onClose}>
              <Icon name="x" />
            </IconButton>
          ) : null}
        </header>
      ) : null}
      <div className="panel-body">{children}</div>
    </Surface>
  );
}

export interface NotePreviewProps {
  identity: AnnoIdentity;
  text: string;
  /** where the mark lives — chapter + locator phrase */
  source?: string;
  note?: string;
  onOpen?: () => void;
}

export function NotePreview({ identity, text, source, note, onOpen }: NotePreviewProps): ReactNode {
  return (
    <button type="button" className="note-preview" onClick={onOpen}>
      <span className="note-preview-swatch">
        <HighlightMarker identity={identity}>&nbsp;</HighlightMarker>
      </span>
      <Stack gap="s1" className="note-preview-body">
        <span className="note-preview-quote">{text}</span>
        {note ? <span className="note-preview-note">{note}</span> : null}
        {source ? <Text as="span" role="micro">{source}</Text> : null}
      </Stack>
    </button>
  );
}
