import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, fonts, spacing } from '@/theme';
import { MdFile } from '@/types';
import { buildTreeRows } from '@/lib/tree';

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d={open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} />
    </Svg>
  );
}

// Árbol de carpetas + notas (colapsable). Reutilizable en la biblioteca y en el
// cajón del editor. `currentId` resalta la nota abierta.
export function NoteTree({
  notes,
  onSelect,
  onLongPressFile,
  currentId,
  header,
  footer,
}: {
  notes: MdFile[];
  onSelect: (note: MdFile) => void;
  onLongPressFile?: (note: MdFile) => void;
  currentId?: string;
  header?: React.ReactElement;
  footer?: React.ReactElement;
}) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const rows = useMemo(() => buildTreeRows(notes, collapsed), [notes, collapsed]);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 100 }}
      renderItem={({ item }) => {
        const indent = spacing.lg + item.depth * 16;
        if (item.kind === 'folder') {
          const open = !collapsed.has(item.path);
          return (
            <Pressable
              onPress={() => toggle(item.path)}
              style={({ pressed }) => [styles.folderRow, { paddingLeft: indent }, pressed && { backgroundColor: theme.bg2 }]}
            >
              <Chevron open={open} color={theme.muted} />
              <Text style={[styles.folderName, { color: theme.ink }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.count, { color: theme.muted }]}>{item.count}</Text>
            </Pressable>
          );
        }
        const active = item.note.id === currentId;
        return (
          <Pressable
            onPress={() => onSelect(item.note)}
            onLongPress={onLongPressFile ? () => onLongPressFile(item.note) : undefined}
            delayLongPress={350}
            style={({ pressed }) => [
              styles.fileRow,
              { paddingLeft: indent + 18 },
              active && { backgroundColor: theme.bg2, borderLeftColor: theme.accent, borderLeftWidth: 2 },
              pressed && { backgroundColor: theme.bg2 },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: active ? theme.accent : theme.line }]} />
            <Text style={[styles.fileName, { color: active ? theme.accent : theme.ink }]} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: spacing.lg,
    paddingVertical: 10,
  },
  folderName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14 },
  count: { fontFamily: fonts.mono, fontSize: 11 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: spacing.lg,
    paddingVertical: 9,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  fileName: { flex: 1, fontFamily: fonts.sans, fontSize: 14 },
});
