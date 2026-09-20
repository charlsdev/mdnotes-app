import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { stripFrontmatter, getFrontmatterTags } from '@/lib/frontmatter';

// Devuelve '' si no hay fecha real (ej. el proveedor SAF no la expone): preferimos
// no mostrar nada antes que inventar un "ahora" que no es cierto.
export function relativeTime(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'ahora';
  return formatDistanceToNowStrict(new Date(timestamp), {
    addSuffix: false,
    locale: es,
  });
}

// Largo en BYTES del texto codificado como UTF-8 (lo que ocupa en disco). Se compara
// contra el tamaño real del archivo para detectar la cola sin truncar de SAF.
export function utf8Length(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4; // par suplente (emoji): 4 bytes y consume 2 unidades
      i++;
    } else bytes += 3;
  }
  return bytes;
}

// Recorta el payload base64 de las imágenes embebidas dejando el resto del texto
// intacto. La copia en memoria (biblioteca, búsqueda, árbol) usa esto: una nota con
// fotos pesa KB de texto en vez de MB de base64. El archivo en disco NO se toca —
// el editor relee el contenido completo al abrir la nota.
// Sin `\s` en la clase a propósito: el base64 que generamos va en una sola línea y,
// si se aceptaran saltos, el match podría comerse el texto que viene después.
const DATA_URI_RE = /(data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,)[A-Za-z0-9+/=]{64,}/gi;

export function elideDataUris(content: string): string {
  return content.replace(DATA_URI_RE, '$1…');
}

export function preview(text: string, max = 120): string {
  const stripped = stripFrontmatter(text)
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*|\*|`|>/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return stripped.length > max ? stripped.slice(0, max) + '…' : stripped;
}

export function deriveName(content: string): string {
  const body = stripFrontmatter(content);
  const firstLine = body.split('\n').find((l) => l.trim().length > 0) ?? '';
  return firstLine.replace(/^#+\s*/, '').slice(0, 60) || 'Sin título';
}

// Extrae tags tipo #tag del cuerpo (para mostrarlos en la lista).
export function extractTags(content: string): string[] {
  const matches = stripFrontmatter(content).match(/(?:^|\s)#([a-zA-Z0-9_\-áéíóúñ]+)/gi) ?? [];
  const tags = matches.map((m) => m.trim().replace(/^#/, '')).filter((t) => t.length > 0 && t.length <= 24);
  return Array.from(new Set(tags));
}

// Tags de la nota: frontmatter (editables) + hashtags del cuerpo. Para mostrar/buscar.
export function computeTags(content: string): string[] {
  return Array.from(new Set([...getFrontmatterTags(content), ...extractTags(content)])).slice(0, 6);
}
