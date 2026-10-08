import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from './stores/settings.ts';
import { useLibrary } from './stores/library.ts';
import { useUi } from './stores/ui.ts';
import { LibraryScreen } from './screens/Library.tsx';
import { ReaderScreen } from './screens/Reader.tsx';
import { BookDetail } from './screens/BookDetail.tsx';
import { SettingsScreen } from './screens/Settings.tsx';
import { CommandPalette } from './features/palette/CommandPalette.tsx';
import { api } from './services/api.ts';

/** the recovery banner: the system tells the truth about itself (item 17) */
function RecoveryBanner(): ReactNode {
  const toast = useUi((s) => s.toast);
  useEffect(() => {
    void api.recovery.note().then((note) => {
      if (note) toast(note);
    });
  }, [toast]);
  return null;
}

function Toaster(): ReactNode {
  const toasts = useUi((s) => s.toasts);
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
  const view = useUi((s) => s.view);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const initSettings = useSettings((s) => s.init);
  const refresh = useLibrary((s) => s.refresh);

  useEffect(() => {
    void initSettings();
    void refresh();
  }, [initSettings, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen]);

  return (
    <>
      {view.kind === 'library' ? <LibraryScreen /> : <ReaderScreen bookId={view.bookId} />}
      <BookDetail />
      <SettingsScreen />
      <CommandPalette />
      <Toaster />
      <RecoveryBanner />
    </>
  );
}
