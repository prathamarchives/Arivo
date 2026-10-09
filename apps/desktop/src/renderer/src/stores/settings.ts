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

/** the light applies to the root, always (v0.3.2: light/dark, nothing
 *  else). persistence is settings.json — the picker is the rail's foot,
 *  the boot applies the saved light. */
function applyRoom(s: AppSettings): void {
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
