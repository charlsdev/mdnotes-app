import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttachmentMode } from '@/lib/paths';

export type { AttachmentMode };

const KEY = 'mdnotes:settings';

// Márgenes de PDF disponibles (mm). Etiquetas user-facing en la pantalla de ajustes.
export const PDF_MARGINS = [
  { mm: 8, label: 'Estrecho' },
  { mm: 12, label: 'Normal' },
  { mm: 20, label: 'Amplio' },
  { mm: 28, label: 'Extra' },
];

export type ThemePref = 'system' | 'light' | 'dark';
export type ReadingFont = 'sans' | 'serif' | 'mono';

// Dónde guardar las imágenes que se insertan en una nota de la carpeta abierta.
// 'auto' = la config de Obsidian o la convención que ya usan las notas.
export const ATTACHMENT_MODES: { value: AttachmentMode; label: string }[] = [
  { value: 'auto', label: 'Automática' },
  { value: 'note', label: 'Junto a la nota' },
  { value: 'vault', label: 'Carpeta fija' },
];

export const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export const READING_SIZES = [
  { scale: 0.9, label: 'Pequeña' },
  { scale: 1.0, label: 'Normal' },
  { scale: 1.15, label: 'Grande' },
  { scale: 1.3, label: 'Enorme' },
];

// Familias user-facing para la lectura (VER). Los `stack` van en el WebView.
export const READING_FONTS: { value: ReadingFont; label: string; stack: string }[] = [
  { value: 'sans', label: 'Sans', stack: `-apple-system, Roboto, system-ui, sans-serif` },
  { value: 'serif', label: 'Serif', stack: `Georgia, 'Times New Roman', serif` },
  { value: 'mono', label: 'Mono', stack: `'SF Mono', Menlo, monospace` },
];

interface Settings {
  pdfMarginMm: number;
  autosave: boolean;
  theme: ThemePref;
  readingScale: number;
  readingFont: ReadingFont;
  attachmentMode: AttachmentMode;
  attachmentFolder: string;
}
const DEFAULTS: Settings = {
  pdfMarginMm: 12,
  autosave: true,
  theme: 'system',
  readingScale: 1.0,
  readingFont: 'sans',
  // 'auto' de fábrica: un vault de Obsidian ya trae esta respuesta en su config,
  // no tiene sentido obligar a repetirla.
  attachmentMode: 'auto',
  attachmentFolder: 'img',
};

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  setPdfMargin: (mm: number) => Promise<void>;
  setAutosave: (on: boolean) => Promise<void>;
  setTheme: (t: ThemePref) => Promise<void>;
  setReadingScale: (s: number) => Promise<void>;
  setReadingFont: (f: ReadingFont) => Promise<void>;
  setAttachmentMode: (m: AttachmentMode) => Promise<void>;
  setAttachmentFolder: (f: string) => Promise<void>;
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
  setTheme: async (t) => {
    set({ theme: t });
    await persist(get);
  },
  setReadingScale: async (s) => {
    set({ readingScale: s });
    await persist(get);
  },
  setReadingFont: async (f) => {
    set({ readingFont: f });
    await persist(get);
  },
  setAttachmentMode: async (m) => {
    set({ attachmentMode: m });
    await persist(get);
  },
  setAttachmentFolder: async (f) => {
    set({ attachmentFolder: f });
    await persist(get);
  },
}));

async function persist(get: () => SettingsState) {
  const { pdfMarginMm, autosave, theme, readingScale, readingFont, attachmentMode, attachmentFolder } = get();
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ pdfMarginMm, autosave, theme, readingScale, readingFont, attachmentMode, attachmentFolder })
  );
}
