// Sección "Bloqueo" de Ajustes: PIN y huella, independientes (ver storage/lock.ts).
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PinPad } from '@/components/PinPad';
import { appAlert } from '@/components/AppAlert';
import {
  authenticateBiometric,
  biometricCapable,
  deviceSecured,
  disablePin,
  isBiometricEnabled,
  isPinEnabled,
  setBiometricEnabled,
  setPin,
} from '@/storage/lock';
import { useTheme, fonts, spacing } from '@/theme';

interface State {
  pin: boolean;
  bio: boolean;
  capable: boolean;
  secured: boolean;
}

export function LockSettings({ sectionStyle, rowStyle, labelStyle, hintStyle, noteStyle }: {
  sectionStyle: object;
  rowStyle: object;
  labelStyle: object;
  hintStyle: object;
  noteStyle: object;
}) {
  const theme = useTheme();
  const [lock, setLock] = useState<State | null>(null);
  const [setup, setSetup] = useState(false);

  const reload = useCallback(async () => {
    const [pin, bio, capable, secured] = await Promise.all([
      isPinEnabled(),
      isBiometricEnabled(),
      biometricCapable(),
      deviceSecured(),
    ]);
    setLock({ pin, bio, capable, secured });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!lock) return null;

  // Sin bloqueo de pantalla en el teléfono no habría cómo recuperar un PIN
  // olvidado (no hay cuenta): no se deja activar. Apagar sí, siempre.
  const needsDeviceLock = () => {
    appAlert(
      'Primero, un bloqueo en el teléfono',
      'Si olvidas el PIN, MDNotes te deja entrar confirmando con el bloqueo de pantalla del teléfono (PIN, patrón o huella). Configura uno en los ajustes de Android y vuelve aquí.',
      undefined,
      { variant: 'info' }
    );
  };

  const togglePin = async () => {
    Haptics.selectionAsync();
    if (!lock.pin) {
      if (!lock.secured) return needsDeviceLock();
      return setSetup(true);
    }
    await disablePin();
    reload();
  };

  const toggleBio = async () => {
    Haptics.selectionAsync();
    if (!lock.bio) {
      if (!lock.capable) {
        appAlert(
          'Sin huella en este teléfono',
          'Registra tu huella o tu rostro en los ajustes de Android para usarla aquí.',
          undefined,
          { variant: 'info' }
        );
        return;
      }
      // Se prueba una vez al activarla: así no se descubre que no funciona justo
      // cuando hace falta para entrar.
      if (!(await authenticateBiometric(true))) return;
    }
    await setBiometricEnabled(!lock.bio);
    reload();
  };

  const bioOn = lock.bio && lock.capable;
  const anyOn = lock.pin || lock.bio;

  return (
    <>
      <Text style={[sectionStyle, { color: theme.accent }]}>— BLOQUEO</Text>
      <View style={[rowStyle, { borderBottomColor: theme.line }]}>
        <View style={{ flex: 1 }}>
          <Text style={[labelStyle, { color: theme.ink }]}>PIN</Text>
          <Text style={[hintStyle, { color: theme.muted }]}>
            {lock.pin ? 'Pide un PIN de 4 cifras al abrir la app.' : 'Desactivado.'}
          </Text>
          {lock.pin ? (
            <Pressable onPress={() => setSetup(true)} hitSlop={8} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
              <Text style={[styles.link, { color: theme.accent }]}>Cambiar PIN</Text>
            </Pressable>
          ) : null}
        </View>
        <Switch
          value={lock.pin}
          onValueChange={togglePin}
          trackColor={{ true: theme.accent, false: theme.line }}
          thumbColor="#f5f1ea"
        />
      </View>
      <View style={[rowStyle, { borderBottomColor: theme.line }]}>
        <View style={{ flex: 1 }}>
          <Text style={[labelStyle, { color: theme.ink }]}>Huella o rostro</Text>
          <Text style={[hintStyle, { color: theme.muted }]}>
            {!lock.capable && !lock.bio
              ? 'Este teléfono no tiene huella ni rostro registrados.'
              : bioOn
                ? 'Desbloquea con tu huella o tu rostro.'
                : lock.bio
                  ? 'Activada, pero el teléfono ya no tiene huella: se abre con su bloqueo de pantalla.'
                  : 'Desactivada.'}
          </Text>
        </View>
        <Switch
          value={lock.bio}
          onValueChange={toggleBio}
          disabled={!lock.capable && !lock.bio}
          trackColor={{ true: theme.accent, false: theme.line }}
          thumbColor="#f5f1ea"
        />
      </View>
      <Text style={[noteStyle, { color: theme.muted }]}>
        {anyOn
          ? 'Se vuelve a bloquear tras 30 s fuera de la app. Si olvidas el PIN, entras con el bloqueo de pantalla del teléfono.'
          : 'Protege tus notas de quien tome tu teléfono desbloqueado. Los archivos de tus carpetas siguen siendo archivos normales del teléfono.'}
      </Text>

      <PinSetup
        visible={setup}
        onClose={() => setSetup(false)}
        onDone={() => {
          setSetup(false);
          appAlert('PIN guardado', 'Se pedirá al abrir MDNotes.', undefined, { variant: 'success' });
          reload();
        }}
      />
    </>
  );
}

// Elegir PIN: se escribe dos veces. Pantalla completa, como el desbloqueo.
function PinSetup({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0); // key del PinPad

  // Cada vez que se abre, empieza de cero (ajuste durante el render, no effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setFirst(null);
      setError(null);
      setRound((n) => n + 1);
    }
  }

  const onComplete = async (pin: string) => {
    if (first === null) {
      setFirst(pin);
      setError(null);
    } else if (pin === first) {
      await setPin(pin);
      onDone();
      return;
    } else {
      setFirst(null);
      setError('No coinciden. Empieza de nuevo.');
    }
    setRound((n) => n + 1);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.fill, { backgroundColor: theme.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.closeRow}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancelar">
            <Text style={[styles.close, { color: theme.muted }]}>✕</Text>
          </Pressable>
        </View>
        <PinPad
          key={round}
          title={first === null ? 'Nuevo PIN' : 'Confírmalo'}
          subtitle={first === null ? 'Elige 4 cifras' : 'Escríbelo otra vez'}
          error={error}
          onComplete={onComplete}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  closeRow: { alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  close: { fontSize: 22 },
  link: { fontFamily: fonts.sansMedium, fontSize: 13 },
});
