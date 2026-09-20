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
// Sin config usamos una carpeta propia: es más ordenado que dejar las fotos en la raíz.
export const DEFAULT_ATTACHMENT_FOLDER = 'adjuntos';

export function attachmentFolderFromConfig(configured: string | null, noteFolder: string): string {
  const value = configured?.trim();
  if (value === '/') return '';
  if (!value) return DEFAULT_ATTACHMENT_FOLDER;
  if (value === './') return noteFolder;
  if (value.startsWith('./')) {
    const sub = value.slice(2).replace(/^\/+|\/+$/g, '');
    if (!sub) return noteFolder;
    return noteFolder ? `${noteFolder}/${sub}` : sub;
  }
  return value.replace(/^\/+|\/+$/g, '');
}
