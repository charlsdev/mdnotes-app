// Teclado de PIN (desbloqueo y alta), como el de rxtribe.
//
// Llama onComplete(pin) al llegar a PIN_LENGTH dígitos. Para limpiarlo (PIN
// incorrecto, paso de confirmar) el padre le cambia la `key`: se vuelve a montar
// vacío, sin effects que reseteen estado.
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Wordmark } from '@/components/Wordmark';
import { PIN_LENGTH } from '@/storage/lock';
import { useTheme, fonts } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

export function FingerprintIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <Path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <Path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <Path d="M2 12a10 10 0 0 1 18-6" />
      <Path d="M2 16h.01" />
      <Path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <Path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <Path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <Path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </Svg>
  );
}

function BackspaceIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <Path d="m12 9 6 6" />
      <Path d="m18 9-6 6" />
    </Svg>
  );
}

export function PinPad({
  title,
  subtitle,
  error,
  onComplete,
  onBiometric,
  footer,
}: {
  title: string;
  subtitle: string;
  error?: string | null;
  onComplete: (pin: string) => void;
  onBiometric?: () => void;
  footer?: ReactNode;
}) {
  const theme = useTheme();
  const [pin, setPin] = useState('');

  const press = (k: string) => {
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + k;
    setPin(next);
    if (next.length === PIN_LENGTH) onComplete(next);
  };

  return (
    <View style={styles.wrap}>
      <Wordmark size={30} />
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: error ? theme.accent : theme.muted }]}>{error || subtitle}</Text>

      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                borderColor: i < pin.length ? theme.accent : theme.line,
                backgroundColor: i < pin.length ? theme.accent : 'transparent',
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.keys}>
        {KEYS.map((k) => {
          if (k === 'bio') {
            return (
              <Key key={k} onPress={onBiometric} disabled={!onBiometric} label="Huella">
                {onBiometric ? <FingerprintIcon color={theme.accent} /> : null}
              </Key>
            );
          }
          return (
            <Key key={k} onPress={() => press(k)} label={k === 'del' ? 'Borrar' : k}>
              {k === 'del' ? (
                <BackspaceIcon color={theme.muted} />
              ) : (
                <Text style={[styles.digit, { color: theme.ink }]}>{k}</Text>
              )}
            </Key>
          );
        })}
      </View>

      {footer}
    </View>
  );
}

function Key({
  children,
  onPress,
  disabled,
  label,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.key, { backgroundColor: pressed ? theme.bg2 : 'transparent' }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontFamily: fonts.serifSemi, fontSize: 22, marginTop: 18 },
  subtitle: { fontFamily: fonts.sans, fontSize: 13, marginTop: 6, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 16, marginTop: 26, marginBottom: 30 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', width: 264, justifyContent: 'space-between' },
  key: { width: 78, height: 64, marginVertical: 6, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.sans, fontSize: 26 },
});
