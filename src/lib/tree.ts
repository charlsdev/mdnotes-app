import { MdFile } from '@/types';

export type TreeRow =
  // Raíz de una carpeta abierta. Solo aparece cuando hay más de una: con una sola
  // el árbol se ve como siempre.
  | { kind: 'vault'; key: string; depth: number; name: string; path: string; count: number }
  | { kind: 'folder'; key: string; depth: number; name: string; path: string; count: number }
  | { kind: 'file'; key: string; depth: number; name: string; note: MdFile };

export interface TreeGroup {
  id: string;
  name: string;
  // Todas las carpetas de este grupo, incluidas las que no tienen notas.
  folders?: string[];
}

interface Node {
  folders: Map<string, Node>;
  files: MdFile[];
}

function emptyNode(): Node {
  return { folders: new Map(), files: [] };
}

function countFiles(node: Node): number {
  let n = node.files.length;
  for (const child of node.folders.values()) n += countFiles(child);
  return n;
}

// Qué carpetas están ABIERTAS. `'all'` = todas (se usa al filtrar: si no, los
// resultados quedarían escondidos dentro de carpetas cerradas).
export type Expanded = Set<string> | 'all';

const isOpen = (expanded: Expanded, key: string) => expanded === 'all' || expanded.has(key);

// Filas de un conjunto de notas. `prefix` separa el estado de apertura entre
// carpetas abiertas: dos vaults pueden tener un `README` cada uno y abrir uno
// no debe abrir el otro.
function rowsFor(
  notes: MdFile[],
  expanded: Expanded,
  baseDepth: number,
  prefix: string,
  folders: string[] = []
): TreeRow[] {
  const root = emptyNode();

  // Crea (si hace falta) el nodo de una ruta y lo devuelve.
  const nodeAt = (path: string): Node => {
    let cur = root;
    for (const p of path.split('/').filter(Boolean)) {
      let next = cur.folders.get(p);
      if (!next) {
        next = emptyNode();
        cur.folders.set(p, next);
      }
      cur = next;
    }
    return cur;
  };

  // Primero las carpetas conocidas: así aparecen aunque no tengan ninguna nota.
  for (const folder of folders) nodeAt(folder);
  for (const note of notes) nodeAt(note.folder ?? '').files.push(note);

  const rows: TreeRow[] = [];
  const walk = (node: Node, depth: number, path: string) => {
    const folderNames = [...node.folders.keys()].sort((a, b) => a.localeCompare(b));
    for (const fn of folderNames) {
      const child = node.folders.get(fn)!;
      const childPath = path ? `${path}/${fn}` : fn;
      const key = prefix ? `${prefix}/${childPath}` : childPath;
      rows.push({ kind: 'folder', key: `d:${key}`, depth, name: fn, path: key, count: countFiles(child) });
      if (isOpen(expanded, key)) walk(child, depth + 1, childPath);
    }
    const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
    for (const f of files) {
      rows.push({ kind: 'file', key: `f:${f.id}`, depth, name: f.name, note: f });
    }
  };
  walk(root, baseDepth, '');
  return rows;
}

// Aplana las notas en filas de árbol: carpetas colapsables primero (ordenadas),
// luego archivos. Con varios `groups` (carpetas abiertas) antepone una raíz por
// grupo; con uno solo, el árbol es idéntico al de siempre.
export function buildTreeRows(
  notes: MdFile[],
  expanded: Expanded,
  groups: TreeGroup[] = [],
  folders: string[] = []
): TreeRow[] {
  if (groups.length < 2) return rowsFor(notes, expanded, 0, '', folders);

  const rows: TreeRow[] = [];
  for (const group of groups) {
    const mine = notes.filter((n) => (n.vaultId ?? '') === group.id);
    const groupFolders = group.folders ?? [];
    if (!mine.length && !groupFolders.length) continue;
    const path = `vault:${group.id}`;
    rows.push({ kind: 'vault', key: `v:${group.id}`, depth: 0, name: group.name, path, count: mine.length });
    if (isOpen(expanded, path)) rows.push(...rowsFor(mine, expanded, 1, group.id, groupFolders));
  }
  return rows;
}

// Carpetas que hay que abrir para que una nota quede a la vista: su carpeta abierta
// (si el árbol está agrupado) y cada nivel del camino. Es lo que hace que al entrar
// al cajón veas dónde estás parado, con todo lo demás recogido.
export function pathToNote(note: MdFile | undefined, grouped: boolean): string[] {
  if (!note) return [];
  const vaultId = note.vaultId ?? '';
  const keys = grouped ? [`vault:${vaultId}`] : [];
  const prefix = grouped ? vaultId : '';
  let acc = '';
  for (const part of (note.folder ?? '').split('/').filter(Boolean)) {
    acc = acc ? `${acc}/${part}` : part;
    keys.push(prefix ? `${prefix}/${acc}` : acc);
  }
  return keys;
}
