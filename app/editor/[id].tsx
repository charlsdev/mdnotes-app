import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, fonts, spacing } from '@/theme';
import { useFilesStore } from '@/storage/store';
import { MdFile, EditorMode } from '@/types';
import { EditorToolbar } from '@/components/EditorToolbar';
import { ModeToggle } from '@/components/ModeToggle';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { NoteTreeDrawer } from '@/components/NoteTreeDrawer';
import { appAlert } from '@/components/AppAlert';
import { mdToHtml } from '@/lib/markdown';
import { readImageDataUri } from '@/storage/vault';
import { deriveName, extractTags } from '@/utils/text';

interface Sel {
  start: number;
  end: number;
}

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { files, upsert, remove, vaultImages } = useFilesStore();

  const [file, setFile] = useState<MdFile | null>(null);
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<EditorMode>('edit');
  const [rendered, setRendered] = useState('');
  const [selection, setSelection] = useState<Sel>({ start: 0, end: 0 });

  // En VIEW, resuelve las imágenes locales del vault (./img/x.png) a data URIs
  // antes de pasar el contenido al preview (el WebView no lee content:// sueltos).
  useEffect(() => {
    if (mode !== 'view') return;
    let alive = true;
    inlineLocalImages(content, file?.folder ?? '', vaultImages).then((html) => {
      if (alive) setRendered(html);
    });
    return () => {
      alive = false;
    };
  }, [mode, content, file?.folder, vaultImages]);

  const inputRef = useRef<TextInput>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedId = useRef<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Carga la nota; recarga si cambia `id` (al saltar de una nota a otra).
  useEffect(() => {
    if (loadedId.current === id) return;
    const found = files.find((f) => f.id === id);
    if (found) {
      setFile(found);
      setContent(found.content);
      loadedId.current = id ?? null;
    }
  }, [id, files]);

  // Autosave con debounce (600 ms).
  useEffect(() => {
    if (!file || content === file.content) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const updated: MdFile = {
        ...file,
        content,
        // Nota de carpeta (vault): el nombre = nombre del archivo, no se re-deriva.
        name: file.uri ? file.name : deriveName(content),
        tags: extractTags(content),
        updatedAt: Date.now(),
      };
      upsert(updated);
      setFile(updated);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, file]);

  // Aplica una edición y reposiciona el cursor de forma controlada.
  const applyEdit = useCallback((next: string, caret: number) => {
    setContent(next);
    setSelection({ start: caret, end: caret });
  }, []);

  // Inserta texto crudo en el cursor (o reemplaza la selección).
  const onInsert = useCallback(
    (text: string, cursorOffset = 0) => {
      const { start, end } = selection;
      const next = content.slice(0, start) + text + content.slice(end);
      applyEdit(next, start + text.length + cursorOffset);
    },
    [content, selection, applyEdit]
  );

  // Envuelve la selección (negrita, cursiva, código). Sin selección, deja el
  // par vacío con el cursor en medio.
  const onWrap = useCallback(
    (wrap: string) => {
      const { start, end } = selection;
      const middle = content.slice(start, end);
      const next =
        content.slice(0, start) + wrap + middle + wrap + content.slice(end);
      const caret = middle ? end + wrap.length * 2 : start + wrap.length;
      applyEdit(next, caret);
    },
    [content, selection, applyEdit]
  );

  // Antepone un prefijo al inicio de la línea actual (encabezados, listas, cita).
  const onPrefix = useCallback(
    (prefix: string) => {
      const { start } = selection;
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
      applyEdit(next, start + prefix.length);
    },
    [content, selection, applyEdit]
  );

  const handleExportPDF = async () => {
    if (!file) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const resolved = await inlineLocalImages(content, file.folder ?? '', vaultImages);
    const { uri } = await Print.printToFileAsync({ html: mdToHtml(resolved, 'pdf') });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${file.name}.pdf`,
    });
  };

  // Inserta una imagen de la galería como data URI (portable dentro del .md).
  const handleImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    if (!asset?.base64) return;
    const mime = asset.mimeType || 'image/jpeg';
    onInsert(`\n![imagen](data:${mime};base64,${asset.base64})\n`);
  };

  const handleShareMd = async () => {
    if (!file) return;
    await Haptics.selectionAsync();
    const uri = await writeTempMd(file.name, content);
    await Sharing.shareAsync(uri, { mimeType: 'text/markdown', dialogTitle: `${file.name}.md` });
  };

  // Guarda de inmediato lo pendiente (antes de saltar a otra nota).
  const flushSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (file && content !== file.content) {
      upsert({
        ...file,
        content,
        name: file.uri ? file.name : deriveName(content),
        tags: extractTags(content),
        updatedAt: Date.now(),
      });
    }
  };

  // Salta a otra nota reemplazando la actual (back vuelve a la biblioteca).
  const switchTo = (note: MdFile) => {
    if (note.id === id) return;
    flushSave();
    router.replace({ pathname: '/editor/[id]', params: { id: note.id } });
  };

  const handleDelete = () => {
    if (!file) return;
    appAlert(`Eliminar "${file.name}"`, 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await remove(file.id);
          router.back();
        },
      },
    ]);
  };

  if (!file) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: theme.line }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backIcon, { color: theme.ink }]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.back}>
          <Text style={[styles.treeIcon, { color: theme.ink }]}>☰</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.muted }]} numberOfLines={1}>
          {file.name}.md
        </Text>
        <ModeToggle mode={mode} onChange={setMode} />
      </View>

      <NoteTreeDrawer
        visible={drawerOpen}
        notes={files}
        currentId={id}
        onSelect={switchTo}
        onClose={() => setDrawerOpen(false)}
      />

      {/* KeyboardAvoidingView de react-native-keyboard-controller (como daemoni):
          sigue el teclado animado y mantiene la toolbar del editor por encima. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {mode === 'edit' ? (
          <>
            <TextInput
              ref={inputRef}
              style={[styles.editor, { color: theme.ink, fontFamily: fonts.mono }]}
              multiline
              value={content}
              onChangeText={setContent}
              selection={selection}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              autoCapitalize="sentences"
              autoCorrect
              textAlignVertical="top"
              placeholder="Empieza a escribir…"
              placeholderTextColor={theme.muted}
            />
            <EditorToolbar
              onWrap={onWrap}
              onPrefix={onPrefix}
              onInsert={onInsert}
              onImage={handleImage}
            />
          </>
        ) : (
          <View style={{ flex: 1 }}>
            <MarkdownPreview content={rendered || content} background={theme.bg} />
            <View style={[styles.previewActions, { borderTopColor: theme.line }]}>
              <TouchableOpacity
                onPress={handleExportPDF}
                style={[styles.actionBtn, { backgroundColor: theme.ink }]}
              >
                <Text style={[styles.actionText, { color: theme.bg }]}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShareMd}
                style={[styles.actionBtn, { borderColor: theme.line, borderWidth: 1 }]}
              >
                <Text style={[styles.actionText, { color: theme.ink }]}>COMPARTIR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                style={[styles.actionBtn, { borderColor: theme.line, borderWidth: 1 }]}
              >
                <Text style={[styles.actionText, { color: theme.accent }]}>ELIMINAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Resuelve una ruta relativa (con ./ , ../ o \) contra la carpeta de la nota.
function resolveRel(folder: string, ref: string): string {
  const parts = [...folder.split('/'), ...ref.replace(/\\/g, '/').split('/')];
  const stack: string[] = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  return stack.join('/');
}

const IMG_MD_RE = /!\[[^\]]*\]\(\s*([^)\s]+)/g;
const IMG_HTML_RE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;

// Reemplaza imágenes locales (Markdown y <img>) por data URIs leídos del vault.
async function inlineLocalImages(
  content: string,
  folder: string,
  images: Record<string, string>
): Promise<string> {
  const refs = new Set<string>();
  let m: RegExpExecArray | null;
  IMG_MD_RE.lastIndex = 0;
  while ((m = IMG_MD_RE.exec(content))) refs.add(m[1]);
  IMG_HTML_RE.lastIndex = 0;
  while ((m = IMG_HTML_RE.exec(content))) refs.add(m[1]);

  const replacements: Record<string, string> = {};
  for (const ref of refs) {
    if (/^(https?:|data:|file:|content:)/i.test(ref)) continue;
    const norm = ref.replace(/\\/g, '/').replace(/^\.\//, '');
    const uri =
      images[resolveRel(folder, ref)] ?? images[norm] ?? images[decodeURIComponent(norm)];
    if (!uri) continue;
    try {
      replacements[ref] = await readImageDataUri(uri);
    } catch {
      // imagen ilegible: la dejamos como está
    }
  }

  let out = content;
  for (const [ref, data] of Object.entries(replacements)) out = out.split(ref).join(data);
  return out;
}

async function writeTempMd(name: string, content: string): Promise<string> {
  const safe = name.replace(/[^\w\-áéíóúñ ]+/gi, '').trim() || 'nota';
  const uri = FileSystem.cacheDirectory + `${safe}.md`;
  await FileSystem.writeAsStringAsync(uri, content);
  return uri;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  treeIcon: { fontSize: 18 },
  title: { flex: 1, fontFamily: fonts.mono, fontSize: 12, textAlign: 'center' },
  editor: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  actionText: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2 },
});
