/**
 * the synthetic room — W6's gate, rendered (the real L7 proof).
 *
 * section 17: BookObject + SelectionMenu + Workbench + Toolbar + Note +
 * Button + Input + Panel + Dialog coexist in one room. if they feel like
 * they belong to the same physical world — same materials, same
 * receipts, same light, one grammar — the foundation is doing its job.
 * if they don't, fix the system BEFORE touching the shelf.
 *
 * interactions that are live here:
 *   - select text in the paragraph → the glass instrument appears AT the
 *     selection (causality + positioning + z-space), pick a color
 *   - hover a book → lift-m + shadow bloom (the quiet precursor)
 *   - open the workbench → resize it by dragging the handle (direct
 *     manipulation, no transition)
 *   - open a book → the dialog (focus trap, escape, scrim)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BookObject,
  SelectionMenu,
  Workbench,
  Dialog,
  Panel,
  NotePreview,
  type BookAura,
} from '../objects/index.ts';
import { Button, IconButton } from '../components/Actions.tsx';
import { Input } from '../components/Inputs.tsx';
import { Icon } from '../components/Icon.tsx';
import { Text, Metadata } from '../components/Typography.tsx';
import { Surface } from '../components/Surface.tsx';
import { Stack } from '../layout/Stack.tsx';
import { Inline } from '../layout/Inline.tsx';
import { HighlightMarker, type AnnoIdentity } from '../components/Reader.tsx';

interface RoomBook {
  id: string;
  title: string;
  author: string;
  progress?: number;
  aura?: BookAura;
}

const BOOKS: RoomBook[] = [
  { id: 'b1', title: 'The Burnout Society', author: 'Byung-Chul Han', progress: 0.34, aura: { h: 36, s: 26, l: 52 } },
  { id: 'b2', title: 'The Master and Margarita', author: 'Mikhail Bulgakov' },
  { id: 'b3', title: 'Essays', author: 'Ursula K. Le Guin', progress: 1 },
  { id: 'b4', title: 'Walden', author: 'Henry D. Thoreau', progress: 0.72 },
];

interface RoomMark {
  identity: AnnoIdentity;
  text: string;
}

export function SyntheticRoomLab(): ReactNode {
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [dialogBook, setDialogBook] = useState<string | null>(null);
  const [workbenchOpen, setWorkbenchOpen] = useState(true);
  const [marks, setMarks] = useState<RoomMark[]>([
    { identity: 'amber', text: 'Exhaustion is the new productivity.' },
    { identity: 'sage', text: 'the violence of positivity' },
  ]);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [liveMark, setLiveMark] = useState<{ identity: AnnoIdentity; range: Range } | null>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);

  const onSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      return; // keep the menu while interacting with it
    }
    const range = sel.getRangeAt(0)!;
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    setAnchor({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
    setLiveMark({ identity: 'amber', range });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [onSelectionChange]);

  const pick = (identity: AnnoIdentity): void => {
    const text = liveMark?.range.toString().trim() ?? 'the marked passage';
    setMarks((m) => [{ identity, text }, ...m].slice(0, 6));
    window.getSelection()?.removeAllRanges();
    setAnchor(null);
    setLiveMark(null);
  };

  const dismiss = (): void => {
    setAnchor(null);
    setLiveMark(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <section className="lab-section">
      <LabHead
        n="17"
        title="the synthetic room — composites coexist"
        note="book · instrument · workbench · dialog — one world"
      />

      <div className="room-stage">
        <div className="room-main">
          {/* the toolbar — floating chrome over the room */}
          <div className="room-toolbar">
            <Inline gap="s1">
              <IconButton label="search the room">
                <Icon name="search" />
              </IconButton>
              <IconButton label="grid view">
                <Icon name="grid" />
              </IconButton>
              <IconButton label="list view">
                <Icon name="list" />
              </IconButton>
            </Inline>
            <Input placeholder="filter the shelf" style={{ width: '180px' }} />
            <Button
              variant="ghost"
              onClick={() => setWorkbenchOpen((v) => !v)}
              state={workbenchOpen ? 'saved' : undefined}
            >
              {workbenchOpen ? 'hide workbench' : 'show workbench'}
            </Button>
          </div>

          {/* the shelf row — book objects */}
          <div className="room-shelf">
            {BOOKS.map((b) => (
              <BookObject
                key={b.id}
                title={b.title}
                author={b.author}
                progress={b.progress}
                aura={b.aura}
                selected={selectedBook === b.id}
                onOpen={() => {
                  setSelectedBook(b.id);
                  setDialogBook(b.id);
                }}
              />
            ))}
          </div>

          {/* the causality stage — select text, meet the instrument */}
          <div className="room-causality">
            <Metadata>select any text — the glass instrument appears at the selection</Metadata>
            <p ref={paragraphRef} className="room-read">
              Neoliberalism turns the violence of positivity against itself. It is
              {' '}<HighlightMarker identity="amber">exhaustion meeting productivity</HighlightMarker>
              , achievement society rendering depression not as the opposite of
              intensity but as its consequence. The room grows around the page; the
              instrument follows the selection; the object you touched is the object
              that moves.
            </p>
          </div>
        </div>

        {/* the workbench — resize by dragging its handle */}
        {workbenchOpen ? (
          <Workbench
            title="workbench"
            open={workbenchOpen}
            onClose={() => setWorkbenchOpen(false)}
            context={<Text role="quiet">the current context: {dialogBook ? BOOKS.find((b) => b.id === dialogBook)?.title : 'the room'}</Text>}
            attachments={[
              { id: 'a1', icon: 'note', label: 'notes · 2' },
              { id: 'a2', icon: 'bookmark', label: 'bookmarks · 5' },
            ]}
          >
            <Panel title="marks">
              <Stack gap="s1" collapse>
                {marks.map((m, i) => (
                  <NotePreview key={i} identity={m.identity} text={m.text} source="ch. 1 · the room" />
                ))}
                {marks.length === 0 ? (
                  <Text role="quiet">no marks yet — select text in the room.</Text>
                ) : null}
              </Stack>
            </Panel>
            <Panel title="note composer">
              <Stack gap="s2">
                <Input placeholder="a note on the marked passage" />
                <Inline gap="s2">
                  <Button size="lg" variant="solid">
                    save note
                  </Button>
                  <Button variant="ghost">cancel</Button>
                </Inline>
              </Stack>
            </Panel>
          </Workbench>
        ) : null}
      </div>

      {/* the selection instrument — glass, causal, z-floating */}
      <SelectionMenu
        anchor={anchor}
        onPick={pick}
        onDismiss={dismiss}
        actions={[
          { id: 'copy', icon: 'note', label: 'copy', onRun: () => dismiss() },
        ]}
      />

      {/* the dialog — a room over the room */}
      <Dialog
        open={dialogBook !== null}
        title={dialogBook ? (BOOKS.find((b) => b.id === dialogBook)?.title ?? '') : ''}
        onClose={() => setDialogBook(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialogBook(null)}>
              stay
            </Button>
            <Button variant="solid" onClick={() => setDialogBook(null)}>
              continue reading
            </Button>
          </>
        }
      >
        <Stack gap="s3">
          <Surface material="paper" sunken radius="surface" padding="s4">
            <Text role="read">
              The dialog is a room over the room: the scrim recedes it, the sheet rises at
              surface mass, focus is trapped inside, and Escape is always a door.
            </Text>
          </Surface>
          <Text role="quiet">
            object continuity lives in the L10 handoff — the book you touched opens as the
            same book. this room proves the materials agree.
          </Text>
        </Stack>
      </Dialog>
    </section>
  );
}

function LabHead({ n, title, note }: { n: string; title: string; note?: string }): ReactNode {
  return (
    <div className="lab-h">
      <span className="meta-label">{n}</span>
      <span className="type-title">{title}</span>
      {note ? <span className="meta-label">{note}</span> : null}
    </div>
  );
}
