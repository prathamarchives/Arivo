import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { DesignLab } from '@arivo/ui';
import { useSettings } from './stores/settings.ts';
import { useLibrary } from './stores/library.ts';
import { useRoom } from './stores/room.ts';
import { Shell } from './shell/Shell.tsx';
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
  const goArchive = useRoom((s) => s.goArchive);
  const labMode = window.location.hash === '#lab';

  useEffect(() => {
    if (labMode) {
      /* the lab is isolated from product state — no settings/library boot */
      document.documentElement.dataset.temperament ??= 'den';
      document.documentElement.dataset.theme ??= 'paper';
      return;
    }
    void initSettings();
    void refresh();
  }, [labMode, initSettings, refresh]);

  /* the room's global keys: the palette (transient), the three places
   * (ctrl+1/2/3), and the design lab door (ctrl+shift+l). */
  useEffect(() => {
    if (labMode) return;
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        window.location.hash = 'lab';
        window.location.reload();
        return;
      }
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      if (e.key === '1') {
        e.preventDefault();
        goShelf();
      } else if (e.key === '2') {
        e.preventDefault();
        returnToDesk();
      } else if (e.key === '3') {
        e.preventDefault();
        goArchive();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [labMode, setPaletteOpen, goShelf, returnToDesk, goArchive]);

  return (
    <>
      {labMode ? <DesignLab /> : <Shell />}
      {labMode ? null : <CommandPalette />}
      {labMode ? null : <Toaster />}
      {labMode ? null : <RecoveryBanner />}
    </>
  );
}
