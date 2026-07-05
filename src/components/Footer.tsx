import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useTheme, fonts, spacing } from '@/theme';
import { CharlsdevMark } from './CharlsdevMark';

// Footer de marca personal — presente en todas las apps del usuario.
export function Footer() {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => Linking.openURL('https://charlsdev.xyz')}
      >
        <Text style={[styles.by, { color: theme.muted }]}>por</Text>
        <CharlsdevMark size={15} />
        <Text style={[styles.name, { color: theme.ink }]}>charlsdev</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  by: { fontFamily: fonts.mono, fontSize: 11 },
  name: { fontFamily: fonts.monoMedium, fontSize: 12 },
});
