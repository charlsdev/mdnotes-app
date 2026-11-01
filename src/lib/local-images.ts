import { createImageResolver } from '@/lib/paths';

const IMG_MD_RE = /!\[[^\]]*\]\(\s*([^)\s]+)/g;
const IMG_HTML_RE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;
// Embed estilo Obsidian: ![[carpeta/foto.png]] (el `|tamaño` opcional se ignora).
const IMG_WIKI_RE = /!\[\[\s*([^[\]|#\n]+?)\s*(?:\|[^[\]\n]*)?\]\]/g;
const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;

// Reemplaza imágenes locales (Markdown, <img> y ![[x]]) por data URIs: el WebView
// no lee `content://` sueltos. `restore` mapea dataUri → ref original, para
// deshacerlo al guardar desde VIVO. `read` va por parámetro (en la app,
// `readImageDataUri` de vault.ts) para que esto se pueda probar sin SAF.
export async function inlineLocalImages(
  content: string,
  folder: string,
  images: Record<string, string>,
  read: (uri: string) => Promise<string>
): Promise<{ md: string; restore: [string, string][] }> {
  const refs = new Set<string>();
  let m: RegExpExecArray | null;
  IMG_MD_RE.lastIndex = 0;
  while ((m = IMG_MD_RE.exec(content))) refs.add(m[1]);
  IMG_HTML_RE.lastIndex = 0;
  while ((m = IMG_HTML_RE.exec(content))) refs.add(m[1]);
  IMG_WIKI_RE.lastIndex = 0;
  // Solo los embeds que apuntan a una imagen; `![[otra nota]]` no es una imagen.
  while ((m = IMG_WIKI_RE.exec(content))) {
    if (IMG_EXT_RE.test(m[1])) refs.add(m[1]);
  }

  const findImage = createImageResolver(images);
  const replacements: Record<string, string> = {};
  for (const ref of refs) {
    const uri = findImage(ref, folder);
    if (!uri) continue;
    try {
      replacements[ref] = await read(uri);
    } catch {
      // imagen ilegible: la dejamos como está
    }
  }

  let md = content;
  const restore: [string, string][] = [];
  for (const [ref, data] of Object.entries(replacements)) {
    md = md.split(ref).join(data);
    restore.push([data, ref]);
  }
  return { md, restore };
}

// Nombre del adjunto: ordenable y sin espacios (los espacios en una ruta de
// Markdown obligan a escaparlos y rompen en algunos renderizadores).
export function imageBaseName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `imagen-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
