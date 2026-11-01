import type { useRouter } from 'expo-router';
import { MdFile, isNote } from '@/types';
import { openWithSystemViewer } from '@/storage/vault';
import { appAlert } from '@/components/AppAlert';

type Router = ReturnType<typeof useRouter>;

// Abre lo que NO es una nota: PDF, imagen y texto en sus visores de la app; el resto,
// con el visor del teléfono. Devuelve false si es una nota (qué hacer con ella lo
// decide la pantalla: la biblioteca abre el editor, el editor salta de nota).
export function openAttachment(router: Router, file: MdFile): boolean {
  if (isNote(file)) return false;
  if (file.kind === 'pdf') {
    router.push({ pathname: '/pdf/[id]', params: { id: file.id } });
  } else if (file.kind === 'image') {
    router.push({ pathname: '/image/[id]', params: { id: file.id } });
  } else if (file.kind === 'text') {
    router.push({ pathname: '/file/[id]', params: { id: file.id } });
  } else if (file.uri) {
    openWithSystemViewer(file.uri, file.name).catch((e: any) =>
      appAlert(
        `No pude abrir "${file.name}"`,
        `${e?.message ?? e}\n\nPuede que no tengas una app instalada que abra ese tipo de archivo.`,
        undefined,
        { variant: 'error' }
      )
    );
  }
  return true;
}

// `load()` solo lanza si no pudo leer ni la lista de carpetas ni las notas internas.
export function alertLoadFailed(e: unknown) {
  appAlert(
    'No pude cargar tus notas',
    `${(e as any)?.message ?? e}\n\nDesliza la lista hacia abajo para reintentar.`,
    undefined,
    { variant: 'error' }
  );
}
