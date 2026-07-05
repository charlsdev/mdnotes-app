import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, radius } from '@/theme';
import { EditorMode } from '@/types';

interface Props {
  mode: EditorMode;
  onChange: (m: EditorMode) => void;
}

const LABELS: Record<EditorMode, string> = { live: 'VIVO', code: 'MD', view: 'VER' };
const ORDER: EditorMode[] = ['live', 'code', 'view'];

export function ModeToggle({ mode, onChange }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.bg2 }]}>
      {ORDER.map((m) => {
        const active = m === mode;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(m);
            }}
            style={[styles.opt, active && { backgroundColor: theme.ink }]}
          >
            <Text style={[styles.txt, { color: active ? theme.bg : theme.muted }]}>{LABELS[m]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: radius.full,
  },
  opt: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  txt: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1 },
});
