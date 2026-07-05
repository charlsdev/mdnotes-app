import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, spacing, radius } from '@/theme';

// Barra de tags editables (chips + input). Los tags viven en el frontmatter del .md.
export function TagsBar({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');

  const commit = () => {
    const t = draft.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) {
      Haptics.selectionAsync();
      onAdd(t);
    }
    setDraft('');
  };

  return (
    <View style={[styles.bar, { borderBottomColor: theme.line }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {tags.map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              Haptics.selectionAsync();
              onRemove(t);
            }}
            style={[styles.chip, { backgroundColor: theme.bg2 }]}
          >
            <Text style={[styles.chipText, { color: theme.sepia }]}>#{t}</Text>
            <Text style={[styles.chipX, { color: theme.muted }]}>✕</Text>
          </Pressable>
        ))}
        <TextInput
          style={[styles.input, { color: theme.ink }]}
          placeholder={tags.length ? '+ tag' : '+ Agregar tag'}
          placeholderTextColor={theme.muted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onBlur={commit}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          blurOnSubmit={false}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  content: { alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  chipText: { fontFamily: fonts.mono, fontSize: 11 },
  chipX: { fontSize: 10 },
  input: { minWidth: 110, fontFamily: fonts.mono, fontSize: 12, paddingVertical: 4 },
});
