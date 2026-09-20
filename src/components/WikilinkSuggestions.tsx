import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, spacing, radius } from '@/theme';
import { MdFile } from '@/types';

// Tira de sugerencias que aparece sobre la toolbar mientras escribís `[[` en modo MD.
// Es una fila horizontal (no un popover): en el teléfono no hay espacio para flotar
// sobre el texto sin tapar justo lo que estás escribiendo.
export function WikilinkSuggestions({
  notes,
  onPick,
}: {
  notes: MdFile[];
  onPick: (note: MdFile) => void;
}) {
  const theme = useTheme();
  if (!notes.length) return null;

  return (
    <View style={[styles.bar, { borderTopColor: theme.line, backgroundColor: theme.bg }]}>
      <Text style={[styles.hint, { color: theme.muted }]}>[[</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
        <View style={styles.row}>
          {notes.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                Haptics.selectionAsync();
                onPick(n);
              }}
              style={[styles.chip, { backgroundColor: theme.bg2 }]}
            >
              <Text style={[styles.chipText, { color: theme.ink }]} numberOfLines={1}>
                {n.name}
              </Text>
              {!!n.folder && (
                <Text style={[styles.chipFolder, { color: theme.muted }]} numberOfLines={1}>
                  {n.folder}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  hint: { fontFamily: fonts.mono, fontSize: 12 },
  row: { flexDirection: 'row', gap: 6 },
  chip: {
    maxWidth: 200,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  chipFolder: { fontFamily: fonts.mono, fontSize: 9, marginTop: 1 },
});
