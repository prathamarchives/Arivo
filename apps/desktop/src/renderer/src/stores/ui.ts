import { create } from 'zustand';

export type View = { kind: 'library' } | { kind: 'reader'; bookId: string };

interface UiState {
  view: View;
  paletteOpen: boolean;
  settingsOpen: boolean;
  /** the book whose detail drawer is open (library-side, bookId-keyed) */
  detailBookId: string | null;
  toasts: { id: number; text: string }[];
  openReader: (bookId: string) => void;
  backToLibrary: () => void;
  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  openBookDetail: (bookId: string) => void;
  closeBookDetail: () => void;
  toast: (text: string) => void;
}

let toastSeq = 0;

export const useUi = create<UiState>((set, get) => ({
  view: { kind: 'library' },
  paletteOpen: false,
  settingsOpen: false,
  detailBookId: null,
  toasts: [],
  openReader: (bookId) => set({ view: { kind: 'reader', bookId } }),
  backToLibrary: () => set({ view: { kind: 'library' } }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  openBookDetail: (bookId) => set({ detailBookId: bookId }),
  closeBookDetail: () => set({ detailBookId: null }),
  toast: (text) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, text }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 2600);
  },
}));
