export interface MdFile {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  // URI del archivo real cuando la nota vive en una carpeta abierta (vault, SAF).
  // Si está presente, editar/borrar opera sobre ese .md; si no, es nota interna.
  uri?: string;
  // Ruta relativa de subcarpetas dentro del vault ('' = raíz, 'Proyectos/Ideas').
  folder?: string;
}

export type EditorMode = 'edit' | 'view';
