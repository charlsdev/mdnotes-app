import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme, fonts, spacing, type Theme } from '@/theme';
import { useFilesStore } from '@/storage/store';
import { MdFile, EditorMode, isNote } from '@/types';
import { EditorToolbar } from '@/components/EditorToolbar';
import { ModeToggle } from '@/components/ModeToggle';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { MarkdownWysiwyg } from '@/components/MarkdownWysiwyg';
import { NoteTreeDrawer } from '@/components/NoteTreeDrawer';
import { appAlert } from '@/components/AppAlert';
import { mdToHtml, unescapeMarkers } from '@/lib/markdown';
import { buildLinkIndex, resolveWikilink, backlinksFor, shortestLinkLabel } from '@/lib/wikilinks';
import { relativeTo, encodeRef, createImageResolver, attachmentFolderFromSetting } from '@/lib/paths';
import { WikilinkSuggestions } from '@/components/WikilinkSuggestions';
import { readImageDataUri, saveVaultImage, attachmentFolderFor, openWithSystemViewer } from '@/storage/vault';
import { useSettings } from '@/storage/settings';
import { deriveName, computeTags } from '@/utils/text';
import { splitFrontmatter, stripFrontmatter, getFrontmatterTags, setFrontmatterTags } from '@/lib/frontmatter';
import { TagsBar } from '@/components/TagsBar';

type SaveState = 'saved' | 'saving' | 'dirty';

interface Sel {
  start: number;
  end: number;
}

