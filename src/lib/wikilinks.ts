// Enlaces internos estilo Obsidian: `[[nota]]`, `[[nota|alias]]`, `[[nota#sección]]`
// y el embed `![[archivo]]`. El destino NO es una URL: es una ruta relativa dentro
// del vault, sin extensión, que hay que resolver contra las notas conocidas.
import { MdFile } from '@/types';
import { resolveRel } from '@/lib/paths';

// `!` opcional (embed) + destino + `#sección`/`^bloque` opcional + `|alias` opcional.
// El destino no admite `[`, `]` ni `|` para no tragarse enlaces mal cerrados.
export const WIKILINK_RE = /(!)?\[\[([^[\]|#^\n]+)((?:[#^][^[\]|\n]*)?)(?:\|([^[\]\n]*))?\]\]/g;

export interface LinkIndex {
  // Ruta relativa completa sin extensión ('proyectos/ideas') → id de nota.
  byPath: Record<string, string>;
  // Solo el nombre ('ideas') → id. Para el estilo Obsidian de enlazar por nombre.
  byName: Record<string, string>;
}

function norm(s: string): string {
  return s
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.(md|markdown|mdx|txt)$/i, '')
    .toLowerCase();
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

// Índice de resolución. Ante nombres repetidos gana la nota menos anidada (y, a
// igual profundidad, la primera alfabéticamente) para que el resultado sea estable
// entre escaneos y no dependa del orden del listado.
export function buildLinkIndex(files: MdFile[]): LinkIndex {
  const byPath: Record<string, string> = {};
  const byName: Record<string, string> = {};
  const ordered = [...files].sort((a, b) => {
    const da = (a.folder ?? '').split('/').filter(Boolean).length;
    const db = (b.folder ?? '').split('/').filter(Boolean).length;
    return da !== db ? da - db : a.name.localeCompare(b.name);
  });
  for (const f of ordered) {
    const path = norm(f.folder ? `${f.folder}/${f.name}` : f.name);
    if (!(path in byPath)) byPath[path] = f.id;
    const name = norm(f.name);
    if (!(name in byName)) byName[name] = f.id;
  }
  return { byPath, byName };
}

// Destino → id de archivo, o null si no existe (enlace roto). Se prueba primero como
// ruta desde la raíz del vault (como Obsidian), después relativa a la carpeta de la
// nota que enlaza, y por último como nombre suelto.
//
// Resuelve tanto destinos de `[[wikilink]]` como los de un enlace Markdown normal
// (`[texto](../otra/NOTA.md)`), por eso pasa por `resolveRel`: esos traen `./` y `../`.
export function resolveWikilink(target: string, folder: string, index: LinkIndex): string | null {
  const t = norm(target);
  if (!t) return null;
  const fromFolder = folder ? norm(`${folder}/${t}`) : t;
  const viaRel = norm(resolveRel(folder, target));
  return (
    index.byPath[t] ??
    index.byPath[fromFolder] ??
    index.byPath[viaRel] ??
    index.byName[basename(t)] ??
    null
  );
}

// Cómo escribir el enlace a esta nota: con el nombre suelto si no es ambiguo, y con
// la ruta completa si lo es (mismo criterio que Obsidian).
export function shortestLinkLabel(note: MdFile, index: LinkIndex): string {
  if (index.byName[norm(note.name)] === note.id) return note.name;
  return note.folder ? `${note.folder}/${note.name}` : note.name;
}

// Notas que enlazan a `id`. Los embeds (`![[...]]`) no cuentan como mención.
// Opera sobre la copia ligera del store: los wikilinks son texto, así que basta.
export function backlinksFor(id: string, files: MdFile[], index: LinkIndex): MdFile[] {
  const out: MdFile[] = [];
  for (const f of files) {
    if (f.id === id || !f.content.includes('[[')) continue;
    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(f.content))) {
      if (m[1]) continue;
      if (resolveWikilink(m[2], f.folder ?? '', index) === id) {
        out.push(f);
        break;
      }
    }
  }
  return out;
}
