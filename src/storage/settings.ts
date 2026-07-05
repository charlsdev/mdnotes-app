import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mdnotes:settings';

// Márgenes de PDF disponibles (mm). Etiquetas user-facing en la pantalla de ajustes.
export const PDF_MARGINS = [
  { mm: 8, label: 'Estrecho' },
  { mm: 12, label: 'Normal' },
  { mm: 20, label: 'Amplio' },
  { mm: 28, label: 'Extra' },
];

interface Settings {
  pdfMarginMm: number;
  autosave: boolean;
}
const DEFAULTS: Settings = { pdfMarginMm: 12, autosave: true };

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  setPdfMargin: (mm: number) => Promise<void>;
  setAutosave: (on: boolean) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // ignorar: usamos defaults
    }
    set({ loaded: true });
  },

  setPdfMargin: async (mm) => {
    set({ pdfMarginMm: mm });
    await persist(get);
  },

  setAutosave: async (on) => {
    set({ autosave: on });
    await persist(get);
  },
}));

async function persist(get: () => SettingsState) {
  const { pdfMarginMm, autosave } = get();
  await AsyncStorage.setItem(KEY, JSON.stringify({ pdfMarginMm, autosave }));
}
