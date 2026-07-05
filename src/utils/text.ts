import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { stripFrontmatter, getFrontmatterTags } from '@/lib/frontmatter';

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'ahora';
  return formatDistanceToNowStrict(new Date(timestamp), {
    addSuffix: false,
    locale: es,
  });
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
