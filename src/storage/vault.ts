// Vault = una carpeta del sistema (local o Drive) que el usuario "abre" para
// trabajar sus .md EN SITIO: editar en la app escribe de vuelta al archivo real.
// Solo Android (Storage Access Framework). El permiso de la carpeta se persiste,
// así que sobrevive reinicios.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MdFile } from '@/types';
import { computeTags } from '@/utils/text';

const VAULT_KEY = 'mdnotes:vault-uri';
const MD_RE = /\.(md|markdown|txt|mdx)$/i;
const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const SAF = FileSystem.StorageAccessFramework;

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', avif: 'image/avif',
};

export interface VaultScan {
  files: MdFile[];
  // Ruta relativa (ej. "img/foto.png") → URI SAF del archivo, para resolver
  // imágenes locales que referencian las notas.
  images: Record<string, string>;
}

export function vaultSupported(): boolean {
  return Platform.OS === 'android' && !!SAF;
}

export async function getVaultUri(): Promise<string | null> {
  return AsyncStorage.getItem(VAULT_KEY);
}

// Abre el selector de carpetas de Android y persiste el permiso concedido.
export async function pickVault(): Promise<string | null> {
  if (!vaultSupported()) return null;
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  await AsyncStorage.setItem(VAULT_KEY, perm.directoryUri);
  return perm.directoryUri;
}

export async function clearVault(): Promise<void> {
  await AsyncStorage.removeItem(VAULT_KEY);
}

// Nombre legible de la carpeta a partir del tree URI de SAF.
export function vaultName(uri: string): string {
  const dec = decodeURIComponent(uri);
  const afterColon = dec.split(':').pop() ?? dec;
  return afterColon.split(/[/\\]/).filter(Boolean).pop() || 'Carpeta';
}

function fileNameFromUri(uri: string): string {
  return decodeURIComponent(uri).split(/[/\\]/).pop() ?? '';
}

// Id corto, estable y seguro-para-rutas derivado de la URI SAF (la URI cruda
// tiene / y : que rompen expo-router). Determinista → mismo id entre escaneos.
export function vaultIdForUri(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return 'v' + h.toString(36);
}

const MAX_DEPTH = 8;
const MAX_FILES = 1000;

// ¿El hijo es carpeta? Con extensión → archivo (evita llamadas inútiles); si no,
// intentamos listarlo (las subcarpetas locales SÍ son tree URIs válidos).
async function isDirectory(uri: string, name: string): Promise<boolean> {
  if (/\.[a-z0-9]{1,6}$/i.test(name)) return false;
  try {
    await SAF.readDirectoryAsync(uri);
    return true;
  } catch {
    return false;
  }
}

// Escanea el vault RECURSIVO: trae los .md (con su ruta relativa) e indexa las
// imágenes (ruta relativa → URI) para poder resolverlas en el preview.
// La raíz propaga errores (ej. Drive).
export async function listVault(rootUri: string): Promise<VaultScan> {
  const now = Date.now();
  const out: MdFile[] = [];
  const images: Record<string, string> = {};
  let mdSeen = 0;
  let firstError: string | null = null;

  async function walk(dirUri: string, rel: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
    let children: string[];
    try {
      children = await SAF.readDirectoryAsync(dirUri);
    } catch (e) {
      if (depth === 0) throw e; // carpeta raíz ilegible → error real al usuario
      return; // subcarpeta ilegible: la saltamos sin romper el escaneo
    }
    for (const uri of children) {
      if (out.length >= MAX_FILES) return;
      const name = fileNameFromUri(uri);
      const relPath = rel ? `${rel}/${name}` : name;
      if (MD_RE.test(name)) {
        mdSeen++;
        try {
          const content = await FileSystem.readAsStringAsync(uri);
          out.push({
            id: vaultIdForUri(uri),
            uri,
            name: name.replace(MD_RE, ''),
            content,
            createdAt: now,
            updatedAt: now,
            tags: computeTags(content),
            folder: rel,
          });
        } catch (e: any) {
          if (!firstError) firstError = String(e?.message ?? e);
        }
      } else if (IMG_RE.test(name)) {
        images[relPath] = uri;
      } else if (await isDirectory(uri, name)) {
        await walk(uri, relPath, depth + 1);
      }
    }
  }

  await walk(rootUri, '', 0);
  if (mdSeen > 0 && out.length === 0 && firstError) {
    throw new Error(`No pude leer los .md de la carpeta (${firstError})`);
  }
  return { files: out, images };
}

// Lee una imagen del vault y la devuelve como data URI (para inyectar en el preview).
export async function readImageDataUri(uri: string): Promise<string> {
  const ext = (fileNameFromUri(uri).split('.').pop() ?? '').toLowerCase();
  const mime = MIME[ext] ?? 'image/*';
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  return `data:${mime};base64,${b64}`;
}

// Escribe de vuelta al archivo real (edición en sitio).
export async function writeVaultFile(uri: string, content: string): Promise<void> {
  await SAF.writeAsStringAsync(uri, content);
}

// Crea un .md nuevo dentro de la carpeta y devuelve su URI.
export async function createVaultFile(
  dirUri: string,
  baseName: string,
  content: string
): Promise<string> {
  const safe = baseName.replace(/[^\w\-áéíóúñ ]+/gi, '').trim() || 'nota';
  const uri = await SAF.createFileAsync(dirUri, safe, 'text/markdown');
  await SAF.writeAsStringAsync(uri, content);
  return uri;
}

export async function deleteVaultFile(uri: string): Promise<void> {
  await SAF.deleteAsync(uri);
}
