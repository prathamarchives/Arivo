import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from './stores/settings.ts';
import { useLibrary } from './stores/library.ts';
import { useRoom } from './stores/room.ts';
import { Shell } from './shell/Shell.tsx';
import { BookDetail } from './screens/BookDetail.tsx';
import { SettingsScreen } from './screens/Settings.tsx';
import { NotebookScreen } from './screens/Notebook.tsx';
import { CommandPalette } from './features/palette/CommandPalette.tsx';
import { api } from './services/api.ts';

/** the recovery banner: the system tells the truth about itself (item 17) */
function RecoveryBanner(): ReactNode {
  const toast = useRoom((s) => s.toast);
  useEffect(() => {
    void api.recovery.note().then((note) => {
      if (note) toast(note);
    });
  }, [toast]);
  return null;
}

function Toaster(): ReactNode {
  const toasts = useRoom((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast glass">
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function App(): ReactNode {
  const initSettings = useSettings((s) => s.init);
  const refresh = useLibrary((s) => s.refresh);
  const setPaletteOpen = useRoom((s) => s.setPaletteOpen);
  const goShelf = useRoom((s) => s.goShelf);
  const returnToDesk = useRoom((s) => s.returnToDesk);
  const setSettingsOpen = useRoom((s) => s.setSettingsOpen);
  const openNotebook = useRoom((s) => s.openNotebook);
  const notebookOpen = useRoom((s) => s.notebookOpen);

  useEffect(() => {
    void initSettings();
    void refresh();
  }, [initSettings, refresh]);

  /* the room's global keys: the palette (transient), the two places
   * (ctrl+1/2), and settings (ctrl+,). v0.3.2: the design lab door is
   * gone — the lab was a development instrument, not a room. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
      /* v0.3.3 — ctrl+J opens the journal: the notebook, the book of you */
      if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        if (notebookOpen) useRoom.getState().closeNotebook();
        else openNotebook();
        return;
      }
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      if (e.key === '1') {
        e.preventDefault();
        goShelf();
      } else if (e.key === '2') {
        e.preventDefault();
        returnToDesk();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen, goShelf, returnToDesk, setSettingsOpen, openNotebook, notebookOpen]);

  return (
    <>
      <Shell />
      <BookDetail />
      <SettingsScreen />
      <NotebookScreen />
      <CommandPalette />
      <Toaster />
      <RecoveryBanner />
    </>
  );
}
