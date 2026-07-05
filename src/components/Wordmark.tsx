import { View, Text, StyleSheet } from 'react-native';
import { useTheme, fonts } from '@/theme';

// Wordmark editorial: "MD" grueso + "Notes" fino, con la línea + punto
// bermellón al margen izquierdo (el acento de la marca).
export function Wordmark({ size = 20 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.margin}>
        <View style={[styles.dot, { backgroundColor: theme.accent }]} />
        <View style={[styles.line, { backgroundColor: theme.accent, height: size }]} />
      </View>
      <Text style={[styles.md, { color: theme.ink, fontSize: size }]}>
        MD
        <Text style={[styles.notes, { color: theme.ink }]}>Notes</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  margin: { alignItems: 'center', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  line: { width: 2, borderRadius: 1 },
  md: { fontFamily: fonts.serifSemi, letterSpacing: -0.5 },
  notes: { fontFamily: fonts.serif },
});
