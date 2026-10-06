import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from './stores/settings.ts';
import { useLibrary } from './stores/library.ts';
import { useUi } from './stores/ui.ts';
import { LibraryScreen } from './screens/Library.tsx';
import { ReaderScreen } from './screens/Reader.tsx';
import { CommandPalette } from './features/palette/CommandPalette.tsx';

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
      <CommandPalette />
      <Toaster />
    </>
  );
}
