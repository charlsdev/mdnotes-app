import { create } from 'zustand';
import { MdFile } from '@/types';
import * as FilesAPI from '@/storage/files';
import * as Vault from '@/storage/vault';
import { extractTags } from '@/utils/text';

interface FilesState {
  files: MdFile[];
  loading: boolean;
  loaded: boolean;
  vaultUri: string | null;
  vaultName: string | null;
  vaultImages: Record<string, string>;
  load: () => Promise<void>;
  // Devuelve cuántos .md encontró (null si se canceló). Lanza si no puede leer.
  openVault: () => Promise<number | null>;
  closeVault: () => Promise<void>;
  upsert: (file: MdFile) => Promise<void>;
  remove: (id: string) => Promise<void>;
  create: (name?: string) => Promise<MdFile>;
  createWith: (name: string, content: string) => Promise<MdFile>;
}

const STARTER = '# Nueva nota\n\nEscribe en Markdown. Alterna EDIT / VIEW arriba a la derecha.';

const byRecent = (a: MdFile, b: MdFile) => b.updatedAt - a.updatedAt;

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  loading: false,
  loaded: false,
  vaultUri: null,
  vaultName: null,
  vaultImages: {},

  load: async () => {
    set({ loading: true });
    let vaultUri = await Vault.getVaultUri();
    const internal = await FilesAPI.listFiles();
    let vaultFiles: MdFile[] = [];
    let images: Record<string, string> = {};
    if (vaultUri) {
      try {
        const scan = await Vault.listVault(vaultUri);
        vaultFiles = scan.files;
        images = scan.images;
      } catch {
        // Permiso perdido (carpeta movida / revocada): olvidamos el vault.
        await Vault.clearVault();
        vaultUri = null;
      }
    }
    set({
      files: [...vaultFiles, ...internal].sort(byRecent),
      vaultUri,
      vaultName: vaultUri ? Vault.vaultName(vaultUri) : null,
      vaultImages: images,
      loading: false,
      loaded: true,
    });
  },

  // Abre (o cambia) la carpeta vault. Lista sus .md aquí mismo (sin tragar
  // errores) para poder dar feedback real. Lanza si SAF no puede leer la carpeta.
  openVault: async () => {
    const uri = await Vault.pickVault();
    if (!uri) return null;
    set({ loading: true }); // escanear la carpeta (leer los .md) puede tardar
    try {
      const scan = await Vault.listVault(uri);
      const internal = await FilesAPI.listFiles();
      set({
        vaultUri: uri,
        vaultName: Vault.vaultName(uri),
        files: [...scan.files, ...internal].sort(byRecent),
        vaultImages: scan.images,
        loaded: true,
        loading: false,
      });
      return scan.files.length;
    } catch (e) {
      // No dejes persistida una carpeta que no se puede leer (ej. Google Drive).
      await Vault.clearVault();
      set({ vaultUri: null, vaultName: null, loading: false });
      throw e;
    }
  },

  closeVault: async () => {
    await Vault.clearVault();
    set({ vaultUri: null, vaultName: null });
    await get().load();
  },

  upsert: async (file) => {
    const others = get().files.filter((f) => f.id !== file.id);
    set({ files: [file, ...others].sort(byRecent) });
    if (file.uri) await Vault.writeVaultFile(file.uri, file.content);
    else await FilesAPI.saveFile(file);
  },

  remove: async (id) => {
    const file = get().files.find((f) => f.id === id);
    set({ files: get().files.filter((f) => f.id !== id) });
    if (file?.uri) await Vault.deleteVaultFile(file.uri);
    else await FilesAPI.deleteFile(id);
  },

  create: async (name) => {
    const now = Date.now();
    const vaultUri = get().vaultUri;
    // Con carpeta abierta, la nota nueva es un archivo real dentro de ella.
    if (vaultUri) {
      const uri = await Vault.createVaultFile(vaultUri, name ?? 'Nueva nota', STARTER);
      const file: MdFile = {
        id: Vault.vaultIdForUri(uri),
        uri,
        name: name ?? 'Nueva nota',
        content: STARTER,
        createdAt: now,
        updatedAt: now,
        tags: [],
      };
      set({ files: [file, ...get().files] });
      return file;
    }
    const file: MdFile = {
      id: FilesAPI.newFileId(),
      name: name ?? 'Nueva nota',
      content: STARTER,
      createdAt: now,
      updatedAt: now,
      tags: [],
    };
    await FilesAPI.saveFile(file);
    set({ files: [file, ...get().files] });
    return file;
  },

  // Importa una nota (nombre + contenido). Con vault abierto, la escribe como
  // archivo real en la carpeta; si no, la guarda interna.
  createWith: async (name, content) => {
    const now = Date.now();
    const vaultUri = get().vaultUri;
    if (vaultUri) {
      const uri = await Vault.createVaultFile(vaultUri, name || 'Importada', content);
      const file: MdFile = {
        id: Vault.vaultIdForUri(uri),
        uri,
        name: name || 'Importada',
        content,
        createdAt: now,
        updatedAt: now,
        tags: extractTags(content),
      };
      set({ files: [file, ...get().files] });
      return file;
    }
    const file: MdFile = {
      id: FilesAPI.newFileId(),
      name: name || 'Importada',
      content,
      createdAt: now,
      updatedAt: now,
      tags: extractTags(content),
    };
    await FilesAPI.saveFile(file);
    set({ files: [file, ...get().files] });
    return file;
  },
}));
