import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { fonts, type Theme } from '@/theme';

export type SaveState = 'saved' | 'saving' | 'dirty';

// Indicador de guardado. Con autosave: muestra estado. Manual: botón "Guardar"
// cuando hay cambios sin guardar.
export function SaveIndicator({
  state,
  autosave,
  onSave,
  theme,
}: {
  state: SaveState;
  autosave: boolean;
  onSave: () => void;
  theme: Theme;
}) {
  if (!autosave && state === 'dirty') {
    return (
      <TouchableOpacity onPress={onSave} style={[styles.pill, { backgroundColor: theme.accent }]}>
        <Text style={[styles.pillText, { color: '#f5f1ea' }]}>Guardar</Text>
      </TouchableOpacity>
    );
  }
  const label = state === 'saving' ? 'Guardando…' : 'Guardado';
  const color = state === 'saving' ? theme.accent : theme.muted;
  return <Text style={[styles.text, { color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.3 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.5 },
});
