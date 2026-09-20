// Qué es la fila: una nota editable, o un archivo que la app lista pero no edita y
// abre con el visor del teléfono. Ausente = 'note' (todo lo anterior a listar
// adjuntos). El árbol los distingue con la EXTENSIÓN como etiqueta (PDF, PNG, JPG):
// más honesto que un ícono genérico, y se generaliza a cualquier tipo nuevo.
export type FileKind = 'note' | 'pdf' | 'image' | 'text';

export function isNote(f: MdFile): boolean {
  return (f.kind ?? 'note') === 'note';
}

// Etiqueta de la fila: 'PDF', 'PNG'… ('' para las notas).
export function fileBadge(f: MdFile): string {
  if (isNote(f)) return '';
  const ext = f.name.split('.').pop() ?? '';
  return ext.length <= 4 ? ext.toUpperCase() : 'ARCHIVO';
}

export interface MdFile {
  id: string;
  kind?: FileKind;
  name: string;
  // OJO: en el store esta copia es LIGERA (los base64 de las imágenes van elididos,
  // ver `elideDataUris`). Sirve para listar, buscar y derivar tags/preview, NUNCA
  // para guardar. El editor relee el contenido completo del disco al abrir la nota
  // (`readContent` del store) — escribir esta copia corrompería el .md.
  content: string;
  // 0 cuando no se pudo leer la fecha real del archivo (no se muestra nada).
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  // URI del archivo real cuando la nota vive en una carpeta abierta (vault, SAF).
  // Si está presente, editar/borrar opera sobre ese .md; si no, es nota interna.
  uri?: string;
  // URI SAF de la carpeta que contiene el archivo. Necesaria para recrearlo cuando
  // hay que truncarlo (ver `writeVaultFile`).
  dirUri?: string;
  // Cuál de las carpetas abiertas la contiene (`vaultIdForUri` de la raíz). Define
  // dónde van sus adjuntos, contra qué índice se resuelven sus imágenes y hasta
  // dónde llegan sus [[enlaces]] — que NO cruzan de una carpeta a otra.
  vaultId?: string;
  // Ruta relativa de subcarpetas dentro del vault ('' = raíz, 'Proyectos/Ideas').
  folder?: string;
}

// live = WYSIWYG (Crepe) · code = Markdown crudo · view = preview de solo lectura.
export type EditorMode = 'live' | 'code' | 'view';
