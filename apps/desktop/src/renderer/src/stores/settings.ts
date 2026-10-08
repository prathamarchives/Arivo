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

/** both axes apply to the root, always: temperament (den/lab) and
 *  lighting (paper/sepia/night). persistence is settings.json — gate 13
 *  closed: the picker is the rail's furniture, the boot applies the
 *  saved room, den is the living default (D-003). */
function applyRoom(s: AppSettings): void {
  document.documentElement.dataset.temperament = s.temperament;
  document.documentElement.dataset.theme = s.theme;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
  init: async () => {
    const s = await api.settings.get();
    applyRoom(s);
    set({ settings: s, loaded: true });
  },
  set: (partial) => {
    const next = { ...get().settings, ...partial };
    applyRoom(next);
    set({ settings: next });
    void api.settings.set(next);
  },
}));
