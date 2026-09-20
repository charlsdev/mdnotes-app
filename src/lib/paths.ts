// Rutas dentro del vault. Todo lo de acá es PURO a propósito: es la lógica que
// decide dónde queda una imagen y cómo se la enlaza desde la nota, y equivocarse
// produce enlaces rotos que solo se notan mirando el preview en el teléfono.
// Al no tocar expo/SAF, se puede ejercitar con `node scripts/check-render.mjs`.

// Resuelve una ruta relativa (con ./ , ../ o \) contra la carpeta de la nota.
export function resolveRel(folder: string, ref: string): string {
  const parts = [...folder.split('/'), ...ref.replace(/\\/g, '/').split('/')];
  const stack: string[] = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  return stack.join('/');
}

// Ruta de un archivo del vault vista DESDE la carpeta de la nota
// ('adjuntos/x.jpg' desde 'README' → '../adjuntos/x.jpg'). Así la resuelven tanto
// nuestro preview como Obsidian.
export function relativeTo(noteFolder: string, targetPath: string): string {
  const from = noteFolder.split('/').filter(Boolean);
  const to = targetPath.split('/').filter(Boolean);
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i++;
  return [...Array(from.length - i).fill('..'), ...to.slice(i)].join('/');
}

// Solo lo que rompería la sintaxis `![](…)`; los acentos se dejan legibles.
export function encodeRef(path: string): string {
  return path.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

// `attachmentFolderPath` de Obsidian (`.obsidian/app.json`) → ruta relativa a la
// RAÍZ del vault. Semántica de Obsidian:
//   '/' → raíz · 'x' → x desde la raíz · './' → junto a la nota · './x' → x junto a la nota
// Devuelve null si no hay config: ahí decide quien llama (ver `inferAttachmentFolder`).
export const DEFAULT_ATTACHMENT_FOLDER = 'adjuntos';

export function attachmentFolderFromConfig(configured: string | null, noteFolder: string): string | null {
  const value = configured?.trim();
  if (!value) return null;
  if (value === '/') return '';
  if (value === './') return noteFolder;
  if (value.startsWith('./')) {
    const sub = value.slice(2).replace(/^\/+|\/+$/g, '');
    if (!sub) return noteFolder;
    return noteFolder ? `${noteFolder}/${sub}` : sub;
  }
  return value.replace(/^\/+|\/+$/g, '');
}

// Limpia lo que el usuario escribe como carpeta: barras invertidas, espacios
// sobrantes, barras de más. `..` se descarta — un adjunto nunca sale del vault.
export function sanitizeFolderPath(input: string): string {
  return input
    .replace(/\\/g, '/')
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s && s !== '.' && s !== '..')
    .join('/');
}

// El ajuste de la app ('— CARPETA DE IMÁGENES'). Gana sobre la config de Obsidian
// y sobre la deducción: es el usuario diciéndolo explícitamente.
// Devuelve null en modo automático (ahí deciden config/deducción).
export type AttachmentMode = 'auto' | 'note' | 'vault';

export function attachmentFolderFromSetting(
  mode: AttachmentMode,
  folder: string,
  noteFolder: string
): string | null {
  if (mode === 'auto') return null;
  const clean = sanitizeFolderPath(folder);
  if (mode === 'note') {
    if (!clean) return noteFolder; // junto a la nota, sin subcarpeta
    return noteFolder ? `${noteFolder}/${clean}` : clean;
  }
  return clean; // 'vault': cadena vacía = raíz de la carpeta abierta
}

// Dónde guarda SUS imágenes este vault, deducido de las que ya existen. Sin esto
// una carpeta con la convención `img/` terminaría con una segunda carpeta de
// adjuntos al lado, que es exactamente lo que nadie quiere.
// Devuelve null si no hay de dónde deducir (vault sin imágenes).
export function inferAttachmentFolder(imagePaths: string[], noteFolder: string): string | null {
  // Nombre de carpeta → cuántas imágenes tiene y en qué rutas aparece.
  const byName = new Map<string, { count: number; folders: Set<string> }>();
  for (const p of imagePaths) {
    const parts = p.split('/').filter(Boolean);
    if (parts.length < 2) continue; // imagen suelta en la raíz: no es una convención
    const folder = parts.slice(0, -1).join('/');
    const name = parts[parts.length - 2];
    const entry = byName.get(name) ?? { count: 0, folders: new Set<string>() };
    entry.count++;
    entry.folders.add(folder);
    byName.set(name, entry);
  }
  if (byName.size === 0) return null;

  const [name, info] = [...byName.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].folders.size - a[1].folders.size
  )[0];

  // Una sola carpeta y está en la raíz → convención central ('img/' del vault).
  if (info.folders.size === 1 && info.folders.has(name)) return name;
  // Si no, la convención es "una carpeta <name> junto a la nota".
  return noteFolder ? `${noteFolder}/${name}` : name;
}

// Carpetas para ofrecer en Ajustes, sacadas de lo que el vault YA tiene: primero
// las que contienen imágenes (son las carpetas de adjuntos de verdad), después las
// que contienen notas. Tocar una evita el riesgo real de tipear a mano: un typo no
// falla, CREA una carpeta nueva y te deja dos carpetas de imágenes sin darte cuenta.
// En modo 'note' se ofrecen nombres sueltos ('img'); en 'vault', rutas completas.
export function folderSuggestions(
  mode: AttachmentMode,
  imagePaths: string[],
  noteFolders: string[],
  limit = 8
): string[] {
  const score = new Map<string, number>();
  const add = (value: string, weight: number) => {
    if (!value) return;
    score.set(value, (score.get(value) ?? 0) + weight);
  };

  for (const p of imagePaths) {
    const parts = p.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    const folder = parts.slice(0, -1).join('/');
    add(mode === 'note' ? parts[parts.length - 2] : folder, 10);
  }
  for (const folder of noteFolders) {
    const parts = folder.split('/').filter(Boolean);
    if (!parts.length) continue;
    add(mode === 'note' ? parts[parts.length - 1] : parts.join('/'), 1);
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

// Busca una imagen del vault a partir de la referencia escrita en la nota.
// Tolera `./`, `../`, las barras invertidas de Windows (`.\img\x.png`) y el
// %20 de los espacios; y como último recurso busca por nombre de archivo, que es
// como Obsidian resuelve los embeds `![[x.png]]`.
export function createImageResolver(images: Record<string, string>) {
  const byBasename: Record<string, string> = {};
  for (const [rel, uri] of Object.entries(images)) {
    const base = (rel.split('/').pop() ?? rel).toLowerCase();
    if (!(base in byBasename)) byBasename[base] = uri;
  }

  return (ref: string, noteFolder: string): string | null => {
    if (/^(https?:|data:|file:|content:)/i.test(ref)) return null;
    const norm = ref.replace(/\\/g, '/').replace(/^\.\//, '');
    const base = (norm.split('/').pop() ?? norm).toLowerCase();
    let decoded = norm;
    try {
      decoded = decodeURIComponent(norm);
    } catch {
      // ref con % suelto: nos quedamos con el original
    }
    return (
      images[resolveRel(noteFolder, ref)] ??
      images[norm] ??
      images[decoded] ??
      byBasename[base] ??
      byBasename[decoded.split('/').pop()?.toLowerCase() ?? base] ??
      null
    );
  };
}
