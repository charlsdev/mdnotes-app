import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, fonts, spacing } from '@/theme';
import { useFilesStore } from '@/storage/store';
import { PdfViewer } from '@/components/PdfViewer';
import { openWithSystemViewer } from '@/storage/vault';
import { appAlert } from '@/components/AppAlert';

// Copia local del PDF: el WebView no puede leer el content:// de la carpeta.
// Se guarda en una carpeta propia de la caché que se vacía en cada apertura, así
// no se acumulan copias de todos los PDF que se hayan abierto.
const CACHE_DIR = `${FileSystem.cacheDirectory}pdf/`;

async function cacheCopy(uri: string): Promise<string> {
  await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  const to = `${CACHE_DIR}doc.pdf`;
  await FileSystem.copyAsync({ from: uri, to });
  return to;
}

export default function PdfScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { files, loaded, load } = useFilesStore();
  const file = files.find((f) => f.id === id);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [pages, setPages] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (!file?.uri) return;
    let alive = true;
    cacheCopy(file.uri)
      .then((uri) => alive && setLocalUri(uri))
      .catch((e: any) => alive && setFailed(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [file?.uri]);

  // Respaldo: si pdf.js no puede con el archivo, el visor del teléfono quizá sí.
  const openOutside = () => {
    if (!file?.uri) return;
    openWithSystemViewer(file.uri, file.name).catch((e: any) =>
      appAlert('No pude abrirlo fuera', String(e?.message ?? e), undefined, { variant: 'error' })
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: theme.line }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backIcon, { color: theme.ink }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.muted }]} numberOfLines={1}>
          {file?.name ?? 'PDF'}
        </Text>
        {!!pages?.total && (
          <Text style={[styles.pages, { color: theme.muted }]}>
            {pages.done > 0 && pages.done < pages.total ? `${pages.done}/${pages.total}` : `${pages.total} pág.`}
          </Text>
        )}
        <TouchableOpacity onPress={openOutside} style={styles.back}>
          <Text style={[styles.openIcon, { color: theme.accent }]}>⇱</Text>
        </TouchableOpacity>
      </View>

      {failed ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.muted }]}>No pude mostrar este PDF.{'\n'}{failed}</Text>
          <TouchableOpacity onPress={openOutside} style={[styles.btn, { backgroundColor: theme.ink }]}>
            <Text style={[styles.btnText, { color: theme.bg }]}>ABRIR CON OTRA APP</Text>
          </TouchableOpacity>
        </View>
      ) : !file || !localUri ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <PdfViewer
          fileUri={localUri}
          onProgress={(done, total) => setPages({ done, total })}
          onError={setFailed}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 30, marginTop: -4 },
  openIcon: { fontSize: 18 },
  title: { flex: 1, fontFamily: fonts.mono, fontSize: 12 },
  pages: { fontFamily: fonts.mono, fontSize: 10 },
  error: { fontFamily: fonts.sans, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  btn: { paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: 24 },
  btnText: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2 },
});
