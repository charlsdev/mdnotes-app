// Bloqueo de la app con PIN y/o huella (mismo diseño que rxtribe y daemoni).
//
// Dos capas independientes: solo PIN, solo huella, ambas o ninguna; la app se
// bloquea si hay cualquiera. El PIN va HASHEADO (SHA-256 + salt) en SecureStore
// (keystore cifrado del sistema), nunca en claro.
//
// Diferencia con rxtribe: aquí no hay cuenta ni contraseña con la que volver a
// entrar. La salida de "olvidé el PIN" es el bloqueo de pantalla DEL TELÉFONO
// (`verifyOwner`), y por eso el bloqueo solo se puede activar si el teléfono
// tiene uno (`deviceSecured`). Sin eso, olvidar el PIN dejaría las notas
// internas inaccesibles.
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

export const PIN_LENGTH = 4;

const K = {
  enabled: 'mdnotes.lock.enabled', // '1' si hay PIN configurado
  hash: 'mdnotes.lock.pinHash',
  salt: 'mdnotes.lock.pinSalt',
  bio: 'mdnotes.lock.biometric', // '1' si la huella está activada
};

const hashPin = (pin: string, salt: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

// ----- PIN -----
export async function isPinEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(K.enabled)) === '1';
}

export async function setPin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(K.salt, salt);
  await SecureStore.setItemAsync(K.hash, hash);
  await SecureStore.setItemAsync(K.enabled, '1');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [salt, hash] = await Promise.all([SecureStore.getItemAsync(K.salt), SecureStore.getItemAsync(K.hash)]);
  if (!salt || !hash) return false;
  return (await hashPin(pin, salt)) === hash;
}

// Quita SOLO el PIN (conserva la preferencia de huella).
export async function disablePin(): Promise<void> {
  await Promise.all([K.hash, K.salt, K.enabled].map((k) => SecureStore.deleteItemAsync(k)));
}

// ----- Biometría -----
export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(K.bio)) === '1';
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(K.bio, on ? '1' : '0');
}

// ¿El teléfono tiene huella o rostro configurado?
export async function biometricCapable(): Promise<boolean> {
  const [hasHw, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHw && enrolled;
}

// ¿El teléfono tiene bloqueo de pantalla (PIN, patrón, contraseña o biometría)?
// Es la condición para activar el bloqueo: es la única vía para recuperarlo.
export async function deviceSecured(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

// allowDeviceFallback: deja usar el PIN/patrón del SISTEMA si la huella falla.
// Solo en modo "solo huella" (sin PIN de la app), para no quedar encerrado.
export async function authenticateBiometric(allowDeviceFallback = false): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquea MDNotes',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: !allowDeviceFallback,
    });
    return res.success;
  } catch {
    return false;
  }
}

// Prueba de que quien tiene el teléfono es su dueño: el bloqueo de pantalla del
// sistema (o su huella). Sustituye al "entra con tu contraseña" de las apps con cuenta.
export async function verifyOwner(): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirma con el bloqueo de tu teléfono',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}

// ----- Estado combinado -----
export async function isLockActive(): Promise<boolean> {
  const [pin, bio] = await Promise.all([isPinEnabled(), isBiometricEnabled()]);
  return pin || bio;
}
