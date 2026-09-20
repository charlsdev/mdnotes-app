import { create } from 'zustand';
import { MdFile } from '@/types';
import * as FilesAPI from '@/storage/files';
import * as Vault from '@/storage/vault';
import { computeTags, elideDataUris } from '@/utils/text';

// Una carpeta abierta. `id` es el hash de su URI raíz: es lo que llevan las notas
// en `vaultId` y lo que usa el árbol para agruparlas.
export interface VaultRef {
  id: string;
  uri: string;
  name: string;
}

interface FilesState {
  files: MdFile[];
  loading: boolean;
  loaded: boolean;
  vaults: VaultRef[];
  // Índice de imágenes POR carpeta: dos carpetas pueden tener un `img/logo.png`
  // cada una, y un índice plano mostraría la imagen equivocada.
  vaultImages: Record<string, Record<string, string>>;
  // Carpeta donde se creó la última nota (se ofrece primero al preguntar destino).
  lastVaultId: string | null;
  load: () => Promise<void>;
  // Abre otra carpeta. Devuelve cuántos .md encontró (null si se canceló).
  // Lanza si no se puede leer.
  openVault: () => Promise<{ name: string; count: number; already?: boolean } | null>;
  closeVault: (vaultId: string) => Promise<void>;
  // Contenido COMPLETO desde el disco (el de `files` es la copia ligera).
  readContent: (file: MdFile) => Promise<string>;
  // Registra un adjunto recién creado para que el preview lo resuelva sin re-escanear.
  addVaultImage: (vaultId: string, relPath: string, uri: string) => void;
  // Devuelve la nota como quedó (la URI puede cambiar si hubo que recrear el archivo).
  upsert: (file: MdFile) => Promise<MdFile>;
  remove: (id: string) => Promise<void>;
  // `vaultId` decide en qué carpeta abierta se crea; sin él (o sin carpetas), interna.
  create: (name?: string, vaultId?: string) => Promise<MdFile>;
  createWith: (name: string, content: string, vaultId?: string) => Promise<MdFile>;
}

const STARTER = '# Nueva nota\n\nEscribe en Markdown. Alterna VIVO / MD / VER arriba a la derecha.';

const byRecent = (a: MdFile, b: MdFile) => b.updatedAt - a.updatedAt;

// Cola de operaciones de disco: NUNCA dos a la vez.
// `writeVaultFile` borra y recrea el archivo cuando hay que truncarlo, y durante
// esos milisegundos el .md no existe. Un segundo guardado cayendo en ese hueco
// falla con "Location '…' isn't writable" (que es lo que SAF responde cuando el
// documento no está). Pasa de verdad: el autoguardado con debounce y el flush al
// salir/saltar de nota pueden solaparse.
let diskQueue: Promise<unknown> = Promise.resolve();

