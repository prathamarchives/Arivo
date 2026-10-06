import { create } from 'zustand';

export type View = { kind: 'library' } | { kind: 'reader'; bookId: string };

interface UiState {
  view: View;
  paletteOpen: boolean;
  toasts: { id: number; text: string }[];
  openReader: (bookId: string) => void;
  backToLibrary: () => void;
  setPaletteOpen: (open: boolean) => void;
  toast: (text: string) => void;
}

let toastSeq = 0;

export const useUi = create<UiState>((set, get) => ({
  view: { kind: 'library' },
  paletteOpen: false,
  toasts: [],
  openReader: (bookId) => set({ view: { kind: 'reader', bookId } }),
  backToLibrary: () => set({ view: { kind: 'library' } }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  toast: (text) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, text }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 2600);
  },
}));
