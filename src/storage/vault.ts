// Vault = una carpeta del sistema (local o Drive) que el usuario "abre" para
// trabajar sus .md EN SITIO: editar en la app escribe de vuelta al archivo real.
// Solo Android (Storage Access Framework). El permiso de la carpeta se persiste,
// así que sobrevive reinicios.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
// API nueva (SDK 54): `size` y `modificationTime` son propiedades SÍNCRONAS y sí
// funcionan sobre URIs SAF — la legacy no expone la fecha de un content://.
import { File } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MdFile } from '@/types';
import { computeTags, elideDataUris, utf8Length } from '@/utils/text';

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
          const mtime = fileModifiedAt(uri);
          out.push({
            id: vaultIdForUri(uri),
            uri,
            dirUri,
            name: name.replace(MD_RE, ''),
            // Copia ligera para listar/buscar; el editor relee el archivo completo.
            content: elideDataUris(content),
            // Fecha real del archivo. Si el proveedor no la da, 0 → la UI no muestra hora.
            createdAt: mtime,
            updatedAt: mtime,
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

// Fecha de modificación real del archivo (ms epoch), o 0 si no se puede leer.
function fileModifiedAt(uri: string): number {
  try {
    return new File(uri).modificationTime ?? 0;
  } catch {
    return 0;
  }
}

// Tamaño real en bytes, o -1 si no se puede leer.
function fileSize(uri: string): number {
  try {
    return new File(uri).size ?? -1;
  } catch {
    return -1;
  }
}

// Lee el contenido COMPLETO del archivo (con los base64 de las imágenes). Es lo
// que edita y guarda el editor; el store solo conserva la copia ligera.
export async function readVaultFile(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri);
}

// URI SAF de la carpeta contenedora, derivada del document id (`primary:Docs/sub/x.md`
// → `primary:Docs/sub`). Solo se usa como respaldo cuando la nota no trae `dirUri`;
// funciona con los proveedores locales, que son los únicos que el vault admite.
function parentDirUri(uri: string): string | null {
  const i = uri.lastIndexOf('/document/');
  if (i < 0) return null;
  const head = uri.slice(0, i + '/document/'.length);
  const docId = uri.slice(i + '/document/'.length);
  const cut = docId.toUpperCase().lastIndexOf('%2F');
  if (cut < 0) return null;
  return head + docId.slice(0, cut);
}

// Extensión → mime que Android reconstruye SIN renombrar el archivo al recrearlo.
const RECREATE_MIME: Record<string, string> = { md: 'text/markdown', txt: 'text/plain' };

// Escribe de vuelta al archivo real (edición en sitio). Devuelve la URI final.
//
// GOTCHA (bug del texto duplicado al final): expo-file-system escribe en SAF con
// `contentResolver.openOutputStream(uri)`, o sea modo "w", que en ExternalStorageProvider
// NO trunca el archivo. Al guardar un texto más corto que el anterior, la COLA del
// contenido viejo queda pegada al final del .md y reaparece en VIVO/MD/VER (está en el
// archivo, no en el render). Como no podemos pedir modo "wt" desde JS, detectamos el
// sobrante comparando bytes y recreamos el archivo.
//
// El orden importa: primero escribimos (el archivo nunca queda vacío ni a medias) y
// solo después borramos/recreamos. En los proveedores locales el document id se deriva
// de la ruta, así que el archivo recreado conserva la MISMA URI.
export async function writeVaultFile(
  uri: string,
  content: string,
  dirUri?: string
): Promise<string> {
  await SAF.writeAsStringAsync(uri, content);

  const expected = utf8Length(content);
  const actual = fileSize(uri);
  if (actual <= expected || actual < 0) return uri; // sin cola sobrante

  const name = fileNameFromUri(uri);
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  const mime = RECREATE_MIME[ext];
  const dir = dirUri ?? parentDirUri(uri);
  // Sin carpeta conocida, o con una extensión que Android renombraría al recrear
  // (.markdown/.mdx → .md), preferimos dejar la cola antes que perder o renombrar
  // el archivo del usuario.
  if (!dir || !mime) return uri;

  await SAF.deleteAsync(uri);
  try {
    // Nombre COMPLETO (con extensión) y mime que le corresponde: así el proveedor
    // reusa el nombre tal cual en vez de agregar otra extensión.
    const recreated = await SAF.createFileAsync(dir, name, mime);
    await SAF.writeAsStringAsync(recreated, content);
    return recreated;
  } catch {
    // El original ya no existe: reintenta con nombre saneado antes que dejar la
    // nota sin archivo. Si esto también falla, el error sube y la UI lo muestra.
    const fallback = await SAF.createFileAsync(dir, sanitizeName(name.replace(MD_RE, '')), 'text/markdown');
    await SAF.writeAsStringAsync(fallback, content);
    return fallback;
  }
}

function sanitizeName(baseName: string): string {
  return baseName.replace(/[^\w\-áéíóúñ ]+/gi, '').trim() || 'nota';
}

// Crea un .md nuevo dentro de la carpeta y devuelve su URI.
export async function createVaultFile(
  dirUri: string,
  baseName: string,
  content: string
): Promise<string> {
  // Con la extensión incluida: si el mapa de mimes de Android no conoce
  // `text/markdown` (versiones viejas), sin ella el archivo se crearía SIN `.md`.
  const uri = await SAF.createFileAsync(dirUri, `${sanitizeName(baseName)}.md`, 'text/markdown');
  await SAF.writeAsStringAsync(uri, content);
  return uri;
}

export async function deleteVaultFile(uri: string): Promise<void> {
  await SAF.deleteAsync(uri);
}
