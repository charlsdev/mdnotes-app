import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, fonts, spacing } from '@/theme';
import { MdFile, fileBadge } from '@/types';
import { buildTreeRows, pathToNote, type TreeGroup } from '@/lib/tree';

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
  groups,
  folders,
  expandAll,
}: {
  notes: MdFile[];
  onSelect: (note: MdFile) => void;
  onLongPressFile?: (note: MdFile) => void;
  currentId?: string;
  header?: React.ReactElement;
  footer?: React.ReactElement;
  // Carpetas abiertas. Con más de una, el árbol antepone una raíz por carpeta.
  groups?: TreeGroup[];
  // Todas las carpetas del vault (para mostrar también las que no tienen notas).
  folders?: string[];
  // Al filtrar hay que abrir todo: si no, los resultados quedan escondidos.
  expandAll?: boolean;
}) {
  const theme = useTheme();
  const grouped = (groups?.length ?? 0) > 1;

  // El árbol arranca RECOGIDO, con abierto solo el camino de la nota activa. Con
  // carpetas de cien archivos, abrirlo todo es un muro.
  const current = notes.find((n) => n.id === currentId);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(pathToNote(current, grouped)));

  // Al saltar de nota, revela la nueva sin cerrar lo que el usuario haya abierto.
  // (Patrón "ajustar estado durante el render": no necesita un efecto.)
  const [revealed, setRevealed] = useState(currentId);
  if (currentId !== revealed) {
    setRevealed(currentId);
    const keys = pathToNote(current, grouped);
    if (keys.length) setExpanded((prev) => new Set([...prev, ...keys]));
  }

  const rows = useMemo(
    () => buildTreeRows(notes, expandAll ? 'all' : expanded, groups, folders),
    [notes, expandAll, expanded, groups, folders]
  );

  const toggle = (path: string) =>
    setExpanded((prev) => {
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
        // Raíz de una carpeta abierta: se distingue de una subcarpeta normal
        // (acento + mayúsculas), si no todo parece el mismo nivel.
        if (item.kind === 'vault') {
          const open = expandAll || expanded.has(item.path);
          return (
            <Pressable
              onPress={() => toggle(item.path)}
              style={({ pressed }) => [
                styles.vaultRow,
                { borderBottomColor: theme.line, paddingLeft: spacing.lg },
                pressed && { backgroundColor: theme.bg2 },
              ]}
            >
              <Chevron open={open} color={theme.accent} />
              <Text style={[styles.vaultName, { color: theme.accent }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.count, { color: theme.muted }]}>{item.count}</Text>
            </Pressable>
          );
        }
        if (item.kind === 'folder') {
          const open = expandAll || expanded.has(item.path);
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
        const badge = fileBadge(item.note);
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
            <Text
              style={[styles.fileName, { color: badge ? theme.muted : active ? theme.accent : theme.ink }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {/* Extensión del archivo: marca lo que NO es una nota (se abre fuera). */}
            {!!badge && <Text style={[styles.badge, { color: theme.sepia, borderColor: theme.line }]}>{badge}</Text>}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  vaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  vaultName: { flex: 1, fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
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
  badge: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: 4,
  },
});
