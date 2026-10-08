import { create } from 'zustand';
import type { AppSettings } from '@arivo/core';
import { DEFAULT_SETTINGS } from '@arivo/core';
import { api } from '../services/api.ts';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  init: () => Promise<void>;
  set: (partial: Partial<AppSettings>) => void;
}

function applyTheme(theme: AppSettings['theme']): void {
  document.documentElement.dataset.theme = theme;
  /* the temperament axis — den is the living default; lab is opt-in.
     persistence + picker land with the L8 shell work (GATES.md). */
  if (!document.documentElement.dataset.temperament) {
    document.documentElement.dataset.temperament = 'den';
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
  init: async () => {
    const s = await api.settings.get();
    applyTheme(s.theme);
    set({ settings: s, loaded: true });
  },
  set: (partial) => {
    const next = { ...get().settings, ...partial };
    applyTheme(next.theme);
    set({ settings: next });
    void api.settings.set(next);
  },
}));
