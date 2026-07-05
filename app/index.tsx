import { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Path } from 'react-native-svg';
import { useTheme, fonts, spacing, radius } from '@/theme';
import { useFilesStore } from '@/storage/store';
import { relativeTime, preview } from '@/utils/text';
import { MdFile } from '@/types';
import { Wordmark } from '@/components/Wordmark';
import { Footer } from '@/components/Footer';
import { NoteTree } from '@/components/NoteTree';
import { appAlert } from '@/components/AppAlert';

const MD_RE = /\.(md|markdown|txt|mdx)$/i;

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
  const { files, loaded, loading, load, create, createWith, remove, vaultUri, vaultName, openVault, closeVault } =
    useFilesStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!loaded) load();
  }, [loaded]);

  const filtered = useMemo(() => {
    if (!query.trim()) return files;
    const q = query.toLowerCase();
    return files.filter(
      (f) => f.name.toLowerCase().includes(q) || f.content.toLowerCase().includes(q)
    );
  }, [files, query]);

  const handleCreate = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const file = await create();
    openNote(file);
  };

  // Navega al editor pasando el id como PARÁMETRO (se codifica bien; los id de
  // vault son URIs SAF con / y : que romperían la ruta si se interpolan).
  const openNote = (note: MdFile) => router.push({ pathname: '/editor/[id]', params: { id: note.id } });

  // Botón de carpeta: sin vault abre una (Android) o importa archivos (iOS); con
  // vault abierto muestra el menú de la carpeta.
  const handleFolderPress = () => {
    if (!vaultUri) {
      if (Platform.OS === 'android') openFolder();
      else importFiles();
      return;
    }
    appAlert(vaultName ?? 'Carpeta', 'Editas los .md reales de esta carpeta; los cambios se guardan ahí.', [
      { text: 'Cambiar carpeta', onPress: openFolder },
      { text: 'Importar archivos aquí', onPress: importFiles },
      { text: 'Cerrar carpeta', onPress: () => closeVault() },
      { text: 'Cancelar', style: 'cancel' },
    ], { variant: 'info', tag: 'Carpeta abierta' });
  };

  // Abre una carpeta (vault) y reporta cuántos .md trajo, o el error real.
  const openFolder = async () => {
    try {
      const n = await openVault();
      if (n === null) return; // cancelado
      if (n === 0) {
        appAlert(
          'Carpeta abierta, pero vacía',
          'No encontré archivos .md ahí. Ojo: solo leo los que están DIRECTAMENTE en la carpeta (no en subcarpetas).',
          undefined,
          { variant: 'error' }
        );
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        appAlert('Carpeta abierta', `${n} nota${n === 1 ? '' : 's'} encontrada${n === 1 ? '' : 's'}.`, undefined, {
          variant: 'success',
        });
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
    let imported = 0;
    let first: MdFile | null = null;
    const errors: string[] = [];
    for (const asset of res.assets) {
      try {
        const content = await FileSystem.readAsStringAsync(asset.uri);
        const base = (asset.name ?? 'Importada').replace(MD_RE, '');
        const file = await createWith(base, content);
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
      { text: 'Eliminar', style: 'destructive', onPress: () => remove(file.id) },
    ]);
  };

  const heroHeader = (
    <View style={[styles.hero, { borderBottomColor: theme.line }]}>
      <Text style={[styles.heroLabel, { color: theme.accent }]} numberOfLines={1}>
        {vaultUri ? `— CARPETA · ${vaultName}` : '— NOTAS EN EL DISPOSITIVO'}
      </Text>
      <Text style={[styles.heroTitle, { color: theme.ink }]}>
        {files.length} {files.length === 1 ? 'nota' : 'notas'}
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
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: theme.line }]}>
        <Wordmark size={19} />
        <View style={styles.topRight}>
          <TouchableOpacity
            style={[
              styles.openBtn,
              { borderColor: vaultUri ? theme.accent : theme.line },
            ]}
            onPress={handleFolderPress}
          >
            <FolderIcon color={vaultUri ? theme.accent : theme.ink} />
            <Text
              style={[styles.openText, { color: vaultUri ? theme.accent : theme.ink }]}
              numberOfLines={1}
            >
              {vaultUri ? vaultName : 'Abrir carpeta'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
            <GearIcon color={theme.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {vaultUri && filtered.length > 0 ? (
        // Vault abierto: árbol de carpetas + notas (recursivo, colapsable).
        <NoteTree
          notes={filtered}
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
