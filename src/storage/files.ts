// SDK 54 movió la API clásica (documentDirectory/readAsStringAsync/…) a /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MdFile } from '@/types';

const DOCS_DIR = FileSystem.documentDirectory + 'notes/';
const INDEX_KEY = 'mdnotes:index';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DOCS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOCS_DIR, { intermediates: true });
  }
}

export async function listFiles(): Promise<MdFile[]> {
  await ensureDir();
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const ids: string[] = JSON.parse(raw);
    const files: MdFile[] = [];
    for (const id of ids) {
      const file = await readFile(id);
      if (file) files.push(file);
    }
    return files.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function readFile(id: string): Promise<MdFile | null> {
  try {
    const path = DOCS_DIR + id + '.md';
    const metaPath = DOCS_DIR + id + '.meta.json';
    const content = await FileSystem.readAsStringAsync(path);
    const metaRaw = await FileSystem.readAsStringAsync(metaPath);
    const meta = JSON.parse(metaRaw);
    return { ...meta, content };
  } catch {
    return null;
  }
}

export async function saveFile(file: MdFile): Promise<void> {
  await ensureDir();
  const path = DOCS_DIR + file.id + '.md';
  const metaPath = DOCS_DIR + file.id + '.meta.json';
  await FileSystem.writeAsStringAsync(path, file.content);
  const meta = {
    id: file.id,
    name: file.name,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    tags: file.tags ?? [],
  };
  await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(meta));
  await updateIndex(file.id);
}

async function updateIndex(id: string) {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  const ids: string[] = raw ? JSON.parse(raw) : [];
  if (!ids.includes(id)) {
    ids.push(id);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  }
}

export async function deleteFile(id: string): Promise<void> {
  const path = DOCS_DIR + id + '.md';
  const metaPath = DOCS_DIR + id + '.meta.json';
  await FileSystem.deleteAsync(path, { idempotent: true });
  await FileSystem.deleteAsync(metaPath, { idempotent: true });
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  const ids: string[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids.filter((x) => x !== id)));
}

export function newFileId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
