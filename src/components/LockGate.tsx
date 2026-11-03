// Cubre la app con el PIN o la huella al abrirla y al volver del segundo plano.
//
// - Es un <Modal> y no un overlay: el cajón de notas y los diálogos son Modals
//   (ventanas aparte), y un View encima del Stack quedaría DEBAJO de ellos — con
//   el cajón abierto al salir, la nota se vería al volver.
// - GRACE_MS antes de volver a bloquear: elegir una foto, abrir carpeta (SAF),
//   compartir o abrir un adjunto con otra app mandan la app al segundo plano, y
//   pedir el PIN a la vuelta de cada uno sería insufrible.
// - Sin cuenta a la que volver: "¿Olvidaste tu PIN?" y los MAX_TRIES fallos se
//   resuelven con el bloqueo de pantalla del teléfono (`verifyOwner`).
// - Huella activada pero ya no disponible (se borró del teléfono): sigue
//   bloqueada y se abre con el bloqueo del sistema. No se desactiva sola.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PinPad, FingerprintIcon } from '@/components/PinPad';
import { Wordmark } from '@/components/Wordmark';
import { appAlert } from '@/components/AppAlert';
import {
  authenticateBiometric,
  biometricCapable,
  deviceSecured,
  disablePin,
  isBiometricEnabled,
  isPinEnabled,
  verifyOwner,
  verifyPin,
} from '@/storage/lock';
import { useTheme, fonts, radius } from '@/theme';

const GRACE_MS = 30_000;
const MAX_TRIES = 5;

interface LockState {
  checked: boolean;
  locked: boolean;
  pin: boolean;
  bio: boolean; // huella activada (aunque hoy no esté disponible)
  bioUsable: boolean; // y el teléfono la tiene configurada
}
const UNCHECKED: LockState = { checked: false, locked: false, pin: false, bio: false, bioUsable: false };

export function LockGate() {
  const theme = useTheme();
  const [lock, setLock] = useState<LockState>(UNCHECKED);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // key del PinPad: lo vacía
  const [blocked, setBlocked] = useState(false); // demasiados fallos
  const fails = useRef(0);
  const bgAt = useRef<number | null>(null);

  const unlock = useCallback(() => {
    fails.current = 0;
    setBlocked(false);
    setError(null);
    setLock((l) => ({ ...l, locked: false }));
  }, []);

  // allowFallback: el PIN/patrón del sistema, solo si NO hay PIN de la app.
  const tryBiometric = useCallback(
    async (allowFallback: boolean) => {
      if (await authenticateBiometric(allowFallback)) unlock();
    },
    [unlock]
  );

  const lockNow = useCallback(async () => {
    const [pin, bio, capable] = await Promise.all([isPinEnabled(), isBiometricEnabled(), biometricCapable()]);
    const bioUsable = bio && capable;
    setError(null);
    setAttempt((n) => n + 1);
    setLock({ checked: true, locked: pin || bio, pin, bio, bioUsable });
    if (bioUsable) tryBiometric(!pin);
  }, [tryBiometric]);

  useEffect(() => {
    lockNow();
  }, [lockNow]);

  useEffect(() => {
    // 'background' y no 'inactive': el aviso de la huella pasa por 'inactive'
    // y bloquearía en bucle.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        bgAt.current = Date.now();
      } else if (next === 'active' && bgAt.current) {
        const away = Date.now() - bgAt.current;
        bgAt.current = null;
        if (away >= GRACE_MS) lockNow();
      }
    });
    return () => sub.remove();
  }, [lockNow]);

  const onPin = async (pin: string) => {
    if (await verifyPin(pin)) return unlock();
    fails.current += 1;
    if (fails.current >= MAX_TRIES) {
      setBlocked(true);
      return;
    }
    setError(`PIN incorrecto. Te quedan ${MAX_TRIES - fails.current} intentos.`);
    setAttempt((n) => n + 1);
  };

  // Tras MAX_TRIES fallos: se abre con el bloqueo del teléfono, el PIN se conserva.
  const unlockWithOwner = async () => {
    if (await ownerConfirmed()) unlock();
  };

  const forgot = () =>
    appAlert(
      '¿Olvidaste tu PIN?',
      'Confirma con el bloqueo de pantalla de tu teléfono y quito el PIN de MDNotes. Después puedes elegir uno nuevo en Ajustes. Tus notas no se tocan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            if (!(await ownerConfirmed())) return;
            await disablePin();
            unlock();
            setLock((l) => ({ ...l, pin: false }));
            appAlert('Quité el PIN', 'Elige uno nuevo en Ajustes → Bloqueo.', undefined, { variant: 'success' });
          },
        },
      ],
      { variant: 'info' }
    );

  const cover = !lock.checked || lock.locked;

  const forgotLink = (
    <Pressable onPress={forgot} hitSlop={10} style={{ marginTop: 22 }}>
      <Text style={[styles.link, { color: theme.muted }]}>¿Olvidaste tu PIN?</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={cover}
      animationType="none"
      statusBarTranslucent
      // Atrás no puede cerrar el bloqueo: manda la app al fondo.
      onRequestClose={() => BackHandler.exitApp()}
    >
      <View style={[styles.fill, { backgroundColor: theme.bg }]}>
        {lock.checked && lock.pin && !blocked ? (
          <PinPad
            key={attempt}
            title="MDNotes está bloqueada"
            subtitle="Escribe tu PIN"
            error={error}
            onComplete={onPin}
            onBiometric={lock.bioUsable ? () => tryBiometric(false) : undefined}
            footer={forgotLink}
          />
        ) : null}

        {lock.checked && lock.pin && blocked ? (
          <Centered>
            <Wordmark size={30} />
            <Text style={[styles.title, { color: theme.ink }]}>Demasiados intentos</Text>
            <Text style={[styles.text, { color: theme.muted }]}>
              Para seguir, confirma con el bloqueo de pantalla de tu teléfono.
            </Text>
            <PrimaryButton label="Usar el bloqueo del teléfono" onPress={unlockWithOwner} />
          </Centered>
        ) : null}

        {lock.checked && !lock.pin && lock.bio ? (
          <Centered>
            <Wordmark size={30} />
            <FingerprintIcon color={theme.accent} size={64} />
            <Text style={[styles.title, { color: theme.ink }]}>MDNotes está bloqueada</Text>
            <PrimaryButton
              label={lock.bioUsable ? 'Desbloquear' : 'Usar el bloqueo del teléfono'}
              onPress={lock.bioUsable ? () => tryBiometric(true) : unlockWithOwner}
            />
          </Centered>
        ) : null}
      </View>
    </Modal>
  );
}

// Bloqueo de pantalla del teléfono. Si el teléfono no tiene uno (lo quitaron
// después de activar el de la app), lo dice; si solo se canceló, silencio.
async function ownerConfirmed(): Promise<boolean> {
  if (!(await deviceSecured())) {
    appAlert(
      'Tu teléfono no tiene bloqueo de pantalla',
      'Es lo que confirma que eres tú. Configura un PIN, patrón o huella en los ajustes de Android y vuelve a intentarlo.',
      undefined,
      { variant: 'warn' }
    );
    return false;
  }
  return verifyOwner();
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.button, { backgroundColor: theme.accent }]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, padding: 32 },
  title: { fontFamily: fonts.serifSemi, fontSize: 20, textAlign: 'center' },
  text: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  link: { fontFamily: fonts.sansMedium, fontSize: 13 },
  button: { borderRadius: radius.md, paddingHorizontal: 22, paddingVertical: 13 },
  buttonText: { fontFamily: fonts.sansMedium, fontSize: 14, color: '#f5f1ea' },
});
