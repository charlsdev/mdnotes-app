import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, spacing, radius } from '@/theme';

interface ToolbarProps {
  // `wrap`: texto que envuelve la selección (o queda como par vacío con el cursor
  // en medio). `prefix`: texto que se antepone al inicio de la línea.
  onWrap: (wrap: string) => void;
  onPrefix: (prefix: string) => void;
  onInsert: (text: string, cursorOffset?: number) => void;
  onImage: () => void;
  onClear: () => void;
}

type Action =
  | { kind: 'prefix'; label: string; value: string; style?: object }
  | { kind: 'wrap'; label: string; value: string; style?: object }
  | { kind: 'insert'; label: string; value: string; offset?: number; style?: object }
  | { kind: 'image'; label: string; style?: object }
  | { kind: 'clear'; label: string; style?: object };

const TABLE = '\n| Columna A | Columna B |\n| --- | --- |\n| celda | celda |\n';
const CALLOUT = '\n> [!NOTE]\n> ';
const MATH = '\n$$\n\n$$\n';

const ACTIONS: Action[] = [
  { kind: 'prefix', label: 'H1', value: '# ', style: { fontFamily: fonts.serif } },
  { kind: 'prefix', label: 'H2', value: '## ', style: { fontFamily: fonts.serif } },
  { kind: 'prefix', label: 'H3', value: '### ', style: { fontFamily: fonts.serif } },
  { kind: 'prefix', label: 'H4', value: '#### ', style: { fontFamily: fonts.serif } },
  { kind: 'prefix', label: 'H5', value: '##### ', style: { fontFamily: fonts.serif } },
  { kind: 'prefix', label: 'H6', value: '###### ', style: { fontFamily: fonts.serif } },
  { kind: 'wrap', label: 'B', value: '**', style: { fontFamily: fonts.sansMedium } },
  { kind: 'wrap', label: 'i', value: '_', style: { fontStyle: 'italic' } },
  { kind: 'wrap', label: 'S', value: '~~', style: { textDecorationLine: 'line-through' } },
  { kind: 'wrap', label: '▮', value: '==' }, // resaltado
  { kind: 'clear', label: 'T✕' }, // limpiar formato
  { kind: 'prefix', label: '“', value: '> ' },
  { kind: 'prefix', label: '•', value: '- ' },
  { kind: 'prefix', label: '1.', value: '1. ' },
  { kind: 'prefix', label: '☐', value: '- [ ] ' },
  { kind: 'wrap', label: '<>', value: '`' },
  { kind: 'insert', label: '{ }', value: '\n```\n\n```\n', offset: -5 },
  { kind: 'insert', label: '⊞', value: TABLE }, // tabla
  { kind: 'insert', label: '!', value: CALLOUT, offset: 0 }, // callout
  { kind: 'insert', label: '∑', value: MATH, offset: -3 }, // ecuación
  { kind: 'image', label: '🖼' },
  { kind: 'insert', label: '🔗', value: '[]()', offset: -3 },
  { kind: 'insert', label: '—', value: '\n---\n' },
];

export function EditorToolbar({ onWrap, onPrefix, onInsert, onImage, onClear }: ToolbarProps) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: theme.bg, borderTopColor: theme.line }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.content}
      >
        {ACTIONS.map((a, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.btn, { backgroundColor: theme.bg2 }]}
            onPress={() => {
              Haptics.selectionAsync();
              if (a.kind === 'prefix') onPrefix(a.value);
              else if (a.kind === 'wrap') onWrap(a.value);
              else if (a.kind === 'image') onImage();
              else if (a.kind === 'clear') onClear();
              else onInsert(a.value, a.offset);
            }}
          >
            <Text style={[styles.btnText, { color: theme.ink }, a.style]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  btn: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: fonts.monoMedium, fontSize: 13 },
});
