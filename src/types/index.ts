export interface MdFile {
  id: string;
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
  // Ruta relativa de subcarpetas dentro del vault ('' = raíz, 'Proyectos/Ideas').
  folder?: string;
}

// live = WYSIWYG (Crepe) · code = Markdown crudo · view = preview de solo lectura.
export type EditorMode = 'live' | 'code' | 'view';
