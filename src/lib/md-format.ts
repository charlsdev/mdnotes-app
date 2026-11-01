// Ediciones de la toolbar del modo MD. Puras: reciben el texto y la selección y
// devuelven el texto nuevo + dónde dejar el cursor.
export interface Sel {
  start: number;
  end: number;
}

export interface Edit {
  text: string;
  caret: number;
}

// Inserta texto crudo en el cursor (o reemplaza la selección).
export function insertAt(content: string, { start, end }: Sel, text: string, cursorOffset = 0): Edit {
  return { text: content.slice(0, start) + text + content.slice(end), caret: start + text.length + cursorOffset };
}

// Envuelve la selección (negrita, cursiva, código). Sin selección, deja el par
// vacío con el cursor en medio.
export function wrapSelection(content: string, { start, end }: Sel, wrap: string): Edit {
  const middle = content.slice(start, end);
  return {
    text: content.slice(0, start) + wrap + middle + wrap + content.slice(end),
    caret: middle ? end + wrap.length * 2 : start + wrap.length,
  };
}

// Antepone un prefijo al inicio de la línea actual (encabezados, listas, cita).
export function prefixLine(content: string, { start }: Sel, prefix: string): Edit {
  const lineStart = content.lastIndexOf('\n', start - 1) + 1;
  return { text: content.slice(0, lineStart) + prefix + content.slice(lineStart), caret: start + prefix.length };
}

// Quita el formato Markdown de la selección (marcadores inline + prefijos de
// línea). Sin selección no hay nada que limpiar: null.
export function clearFormatting(content: string, { start, end }: Sel): Edit | null {
  if (start === end) return null;
  const cleaned = content
    .slice(start, end)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '');
  return { text: content.slice(0, start) + cleaned + content.slice(end), caret: start + cleaned.length };
}