function queued<T>(op: () => Promise<T>): Promise<T> {
  const next = diskQueue.then(op, op); // corre igual si la anterior falló
  diskQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  loading: false,
  loaded: false,
  vaults: [],
  vaultImages: {},
  lastVaultId: null,

  load: async () => {
    set({ loading: true });
    const uris = await Vault.getVaultUris();
    const internal = await FilesAPI.listFiles();
    const vaults: VaultRef[] = [];
    const vaultFiles: MdFile[] = [];
    const images: Record<string, Record<string, string>> = {};

    for (const uri of uris) {
      try {
        const scan = await Vault.listVault(uri);
        const id = Vault.vaultIdForUri(uri);
        vaults.push({ id, uri, name: Vault.vaultName(uri) });
        vaultFiles.push(...scan.files);
        images[id] = scan.images;
      } catch {
        // Permiso perdido (carpeta movida / revocada): olvidamos ESA carpeta y
        // seguimos con el resto — una rota no puede dejarte sin las demás.
      }
    }
    if (vaults.length !== uris.length) {
      await Vault.setVaultUris(vaults.map((v) => v.uri));
    }

    set({
      files: [...vaultFiles, ...internal].sort(byRecent),
      vaults,
      vaultImages: images,
      lastVaultId: await Vault.getLastVaultId(),
      loading: false,
      loaded: true,
    });
  },

  // Abre OTRA carpeta (se suman, no se reemplazan). Lista sus .md aquí mismo (sin
  // tragar errores) para poder dar feedback real. Lanza si SAF no puede leerla.
  openVault: async () => {
    const uri = await Vault.pickVault();
    if (!uri) return null;
    const id = Vault.vaultIdForUri(uri);
    if (get().vaults.some((v) => v.id === id)) {
      const name = Vault.vaultName(uri);
      return { name, count: get().files.filter((f) => f.vaultId === id).length, already: true };
    }
    set({ loading: true }); // escanear la carpeta (leer los .md) puede tardar
    try {
      const scan = await Vault.listVault(uri);
      const vault: VaultRef = { id, uri, name: Vault.vaultName(uri) };
      const vaults = [...get().vaults, vault];
      await Vault.setVaultUris(vaults.map((v) => v.uri));
      set({
        vaults,
        files: [...scan.files, ...get().files].sort(byRecent),
        vaultImages: { ...get().vaultImages, [id]: scan.images },
        loaded: true,
        loading: false,
      });
      return { name: vault.name, count: scan.files.length };
    } catch (e) {
      // No dejes persistida una carpeta que no se puede leer (ej. Google Drive).
      // Las que ya estaban abiertas no se tocan.
      set({ loading: false });
      throw e;
    }
  },

  // Cierra una carpeta: saca sus notas de la lista sin re-escanear las demás.
  closeVault: async (vaultId) => {
    const vaults = get().vaults.filter((v) => v.id !== vaultId);
    await Vault.setVaultUris(vaults.map((v) => v.uri));
    const images = { ...get().vaultImages };
    delete images[vaultId];
    set({
      vaults,
      files: get().files.filter((f) => f.vaultId !== vaultId),
      vaultImages: images,
      lastVaultId: get().lastVaultId === vaultId ? null : get().lastVaultId,
    });
  },

  readContent: async (file) => {
    return file.uri ? Vault.readVaultFile(file.uri) : FilesAPI.readContent(file.id);
  },

  addVaultImage: (vaultId, relPath, uri) => {
    const images = get().vaultImages;
    set({ vaultImages: { ...images, [vaultId]: { ...(images[vaultId] ?? {}), [relPath]: uri } } });
  },

  // Persiste el .md y refleja el resultado en la lista. LANZA si la escritura
  // falla (permiso revocado, tarjeta removida, archivo borrado desde otra app):
  // el editor lo captura y avisa en vez de decir "Guardado" sin haber guardado.
  upsert: (file) =>
    queued(async () => {
      let uri = file.uri;
      if (uri) {
        // Puede devolver otra URI si hubo que recrear el archivo para truncarlo.
        uri = await Vault.writeVaultFile(uri, file.content, file.dirUri);
      } else {
        await FilesAPI.saveFile(file);
      }
      const stored: MdFile = { ...file, uri, content: elideDataUris(file.content) };
      const others = get().files.filter((f) => f.id !== file.id);
      set({ files: [stored, ...others].sort(byRecent) });
      return stored;
    }),

  remove: (id) =>
    queued(async () => {
      const file = get().files.find((f) => f.id === id);
      if (file?.uri) await Vault.deleteVaultFile(file.uri);
      else await FilesAPI.deleteFile(id);
      set({ files: get().files.filter((f) => f.id !== id) });
    }),

  create: (name, vaultId) => queued(() => createNote(set, get, name ?? 'Nueva nota', STARTER, vaultId)),

  // Importa una nota (nombre + contenido). Con carpeta abierta, la escribe como
  // archivo real dentro de ella; si no, la guarda interna.
  createWith: (name, content, vaultId) =>
    queued(() => createNote(set, get, name || 'Importada', content, vaultId)),
}));

// Crea la nota en la carpeta indicada (o interna si no hay). Es común a "nota
// nueva" e "importar": la única diferencia entre ambas era el contenido inicial.
async function createNote(
  set: (partial: Partial<FilesState>) => void,
  get: () => FilesState,
  name: string,
  content: string,
  vaultId?: string
): Promise<MdFile> {
  const now = Date.now();
  // Sin destino explícito: la última usada, y si no hay, la única abierta. Con
  // varias abiertas y sin recuerdo, la biblioteca pregunta antes de llegar acá.
  const vaults = get().vaults;
  const target =
    vaults.find((v) => v.id === vaultId) ??
    vaults.find((v) => v.id === get().lastVaultId) ??
    (vaults.length === 1 ? vaults[0] : undefined);

  if (target) {
    const uri = await Vault.createVaultFile(target.uri, name, content);
    const file: MdFile = {
      id: Vault.vaultIdForUri(uri),
      uri,
      dirUri: target.uri,
      vaultId: target.id,
      name,
      content: elideDataUris(content),
      createdAt: now,
      updatedAt: now,
      tags: computeTags(content),
    };
    await Vault.setLastVaultId(target.id);
    set({ files: [file, ...get().files], lastVaultId: target.id });
    return { ...file, content };
  }

  const file: MdFile = {
    id: FilesAPI.newFileId(),
    name,
    content,
    createdAt: now,
    updatedAt: now,
    tags: computeTags(content),
  };
  await FilesAPI.saveFile(file);
  set({ files: [{ ...file, content: elideDataUris(content) }, ...get().files] });
  return file;
}
