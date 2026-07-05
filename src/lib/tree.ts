import { MdFile } from '@/types';

export type TreeRow =
  | { kind: 'folder'; key: string; depth: number; name: string; path: string; count: number }
  | { kind: 'file'; key: string; depth: number; name: string; note: MdFile };

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

// Aplana las notas (con su `folder`) en filas de árbol: carpetas colapsables
// primero (ordenadas), luego archivos. `collapsed` oculta el contenido.
export function buildTreeRows(notes: MdFile[], collapsed: Set<string>): TreeRow[] {
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
  const walk = (node: Node, depth: number, prefix: string) => {
    const folderNames = [...node.folders.keys()].sort((a, b) => a.localeCompare(b));
    for (const fn of folderNames) {
      const child = node.folders.get(fn)!;
      const path = prefix ? `${prefix}/${fn}` : fn;
      rows.push({ kind: 'folder', key: `d:${path}`, depth, name: fn, path, count: countFiles(child) });
      if (!collapsed.has(path)) walk(child, depth + 1, path);
    }
    const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
    for (const f of files) {
      rows.push({ kind: 'file', key: `f:${f.id}`, depth, name: f.name, note: f });
    }
  };
  walk(root, 0, '');
  return rows;
}
