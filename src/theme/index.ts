import { useColorScheme } from 'react-native';

// Paleta oficial del brand book (brand.md). Bermellón es el ÚNICO acento.
export const lightTheme = {
  bg: '#f5f1ea', // paper
  bg2: '#e8e0d0', // margin — superficies elevadas
  surface: '#ffffff',
  ink: '#1a1714', // tinta, nunca negro puro
  muted: '#8a8275',
  accent: '#c14a2b', // vermilion
  sepia: '#8a7355',
  line: '#d8d2c5',
  codeBg: 'rgba(26,23,20,0.06)',
  codeBlockBg: '#1a1714',
  codeBlockText: '#f5f1ea',
};

export const darkTheme = {
  bg: '#12100e', // nocturne
  bg2: '#1c1a16', // tarjetas
  surface: '#1c1a16',
  ink: '#f5f1ea', // papel sobre fondo oscuro
  muted: '#8a8275',
  accent: '#c14a2b',
  sepia: '#8a7355',
  line: '#2a2620',
  codeBg: 'rgba(245,241,234,0.06)',
  codeBlockBg: '#0a0908',
  codeBlockText: '#f5f1ea',
};

export type Theme = typeof lightTheme;

export const fonts = {
  serif: 'Fraunces_500Medium',
  serifSemi: 'Fraunces_600SemiBold',
  serifItalic: 'Fraunces_400Regular_Italic',
  sans: 'InterTight_400Regular',
  sansMedium: 'InterTight_500Medium',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 28,
  full: 999,
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