export default function EditorScreen() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const autosave = useSettings((s) => s.autosave);
  const pdfMarginMm = useSettings((s) => s.pdfMarginMm);
  const readingScale = useSettings((s) => s.readingScale);
  const attachmentMode = useSettings((s) => s.attachmentMode);
  const attachmentFolderPref = useSettings((s) => s.attachmentFolder);
  const { files, upsert, remove, vaultImages, vaults, vaultFolders, addVaultImage, readContent, loaded, load } =
    useFilesStore();

  const [file, setFile] = useState<MdFile | null>(null);
  const [content, setContent] = useState('');
  // Contenido tal cual está en disco: referencia para saber si hay cambios pendientes.
  // (No se compara contra `file.content`, que en el store es la copia ligera.)
  const savedRef = useRef('');
  // Texto que está siendo escrito al disco en este momento (o null).
  const savingContentRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  // Nota nueva → CÓDIGO (escribir rápido); abrir existente → VER (leer). VIVO
  // (WYSIWYG) es opt-in por nota para no cargar el editor pesado sin querer.
  const [mode, setMode] = useState<EditorMode>(isNew ? 'code' : 'view');
  const [rendered, setRendered] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [selection, setSelection] = useState<Sel>({ start: 0, end: 0 });
  // Markdown con imágenes del vault embebidas (data URI) para el editor VIVO, y
  // el mapa para restaurar las rutas originales al guardar.
  const [liveMd, setLiveMd] = useState<string | null>(null);
  const imgRestore = useRef<Array<[string, string]>>([]);

  // Todo lo que sigue es RELATIVO A LA CARPETA de la nota: sus imágenes, sus
  // adjuntos y sus enlaces. Con varias carpetas abiertas, mezclarlas mostraría
  // imágenes de otra carpeta y crearía enlaces que Obsidian no podría resolver.
  const vault = useMemo(() => vaults.find((v) => v.id === file?.vaultId), [vaults, file?.vaultId]);
  const noteImages = useMemo(
    () => (file?.vaultId ? (vaultImages[file.vaultId] ?? {}) : {}),
    [vaultImages, file?.vaultId]
  );
  // El cajón para saltar de nota es solo de NOTAS (un PDF no se edita).
  const notes = useMemo(() => files.filter(isNote), [files]);
  // El índice de enlaces, en cambio, incluye los adjuntos: `[manual](manual.pdf)` y
  // `[[manual.pdf]]` son enlaces válidos en Obsidian. Al tocarlos, el editor decide
  // si abre la nota o se lo pasa al visor del teléfono.
  const vaultFiles = useMemo(
    () => files.filter((f) => (f.vaultId ?? '') === (file?.vaultId ?? '')),
    [files, file?.vaultId]
  );

  // Para el cajón: el MISMO directorio que la biblioteca (carpetas vacías incluidas),
  // no solo los .md — si no, el cajón parece mostrar otra carpeta.
  const treeGroups = useMemo(() => {
    if (vaults.length < 2) return undefined;
    const groups: { id: string; name: string; folders?: string[] }[] = vaults.map((v) => ({
      id: v.id,
      name: v.name,
      folders: vaultFolders[v.id],
    }));
    if (files.some((f) => !f.vaultId)) groups.push({ id: '', name: 'En el dispositivo' });
    return groups;
  }, [vaults, files, vaultFolders]);

  const drawerFolders = vaults.length === 1 ? vaultFolders[vaults[0].id] : undefined;

  // En VIEW, resuelve las imágenes locales del vault (./img/x.png) a data URIs
  // antes de pasar el contenido al preview (el WebView no lee content:// sueltos).
  useEffect(() => {
    if (mode !== 'view') return;
    let alive = true;
    inlineLocalImages(content, file?.folder ?? '', noteImages).then(({ md }) => {
      if (alive) setRendered(md);
    });
    return () => {
      alive = false;
    };
  }, [mode, content, file?.folder, noteImages]);

  // Ref al contenido actual: lo lee el efecto de VIVO (que NO puede depender de
  // `content` sin provocar un re-feed en cada tecla) y el guardado desde VIVO
  // (para conservar el frontmatter). Se declara ANTES del efecto de VIVO a
  // propósito: los efectos corren en orden de declaración, y si se sincronizara
  // después, VIVO leería el contenido de la nota anterior al saltar de nota.
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Al entrar a VIVO (o cambiar de nota), embebe las imágenes locales como data
  // URI para que Crepe las muestre. Depende de `ready`, no de `content`: hasta que
  // la nota no terminó de leerse del disco, `contentRef` es de la nota anterior.
  useEffect(() => {
    if (mode !== 'live' || !ready) {
      setLiveMd(null);
      return;
    }
    let alive = true;
    setLiveMd(null);
    // El frontmatter (tags) NO va a Crepe (lo mostraría raro); se preserva al guardar.
    inlineLocalImages(stripFrontmatter(contentRef.current), file?.folder ?? '', noteImages).then(({ md, restore }) => {
      if (!alive) return;
      imgRestore.current = restore;
      // (1) des-escapa marcadores de alerta por si el archivo quedó con `\[!`.
      // (2) Crepe NO renderiza <img> HTML: lo pasamos a Markdown ![](...).
      const clean = unescapeMarkers(md).replace(
        /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
        (_m, src) => `![](${src})`
      );
      setLiveMd(clean);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id, ready, file?.folder, noteImages]);

  // Cambio desde VIVO: (1) des-escapa alertas, quita `<br />`, restaura imágenes;
  // (2) re-antepone el frontmatter (tags) que Crepe no maneja.
  const onLiveChange = useCallback((md: string) => {
    // Crepe escapa los corchetes al reserializar: rompería tanto las alertas
    // (`\[!NOTE]`) como los enlaces internos (`\[\[nota]]`).
    let body = unescapeMarkers(md).replace(/<br\s*\/?>\n?/gi, '');
    for (const [dataUri, ref] of imgRestore.current) body = body.split(dataUri).join(ref);
    const fm = splitFrontmatter(contentRef.current).fm;
    setContent(fm + body);
  }, []);

  // --- Enlaces internos [[nota]] ---
  const linkIndex = useMemo(() => buildLinkIndex(vaultFiles), [vaultFiles]);
  const resolveLink = useCallback(
    (target: string) => resolveWikilink(target, file?.folder ?? '', linkIndex),
    [linkIndex, file?.folder]
  );
  const backlinks = useMemo(
    () => (file ? backlinksFor(file.id, vaultFiles, linkIndex).map((n) => ({ id: n.id, name: n.name })) : []),
    [file, vaultFiles, linkIndex]
  );

  // Tags editables (en el frontmatter del contenido).
  const tags = getFrontmatterTags(content);
  const addTag = (t: string) => setContent(setFrontmatterTags(content, [...tags, t]));
  const removeTag = (t: string) => setContent(setFrontmatterTags(content, tags.filter((x) => x !== t)));

  const inputRef = useRef<TextInput>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedId = useRef<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Al entrar directo al editor (restauración de estado, enlace) la biblioteca
  // puede no haber cargado todavía.
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  // Carga la nota; recarga si cambia `id` (al saltar de una nota a otra). El
  // contenido se relee del disco: el del store es la copia ligera (sin los base64
  // de las imágenes) y además así tomamos ediciones hechas fuera de la app.
  useEffect(() => {
    if (loadedId.current === id) return;
    const found = files.find((f) => f.id === id);
    if (!found) {
      // Con la biblioteca ya cargada, un id que no existe es una nota borrada o
      // movida: avisamos en vez de dejar el spinner girando para siempre.
      if (loaded) {
        loadedId.current = id ?? null; // que no se repita el aviso si `files` cambia
        appAlert('Esa nota ya no está', 'Puede haberse borrado o movido.', [
          { text: 'Volver', onPress: () => router.back() },
        ], { variant: 'error' });
      }
      return;
    }
    loadedId.current = id ?? null;
    setFile(found);
    setReady(false);
    let alive = true;
    readContent(found)
      .then((full) => {
        if (!alive) return;
        savedRef.current = full;
        setContent(full);
        setReady(true);
      })
      .catch((e: any) => {
        if (!alive) return;
        appAlert(
          'No pude abrir la nota',
          `${e?.message ?? e}\n\nEl archivo pudo haberse movido o borrado desde otra app.`,
          [{ text: 'Volver', onPress: () => router.back() }],
          { variant: 'error' }
        );
      });
    return () => {
      alive = false;
    };
  }, [id, files, loaded, readContent, router]);

  // Persiste el contenido actual de inmediato. Devuelve false SOLO si la escritura
  // falló (no hay nada que guardar también cuenta como éxito).
  const doSave = useCallback(async (): Promise<boolean> => {
    if (!file || !ready || content === savedRef.current) return true;
    // Ese mismo texto ya se está escribiendo (el autoguardado con debounce y el
    // flush al salir se solapan): no lo mandes dos veces al disco.
    if (savingContentRef.current === content) return true;
    savingContentRef.current = content;
    const updated: MdFile = {
      ...file,
      content,
      // Nota de carpeta (vault): el nombre = nombre del archivo, no se re-deriva.
      name: file.uri ? file.name : deriveName(content),
      tags: computeTags(content),
      updatedAt: Date.now(),
    };
    setSaveState('saving');
    try {
      // Nos quedamos con lo que devuelve el store: si el archivo hubo que recrearlo
      // (ver `writeVaultFile`), la URI puede ser otra.
      const saved = await upsert(updated);
      // `content` es el de esta pasada: si el usuario siguió escribiendo, el effect
      // detecta que hay cambios nuevos y vuelve a marcar pendiente.
      savedRef.current = content;
      setFile(saved);
      setSaveState('saved');
      return true;
    } catch (e: any) {
      setSaveState('dirty');
      appAlert(
        'No se pudo guardar',
        `${e?.message ?? e}\n\nTu texto sigue aquí. Revisa que la carpeta siga disponible y vuelve a intentar.`,
        undefined,
        { variant: 'error' }
      );
      return false;
    } finally {
      if (savingContentRef.current === content) savingContentRef.current = null;
    }
  }, [file, content, ready, upsert]);

  // Marca estado + autoguarda con debounce (solo si autosave está activo).
  useEffect(() => {
    if (!file || !ready) return;
    if (content === savedRef.current) {
      setSaveState('saved');
      return;
    }
    if (!autosave) {
      setSaveState('dirty'); // manual: se guarda con el botón o al salir
      return;
    }
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, file, ready, autosave, doSave]);

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

  // Limpia el formato Markdown de la selección (marcadores inline + prefijos de línea).
  const onClear = useCallback(() => {
    const { start, end } = selection;
    if (start === end) return;
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
    applyEdit(content.slice(0, start) + cleaned + content.slice(end), start + cleaned.length);
  }, [content, selection, applyEdit]);

  // `[[` abierto antes del cursor (sin cerrar y en la misma línea) → sugerencias.
  const wikiQuery = useMemo(() => {
    if (mode !== 'code') return null;
    const upto = content.slice(0, selection.start);
    const open = upto.lastIndexOf('[[');
    if (open < 0) return null;
    const typed = upto.slice(open + 2);
    if (typed.includes(']]') || typed.includes('\n') || typed.length > 40) return null;
    return { from: open, typed };
  }, [mode, content, selection.start]);

  const wikiSuggestions = useMemo(() => {
    if (!wikiQuery) return [];
    const q = wikiQuery.typed.trim().toLowerCase();
    return files
      .filter((f) => f.id !== file?.id && (!q || f.name.toLowerCase().includes(q)))
      .slice(0, 12);
  }, [wikiQuery, files, file?.id]);

  // Completa el enlace con el nombre suelto, o la ruta si el nombre es ambiguo.
  const insertWikilink = (note: MdFile) => {
    if (!wikiQuery) return;
    const label = shortestLinkLabel(note, linkIndex);
    const rest = content.slice(selection.start);
    // Si el `]]` ya está escrito después del cursor, no pongas otro.
    const link = rest.startsWith(']]') ? `[[${label}` : `[[${label}]]`;
    const next = content.slice(0, wikiQuery.from) + link + rest;
    applyEdit(next, wikiQuery.from + `[[${label}]]`.length);
  };

  const handleExportPDF = async () => {
    if (!file) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { md: resolved } = await inlineLocalImages(content, file.folder ?? '', noteImages);
    const { uri } = await Print.printToFileAsync({
      html: mdToHtml(resolved, 'pdf', { pdfMarginMm, resolveLink }),
    });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${file.name}.pdf`,
    });
  };

  // Inserta una imagen de la galería, redimensionada (máx ~1400px) y comprimida.
  // Con carpeta abierta va como ARCHIVO del vault y la nota guarda solo la ruta:
  // el .md se mantiene legible y portable (así lo espera Obsidian). Sin vault —o si
  // la carpeta no acepta la escritura— cae al data URI incrustado, que siempre funciona.
  const handleImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled) return;
    const asset = res.assets[0];
    if (!asset?.uri) return;
    const actions = asset.width && asset.width > 1400 ? [{ resize: { width: 1400 } }] : [];
    const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
      compress: 0.6,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!out.base64) return;

    if (vault && file?.uri) {
      try {
        const noteFolder = file.folder ?? '';
        // El ajuste manda; si está en automático, se deduce de la config de Obsidian
        // o de la convención que ya usan las notas DE ESTA carpeta.
        const folder = await attachmentFolderFor(
          vault.uri,
          noteFolder,
          Object.keys(noteImages),
          attachmentFolderFromSetting(attachmentMode, attachmentFolderPref, noteFolder)
        );
        const saved = await saveVaultImage(vault.uri, folder, imageBaseName(), out.base64);
        addVaultImage(vault.id, saved.relPath, saved.uri);
        onInsert(`\n![imagen](${encodeRef(relativeTo(noteFolder, saved.relPath))})\n`);
        return;
      } catch (e: any) {
        appAlert(
          'No pude guardar la imagen en la carpeta',
          `${e?.message ?? e}\n\nLa dejé incrustada en la nota para no perderla.`,
          undefined,
          { variant: 'warn' }
        );
      }
    }
    onInsert(`\n![imagen](data:image/jpeg;base64,${out.base64})\n`);
  };

  const handleShareMd = async () => {
    if (!file) return;
    await Haptics.selectionAsync();
    const uri = await writeTempMd(file.name, content);
    await Sharing.shareAsync(uri, { mimeType: 'text/markdown', dialogTitle: `${file.name}.md` });
  };

  // Guarda de inmediato lo pendiente (antes de salir o saltar a otra nota).
  const flushSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    return doSave();
  };

  // Guardado manual desde el indicador/botón.
  const handleManualSave = () => {
    Haptics.selectionAsync();
    flushSave();
  };

  // Si el guardado falla nos quedamos en el editor: salir perdería el texto.
  const goBack = async () => {
    if (await flushSave()) router.back();
  };

  // Salta a otra nota reemplazando la actual (back vuelve a la biblioteca).
  const switchTo = async (note: MdFile) => {
    if (note.id === id) return;
    if (!(await flushSave())) return;
    router.replace({ pathname: '/editor/[id]', params: { id: note.id } });
  };

  // Abrir algo del árbol o de un enlace: una nota salta en el editor, un adjunto
  // va a su visor. Misma decisión en el cajón y en los [[enlaces]] del preview.
  const openFile = (target: MdFile) => {
    if (isNote(target)) {
      switchTo(target);
    } else if (target.kind === 'pdf') {
      router.push({ pathname: '/pdf/[id]', params: { id: target.id } });
    } else if (target.kind === 'image') {
      router.push({ pathname: '/image/[id]', params: { id: target.id } });
    } else if (target.kind === 'text') {
      router.push({ pathname: '/file/[id]', params: { id: target.id } });
    } else if (target.uri) {
      openWithSystemViewer(target.uri, target.name).catch((e: any) =>
        appAlert(`No pude abrir "${target.name}"`, String(e?.message ?? e), undefined, { variant: 'error' })
      );
    }
  };

  const openNoteById = (noteId: string) => {
    const target = files.find((f) => f.id === noteId);
    if (target) openFile(target);
  };

  const handleDelete = () => {
    if (!file) return;
    appAlert(`Eliminar "${file.name}"`, 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(file.id);
          } catch (e: any) {
            appAlert('No se pudo eliminar', String(e?.message ?? e), undefined, { variant: 'error' });
            return;
          }
          router.back();
        },
      },
    ]);
  };

  if (!file || !ready) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: theme.line }]}>
        <TouchableOpacity onPress={goBack} style={styles.back}>
          <Text style={[styles.backIcon, { color: theme.ink }]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.back}>
          <Text style={[styles.treeIcon, { color: theme.ink }]}>☰</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.muted }]} numberOfLines={1}>
          {file.name}.md
        </Text>
        <SaveIndicator state={saveState} autosave={autosave} onSave={handleManualSave} theme={theme} />
        <ModeToggle mode={mode} onChange={setMode} />
      </View>

      <TagsBar tags={tags} onAdd={addTag} onRemove={removeTag} />

      <NoteTreeDrawer
        visible={drawerOpen}
        notes={files}
        groups={treeGroups}
        folders={drawerFolders}
        currentId={id}
        onSelect={openFile}
        onClose={() => setDrawerOpen(false)}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />

      {/* KeyboardAvoidingView de react-native-keyboard-controller (como daemoni):
          sigue el teclado animado y mantiene la toolbar del editor por encima. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {mode === 'live' ? (
          // WYSIWYG (Milkdown Crepe): editas sobre el documento renderizado.
          // Espera a que las imágenes del vault estén embebidas (liveMd) para no
          // arrancar con imágenes rotas.
          liveMd === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            <MarkdownWysiwyg noteId={id ?? ''} initialMarkdown={liveMd} onChange={onLiveChange} scale={readingScale} />
          )
        ) : mode === 'code' ? (
          <>
            <TextInput
              ref={inputRef}
              style={[
                styles.editor,
                { color: theme.ink, fontFamily: fonts.mono, fontSize: Math.round(15 * readingScale) },
              ]}
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
            <WikilinkSuggestions notes={wikiSuggestions} onPick={insertWikilink} />
            <EditorToolbar
              onWrap={onWrap}
              onPrefix={onPrefix}
              onInsert={onInsert}
              onImage={handleImage}
              onClear={onClear}
            />
          </>
        ) : (
          <View style={{ flex: 1 }}>
            <MarkdownPreview
              content={rendered || content}
              background={theme.bg}
              resolveLink={resolveLink}
              backlinks={backlinks}
              onOpenNote={openNoteById}
            />
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

// Indicador de guardado. Con autosave: muestra estado. Manual: botón "Guardar"
// cuando hay cambios sin guardar.
function SaveIndicator({
  state,
  autosave,
  onSave,
  theme,
}: {
  state: SaveState;
  autosave: boolean;
  onSave: () => void;
  theme: Theme;
}) {
  if (!autosave && state === 'dirty') {
    return (
      <TouchableOpacity onPress={onSave} style={[indicatorStyles.pill, { backgroundColor: theme.accent }]}>
        <Text style={[indicatorStyles.pillText, { color: '#f5f1ea' }]}>Guardar</Text>
      </TouchableOpacity>
    );
  }
  const label = state === 'saving' ? 'Guardando…' : 'Guardado';
  const color = state === 'saving' ? theme.accent : theme.muted;
  return <Text style={[indicatorStyles.text, { color }]}>{label}</Text>;
}

const indicatorStyles = StyleSheet.create({
  text: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.3 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.5 },
});

// Nombre del adjunto: ordenable y sin espacios (los espacios en una ruta de
// Markdown obligan a escaparlos y rompen en algunos renderizadores).
function imageBaseName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `imagen-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const IMG_MD_RE = /!\[[^\]]*\]\(\s*([^)\s]+)/g;
const IMG_HTML_RE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;
// Embed estilo Obsidian: ![[carpeta/foto.png]] (el `|tamaño` opcional se ignora).
const IMG_WIKI_RE = /!\[\[\s*([^[\]|#\n]+?)\s*(?:\|[^[\]\n]*)?\]\]/g;

// Reemplaza imágenes locales (Markdown y <img>) por data URIs leídos del vault.
// `restore` mapea dataUri → ref original (para deshacer al guardar desde VIVO).
async function inlineLocalImages(
  content: string,
  folder: string,
  images: Record<string, string>
): Promise<{ md: string; restore: Array<[string, string]> }> {
  const refs = new Set<string>();
  let m: RegExpExecArray | null;
  IMG_MD_RE.lastIndex = 0;
  while ((m = IMG_MD_RE.exec(content))) refs.add(m[1]);
  IMG_HTML_RE.lastIndex = 0;
  while ((m = IMG_HTML_RE.exec(content))) refs.add(m[1]);
  IMG_WIKI_RE.lastIndex = 0;
  // Solo los embeds que apuntan a una imagen; `![[otra nota]]` no es una imagen.
  while ((m = IMG_WIKI_RE.exec(content))) {
    if (/\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(m[1])) refs.add(m[1]);
  }

  const findImage = createImageResolver(images);
  const replacements: Record<string, string> = {};
  for (const ref of refs) {
    const uri = findImage(ref, folder);
    if (!uri) continue;
    try {
      replacements[ref] = await readImageDataUri(uri);
    } catch {
      // imagen ilegible: la dejamos como está
    }
  }

  let md = content;
  const restore: Array<[string, string]> = [];
  for (const [ref, data] of Object.entries(replacements)) {
    md = md.split(ref).join(data);
    restore.push([data, ref]);
  }
  return { md, restore };
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
