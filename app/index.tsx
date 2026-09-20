import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import Svg, { Path } from 'react-native-svg';
import { useTheme, fonts, spacing, radius } from '@/theme';
import { useFilesStore } from '@/storage/store';
import { relativeTime, preview, deriveName } from '@/utils/text';
import { MdFile, isNote } from '@/types';
import { openWithSystemViewer } from '@/storage/vault';
import { Wordmark } from '@/components/Wordmark';
import { Footer } from '@/components/Footer';
import { NoteTree } from '@/components/NoteTree';
import { appAlert } from '@/components/AppAlert';

const MD_RE = /\.(md|markdown|txt|mdx)$/i;

// Nombre de nota a partir de la URI de un archivo externo. Devuelve '' cuando el
// proveedor usa ids opacos (ej. Descargas: `msf:1000000123`): ahí el nombre se
// deriva del contenido en vez de inventar uno con el id.
function nameFromUri(url: string): string {
  const decoded = decodeURIComponent(url);
  const last = (decoded.split(':').pop() ?? decoded).split(/[/\\]/).pop() ?? '';
  return MD_RE.test(last) ? last.replace(MD_RE, '') : '';
}

function FolderIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" />
    </Svg>
  );
}

function GearIcon({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Svg>
  );
}

export default function LibraryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    files,
    loaded,
    loading,
    load,
    create,
    createWith,
    remove,
    vaults,
    vaultFolders,
    lastVaultId,
    openVault,
    closeVault,
  } = useFilesStore();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded]);

  // Los PDF e imágenes se listan pero no son notas: se cuentan aparte para no
  // inflar el número.
  const noteCount = useMemo(() => files.filter(isNote).length, [files]);
  const otherCount = files.length - noteCount;

  const isFiltering = query.trim().length > 0 || tagFilter !== null;

  // Todos los tags únicos (para la barra de filtro).
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) f.tags?.forEach((t) => set.add(t));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [files]);

  // Con más de una carpeta abierta el árbol agrupa por carpeta; las notas internas
  // van a un grupo propio al final. Con una sola, sin grupos (el árbol de siempre).
  const treeGroups = useMemo(() => {
    if (vaults.length < 2) return undefined;
    const groups: { id: string; name: string; folders?: string[] }[] = vaults.map((v) => ({
      id: v.id,
      name: v.name,
      folders: isFiltering ? undefined : vaultFolders[v.id],
    }));
    if (files.some((f) => !f.vaultId)) groups.push({ id: '', name: 'En el dispositivo' });
    return groups;
  }, [vaults, files, vaultFolders, isFiltering]);

  // Carpetas vacías: se muestran solo sin filtro activo. Filtrando, el árbol debe
  // enseñar lo que coincide, no la estructura entera.
  const treeFolders = useMemo(() => {
    if (isFiltering || vaults.length !== 1) return undefined;
    return vaultFolders[vaults[0].id];
  }, [isFiltering, vaults, vaultFolders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((f) => {
      if (tagFilter && !f.tags?.includes(tagFilter)) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [files, query, tagFilter]);

  // Con varias carpetas abiertas preguntamos SIEMPRE dónde va la nota: escribir en
  // la carpeta equivocada se descubre tarde. La última usada va primero.
  // Resuelve al id elegido, o `null` si se canceló. Sin carpetas, undefined (interna).
  const chooseVault = (title: string): Promise<string | null | undefined> =>
    new Promise((resolve) => {
      if (vaults.length <= 1) {
        resolve(vaults[0]?.id);
        return;
      }
      const ordered = [...vaults].sort((a, b) => (a.id === lastVaultId ? -1 : b.id === lastVaultId ? 1 : 0));
      appAlert(
        title,
        '¿En cuál de tus carpetas?',
        [
          ...ordered.map((v) => ({ text: v.name, onPress: () => resolve(v.id) })),
          { text: 'Cancelar', style: 'cancel' as const, onPress: () => resolve(null) },
        ],
        // Sin descartar tocando afuera: si no, la promesa quedaría colgada.
        { variant: 'info', dismissable: false }
      );
    });

  const handleCreate = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const target = await chooseVault('Nota nueva');
    if (target === null) return;
    const file = await create(undefined, target);
    // `new` → el editor arranca en EDIT (nota recién creada); abrir existente → VIEW.
    router.push({ pathname: '/editor/[id]', params: { id: file.id, new: '1' } });
  };

  // Navega al editor pasando el id como PARÁMETRO (se codifica bien; los id de
  // vault son URIs SAF con / y : que romperían la ruta si se interpolan).
  // Una nota abre el editor; lo demás (PDF, imágenes) no se edita: lo abre el visor
  // del teléfono.
  const openNote = useCallback(
    (note: MdFile) => {
      if (!isNote(note)) {
        if (!note.uri) return;
        openWithSystemViewer(note.uri, note.name).catch((e: any) =>
          appAlert(
            `No pude abrir "${note.name}"`,
            `${e?.message ?? e}\n\nPuede que no tengas una app instalada que abra ese tipo de archivo.`,
            undefined,
            { variant: 'error' }
          )
        );
        return;
      }
      router.push({ pathname: '/editor/[id]', params: { id: note.id } });
    },
    [router]
  );

  // Abrir un .md desde otra app ("Abrir con MDNotes", compartir). El intent trae
  // una URI con permiso de SOLO LECTURA y no persistible, así que no se puede
  // editar en sitio: importamos una COPIA (dentro de la carpeta si hay vault).
  const handledUrl = useRef<string | null>(null);
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url || handledUrl.current === url) return;
      if (!/^(content|file):/i.test(url)) return; // mdnotes://… u otros: no son archivos
      handledUrl.current = url;
      try {
        const content = await FileSystem.readAsStringAsync(url);
        // Acá NO preguntamos carpeta: el usuario viene de otra app esperando ver el
        // archivo, no un diálogo. Va a la última carpeta usada (o interna si no hay).
        const file = await createWith(nameFromUri(url) || deriveName(content), content);
        openNote(file);
      } catch (e: any) {
        appAlert(
          'No pude abrir ese archivo',
          `${e?.message ?? e}\n\nSolo puedo abrir archivos de texto (.md, .txt).`,
          undefined,
          { variant: 'error' }
        );
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [createWith, openNote]);

  // Botón de carpeta: sin carpetas abre una (Android) o importa archivos (iOS);
  // con carpetas abiertas, el menú para abrir otra, importar o cerrar alguna.
  const handleFolderPress = () => {
    if (vaults.length === 0) {
      if (Platform.OS === 'android') openFolder();
      else importFiles();
      return;
    }
    appAlert(
      vaults.length === 1 ? vaults[0].name : `${vaults.length} carpetas abiertas`,
      'Editas los .md reales de estas carpetas; los cambios se guardan ahí.',
      [
        { text: 'Abrir otra carpeta', onPress: openFolder },
        { text: 'Importar archivos', onPress: importFiles },
        { text: 'Cerrar una carpeta', onPress: askCloseVault },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { variant: 'info', tag: vaults.length === 1 ? 'Carpeta abierta' : 'Carpetas abiertas' }
    );
  };

  // Cerrar solo saca la carpeta de la app: los archivos quedan donde están.
  const askCloseVault = () => {
    if (vaults.length === 1) {
      closeVault(vaults[0].id);
      return;
    }
    appAlert(
      'Cerrar carpeta',
      'Se quita de la app; los archivos no se tocan.',
      [
        ...vaults.map((v) => ({ text: v.name, onPress: () => closeVault(v.id) })),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
      { variant: 'warn' }
    );
  };

  // Abre una carpeta y reporta cuántos .md trajo, o el error real.
  const openFolder = async () => {
    try {
      const opened = await openVault();
      if (opened === null) return; // cancelado
      const { name, count, already } = opened;
      if (already) {
        appAlert(`"${name}" ya estaba abierta`, `Sigue ahí con sus ${count} notas.`, undefined, { variant: 'info' });
      } else if (count === 0) {
        appAlert(
          `"${name}" está abierta, pero vacía`,
          'No encontré archivos .md ahí, ni en sus subcarpetas.',
          undefined,
          { variant: 'error' }
        );
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        appAlert(
          `Carpeta "${name}"`,
          `${count} nota${count === 1 ? '' : 's'} encontrada${count === 1 ? '' : 's'}.`,
          undefined,
          { variant: 'success' }
        );
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      // Google Drive u otros proveedores en la nube no soportan abrir carpeta (SAF).
      if (/Storage Access Framework URI|readSAFDirectory|docs\.storage|IOException/i.test(msg)) {
        appAlert(
          'Esa carpeta no se puede abrir',
          'Parece de Google Drive u otra nube, que no permite editar sus carpetas en sitio. Elige una carpeta del almacenamiento del teléfono (Documentos, Descargas, tarjeta SD). Para archivos de Drive, usa “Importar archivos”.',
          undefined,
          { variant: 'error', tag: 'Nube no soportada' }
        );
      } else {
        appAlert('No pude leer la carpeta', msg, undefined, { variant: 'error' });
      }
    }
  };

  // Selecciona archivos concretos. Al elegirlos explícitamente NO filtro por
  // extensión (tú los escogiste); solo salto lo que no se pueda leer como texto.
  const importFiles = async () => {
    let res: DocumentPicker.DocumentPickerResult;
    try {
      res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
    } catch (e: any) {
      appAlert('No se pudo abrir el selector', String(e?.message ?? e), undefined, { variant: 'error' });
      return;
    }
    if (res.canceled) return;
    const target = await chooseVault('Importar aquí');
    if (target === null) return;
    let imported = 0;
    let first: MdFile | null = null;
    const errors: string[] = [];
    for (const asset of res.assets) {
      try {
        const content = await FileSystem.readAsStringAsync(asset.uri);
        const base = (asset.name ?? 'Importada').replace(MD_RE, '');
        const file = await createWith(base, content, target);
        first = first ?? file;
        imported++;
      } catch (e: any) {
        errors.push(`${asset.name ?? 'archivo'}: ${e?.message ?? e}`);
      }
    }
    if (imported === 0) {
      appAlert('No pude importar', errors[0] ?? 'El archivo no se pudo leer como texto.', undefined, {
        variant: 'error',
      });
    } else if (imported === 1 && first) {
      openNote(first);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      appAlert('Notas importadas', `Se agregaron ${imported} notas.`, undefined, { variant: 'success' });
    }
  };

  const confirmDelete = (file: MdFile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    appAlert(`Eliminar "${file.name}"`, 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          remove(file.id).catch((e: any) =>
            appAlert('No se pudo eliminar', String(e?.message ?? e), undefined, { variant: 'error' })
          ),
      },
    ]);
  };

  const heroHeader = (
    <View style={[styles.hero, { borderBottomColor: theme.line }]}>
      <Text style={[styles.heroLabel, { color: theme.accent }]} numberOfLines={1}>
        {vaults.length === 0
          ? '— NOTAS EN EL DISPOSITIVO'
          : vaults.length === 1
            ? `— CARPETA · ${vaults[0].name}`
            : `— ${vaults.length} CARPETAS`}
      </Text>
      <Text style={[styles.heroTitle, { color: theme.ink }]}>
        {noteCount} {noteCount === 1 ? 'nota' : 'notas'}
        {otherCount > 0 && (
          <Text style={{ color: theme.muted }}>
            {`  ·  ${otherCount} ${otherCount === 1 ? 'archivo' : 'archivos'}`}
          </Text>
        )}
      </Text>
      <View style={[styles.searchPill, { backgroundColor: theme.bg2 }]}>
        <View style={[styles.dot, { backgroundColor: theme.muted }]} />
        <TextInput
          style={[styles.searchInput, { color: theme.ink }]}
          placeholder="Buscar en el contenido…"
          placeholderTextColor={theme.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>
      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.tagFilterRow}
        >
          {allTags.map((t) => {
            const active = t === tagFilter;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTagFilter(active ? null : t);
                }}
                style={[
                  styles.tagFilterChip,
                  { borderColor: active ? theme.accent : theme.line, backgroundColor: active ? theme.accent : 'transparent' },
                ]}
              >
                <Text style={[styles.tagFilterText, { color: active ? '#f5f1ea' : theme.sepia }]}>#{t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: theme.line }]}>
        <Wordmark size={19} />
        <View style={styles.topRight}>
          <TouchableOpacity
            style={[styles.openBtn, { borderColor: vaults.length ? theme.accent : theme.line }]}
            onPress={handleFolderPress}
          >
            <FolderIcon color={vaults.length ? theme.accent : theme.ink} />
            <Text
              style={[styles.openText, { color: vaults.length ? theme.accent : theme.ink }]}
              numberOfLines={1}
            >
              {vaults.length === 0
                ? 'Abrir carpeta'
                : vaults.length === 1
                  ? vaults[0].name
                  : `${vaults.length} carpetas`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
            <GearIcon color={theme.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {vaults.length > 0 && filtered.length > 0 ? (
        // Con carpeta(s) abierta(s): árbol recursivo y colapsable. Con más de una,
        // `groups` antepone una raíz por carpeta.
        <NoteTree
          notes={filtered}
          groups={treeGroups}
          folders={treeFolders}
          onSelect={openNote}
          onLongPressFile={confirmDelete}
          header={heroHeader}
          footer={<Footer />}
        />
      ) : (
        // Sin vault (notas internas): lista rica con preview y tags.
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={heroHeader}
          ListEmptyComponent={
            loaded ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: theme.muted }]}>
                  Aún no hay notas.{'\n'}Toca el + para empezar, o{' '}
                  <Text style={{ color: theme.accent }} onPress={handleFolderPress}>
                    {Platform.OS === 'android' ? 'abre una carpeta' : 'importa archivos'}
                  </Text>{' '}
                  del teléfono.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={files.length > 0 ? <Footer /> : null}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openNote(item)}
              onLongPress={() => confirmDelete(item)}
              delayLongPress={350}
              style={({ pressed }) => [
                styles.fileItem,
                { borderBottomColor: theme.line },
                pressed && { backgroundColor: theme.bg2 },
              ]}
            >
              <View style={styles.fileHeader}>
                <Text style={[styles.fileName, { color: theme.ink }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.fileTime, { color: theme.muted }]}>
                  {relativeTime(item.updatedAt)}
                </Text>
              </View>
              <Text style={[styles.filePreview, { color: theme.muted }]} numberOfLines={2}>
                {preview(item.content)}
              </Text>
              {item.tags && item.tags.length > 0 && (
                <View style={styles.tags}>
                  {item.tags.map((tag, i) => (
                    <View key={i} style={[styles.tag, { borderColor: theme.line }]}>
                      <Text style={[styles.tagText, { color: theme.sepia }]}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          )}
        />
      )}

      <TouchableOpacity
        onPress={handleCreate}
        style={[styles.fab, { backgroundColor: theme.accent }]}
        activeOpacity={0.85}
      >
        <Text style={{ color: '#f5f1ea', fontSize: 28, fontWeight: '300', marginTop: -2 }}>+</Text>
      </TouchableOpacity>

      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.bg + 'e6' }]}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={[styles.loadingText, { color: theme.muted }]}>Abriendo carpeta…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  openText: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 0.5, flexShrink: 1 },
  hero: { padding: spacing.xl, borderBottomWidth: 1 },
  heroLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2.5 },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
    marginTop: spacing.sm,
    letterSpacing: -0.5,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fonts.sans },
  tagFilterRow: { gap: 6, paddingTop: spacing.md, paddingRight: spacing.sm },
  tagFilterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  tagFilterText: { fontFamily: fonts.mono, fontSize: 11 },
  fileItem: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  fileName: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    marginRight: spacing.sm,
  },
  fileTime: { fontFamily: fonts.mono, fontSize: 11 },
  filePreview: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19 },
  tags: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  tagText: { fontFamily: fonts.mono, fontSize: 10 },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  empty: { padding: spacing.xxl, alignItems: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.5 },
});
