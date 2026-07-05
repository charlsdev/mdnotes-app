import { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, StatusBar, Platform } from 'react-native';
import { useTheme, fonts, spacing, radius } from '@/theme';
import { MdFile } from '@/types';
import { NoteTree } from './NoteTree';
import { Footer } from './Footer';

// Cajón deslizante con el árbol de notas — para saltar de un .md a otro desde
// el editor sin volver a la biblioteca. Los insets se pasan como props porque el
// Modal es una ventana aparte donde SafeAreaView no mide bien (Android).
export function NoteTreeDrawer({
  visible,
  notes,
  currentId,
  onSelect,
  onClose,
  topInset = 0,
  bottomInset = 0,
}: {
  visible: boolean;
  notes: MdFile[];
  currentId?: string;
  onSelect: (note: MdFile) => void;
  onClose: () => void;
  topInset?: number;
  bottomInset?: number;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  // En Android StatusBar.currentHeight es lo más fiable dentro de un Modal
  // translúcido; combinamos con el inset por si el status bar es más alto.
  const androidStatusBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  const padTop = Math.max(topInset, androidStatusBar) + spacing.xs;

  const filtered = useMemo(() => {
    if (!query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter((n) => n.name.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }, [notes, query]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.bg, borderRightColor: theme.line, paddingTop: padTop, paddingBottom: bottomInset },
          ]}
        >
          <View style={[styles.head, { borderBottomColor: theme.line }]}>
            <Text style={[styles.title, { color: theme.ink }]}>Notas</Text>
            <Text style={[styles.count, { color: theme.muted }]}>{notes.length}</Text>
          </View>
          <View style={[styles.searchPill, { backgroundColor: theme.bg2 }]}>
            <TextInput
              style={[styles.search, { color: theme.ink }]}
              placeholder="Buscar…"
              placeholderTextColor={theme.muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>
          <NoteTree
            notes={filtered}
            currentId={currentId}
            onSelect={(n) => {
              onSelect(n);
              onClose();
            }}
            footer={<Footer />}
          />
        </View>
        <Pressable style={styles.scrim} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  panel: {
    width: '82%',
    maxWidth: 340,
    borderRightWidth: 1,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(10,9,8,0.5)' },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  title: { fontFamily: fonts.serifSemi, fontSize: 20 },
  count: { fontFamily: fonts.mono, fontSize: 12 },
  searchPill: {
    margin: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  search: { fontFamily: fonts.sans, fontSize: 14 },
});
