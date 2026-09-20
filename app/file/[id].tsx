import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, spacing } from '@/theme';
import { useFilesStore } from '@/storage/store';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { appAlert } from '@/components/AppAlert';

// Extensión → lenguaje de highlight.js (los que trae el bundle "common").
const LANGS: Record<string, string> = {
  sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', bat: 'dos',
  py: 'python', js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
  json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', conf: 'ini',
  cfg: 'ini', env: 'bash', sql: 'sql', css: 'css', scss: 'scss',
  html: 'xml', htm: 'xml', xml: 'xml', csv: 'plaintext', log: 'plaintext',
  dockerfile: 'dockerfile', makefile: 'makefile',
};

function languageFor(name: string): string {
  const lower = name.toLowerCase();
  const ext = lower.includes('.') ? (lower.split('.').pop() ?? '') : lower;
  return LANGS[ext] ?? 'plaintext';
}

// El archivo se muestra como un bloque de código Markdown: así reusa el resaltado,
// el tema y el tamaño de lectura que ya tiene el preview. La valla se calcula más
// larga que cualquier secuencia de backticks del archivo, para no cortarlo al medio.
function asCodeBlock(content: string, lang: string): string {
  const longest = (content.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${content}\n${fence}`;
}

export default function FileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { files, loaded, load } = useFilesStore();
  const file = files.find((f) => f.id === id);

  const [content, setContent] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (!file?.uri) return;
    let alive = true;
    FileSystem.readAsStringAsync(file.uri)
      .then((text) => alive && setContent(text))
      .catch((e: any) => alive && setFailed(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [file?.uri]);

  const share = async () => {
    if (!file?.uri || content === null) return;
    await Haptics.selectionAsync();
    // Copia local: compartir directo el content:// del vault no siempre funciona.
    const tmp = `${FileSystem.cacheDirectory}${file.name}`;
    await FileSystem.writeAsStringAsync(tmp, content);
    await Sharing.shareAsync(tmp, { dialogTitle: file.name });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: theme.line }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backIcon, { color: theme.ink }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.muted }]} numberOfLines={1}>
          {file?.name ?? 'Archivo'}
        </Text>
        <Text style={[styles.lang, { color: theme.sepia }]}>{file ? languageFor(file.name) : ''}</Text>
        <TouchableOpacity
          onPress={() => share().catch((e: any) => appAlert('No pude compartirlo', String(e?.message ?? e), undefined, { variant: 'error' }))}
          style={styles.back}
        >
          <Text style={[styles.shareIcon, { color: theme.accent }]}>⇪</Text>
        </TouchableOpacity>
      </View>

      {failed ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.muted }]}>
            No pude leer este archivo.{'\n'}
            {failed}
          </Text>
        </View>
      ) : !file || content === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <MarkdownPreview content={asCodeBlock(content, languageFor(file.name))} background={theme.bg} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
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
  shareIcon: { fontSize: 17 },
  title: { flex: 1, fontFamily: fonts.mono, fontSize: 12 },
  lang: { fontFamily: fonts.mono, fontSize: 10 },
  error: { fontFamily: fonts.sans, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
