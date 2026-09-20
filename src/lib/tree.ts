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

// Filas de un conjunto de notas. `prefix` separa los estados de colapso entre
// carpetas abiertas: dos vaults pueden tener un `README` cada uno y colapsar uno
// no debe colapsar el otro.
function rowsFor(notes: MdFile[], collapsed: Set<string>, baseDepth: number, prefix: string): TreeRow[] {
  const root = emptyNode();
  for (const note of notes) {
    const parts = (note.folder ?? '').split('/').filter(Boolean);
    let cur = root;
    for (const p of parts) {
      let next = cur.folders.get(p);
      if (!next) {
        next = emptyNode();
        cur.folders.set(p, next);
      }
      cur = next;
    }
    cur.files.push(note);
  }

  const rows: TreeRow[] = [];
  const walk = (node: Node, depth: number, path: string) => {
    const folderNames = [...node.folders.keys()].sort((a, b) => a.localeCompare(b));
    for (const fn of folderNames) {
      const child = node.folders.get(fn)!;
      const childPath = path ? `${path}/${fn}` : fn;
      const key = prefix ? `${prefix}/${childPath}` : childPath;
      rows.push({ kind: 'folder', key: `d:${key}`, depth, name: fn, path: key, count: countFiles(child) });
      if (!collapsed.has(key)) walk(child, depth + 1, childPath);
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
  collapsed: Set<string>,
  groups: TreeGroup[] = []
): TreeRow[] {
  if (groups.length < 2) return rowsFor(notes, collapsed, 0, '');

  const rows: TreeRow[] = [];
  for (const group of groups) {
    const mine = notes.filter((n) => (n.vaultId ?? '') === group.id);
    if (!mine.length) continue;
    const path = `vault:${group.id}`;
    rows.push({ kind: 'vault', key: `v:${group.id}`, depth: 0, name: group.name, path, count: mine.length });
    if (!collapsed.has(path)) rows.push(...rowsFor(mine, collapsed, 1, group.id));
  }
  return rows;
}
