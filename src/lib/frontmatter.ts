// Frontmatter YAML mínimo (solo lo que MDNotes necesita: tags). Guardar tags en
// `---\ntags: [a, b]\n---` es el estándar portable (Obsidian, etc.).

// Bloque de frontmatter al inicio del archivo: entre --- y --- .
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(content: string): { fm: string; yaml: string; body: string } {
  const m = content.match(FM_RE);
  if (!m) return { fm: '', yaml: '', body: content };
  return { fm: m[0], yaml: m[1], body: content.slice(m[0].length) };
}

// Contenido sin el bloque de frontmatter (para render VER/VIVO/PDF).
export function stripFrontmatter(content: string): string {
  return splitFrontmatter(content).body;
}

function normTag(t: string): string {
  return t.trim().replace(/^['"]|['"]$/g, '').replace(/^#/, '');
}

// Lee los tags del frontmatter. Soporta inline `tags: [a, b]` / `tags: a, b` y
// lista en bloque `tags:\n  - a\n  - b`.
export function getFrontmatterTags(content: string): string[] {
  const { yaml } = splitFrontmatter(content);
  if (!yaml) return [];
  const inline = yaml.match(/^tags:[ \t]*\[([^\]]*)\]/im);
  if (inline) return dedupe(inline[1].split(',').map(normTag).filter(Boolean));
  const block = yaml.match(/^tags:[ \t]*\r?\n((?:[ \t]*-[ \t]*.+\r?\n?)+)/im);
  if (block) return dedupe(block[1].split(/\r?\n/).map((l) => normTag(l.replace(/^[ \t]*-[ \t]*/, ''))).filter(Boolean));
  const csv = yaml.match(/^tags:[ \t]*([^\n[][^\n]*)$/im);
  if (csv) return dedupe(csv[1].split(',').map(normTag).filter(Boolean));
  return [];
}

// Escribe los tags en el frontmatter (crea/actualiza el bloque; preserva otras
// claves; elimina el bloque si queda vacío). Siempre usa el formato inline.
export function setFrontmatterTags(content: string, tags: string[]): string {
  const clean = dedupe(tags.map(normTag).filter(Boolean));
  const { fm, yaml, body } = splitFrontmatter(content);
  const tagsLine = clean.length ? `tags: [${clean.join(', ')}]` : '';

  if (!fm) {
    return clean.length ? `---\n${tagsLine}\n---\n${content}` : content;
  }

  // Quita cualquier declaración de tags previa (inline o en bloque) del yaml.
  let rest = yaml
    .replace(/^tags:[ \t]*\[[^\]]*\][ \t]*\r?\n?/im, '')
    .replace(/^tags:[ \t]*\r?\n(?:[ \t]*-[ \t]*.+\r?\n?)+/im, '')
    .replace(/^tags:[ \t]*[^\n]*\r?\n?/im, '')
    .replace(/\s+$/, '');

  const lines = [tagsLine, rest].filter(Boolean).join('\n');
  if (!lines) return body; // frontmatter quedó vacío → lo quitamos
  return `---\n${lines}\n---\n${body}`;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}
