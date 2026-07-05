import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { useTheme } from '@/theme';

// Editor WYSIWYG (Milkdown Crepe) embebido en un WebView. El HTML autónomo vive
// en assets/webeditor.html (generado por webeditor/build.mjs). Puente:
//   RN → WV: window.__MD__ inicial + window.MDNOTES.setContent/setTheme
//   WV → RN: postMessage({ type: 'change', md })
export function MarkdownWysiwyg({
  noteId,
  initialMarkdown,
  onChange,
}: {
  noteId: string;
  initialMarkdown: string;
  onChange: (md: string) => void;
}) {
  const theme = useTheme();
  const dark = theme.bg === '#12100e';
  const webRef = useRef<WebView>(null);
  const [uri, setUri] = useState<string | null>(null);
  const lastNote = useRef(noteId);

  // Contenido inicial (solo la primera carga; los cambios de nota van por setContent).
  const initialInject = useMemo(
    () => `window.__MD__=${JSON.stringify(initialMarkdown)};window.__DARK__=${dark ? 'true' : 'false'};true;`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    let alive = true;
    const asset = Asset.fromModule(require('../../assets/webeditor.html'));
    asset.downloadAsync().then(() => {
      if (alive) setUri(asset.localUri ?? asset.uri);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Al saltar de nota, empuja el nuevo contenido al editor.
  useEffect(() => {
    if (!uri || lastNote.current === noteId) return;
    lastNote.current = noteId;
    webRef.current?.injectJavaScript(
      `window.MDNOTES&&window.MDNOTES.setContent(${JSON.stringify(initialMarkdown)});true;`
    );
  }, [noteId, uri, initialMarkdown]);

  useEffect(() => {
    webRef.current?.injectJavaScript(
      `window.MDNOTES&&window.MDNOTES.setTheme(${JSON.stringify(dark ? 'dark' : 'light')});true;`
    );
  }, [dark]);

  if (!uri) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <WebView
      ref={webRef}
      source={{ uri }}
      originWhitelist={['*']}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      injectedJavaScriptBeforeContentLoaded={initialInject}
      keyboardDisplayRequiresUserAction={false}
      hideKeyboardAccessoryView
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === 'change') onChange(msg.md);
        } catch {
          // mensaje no-JSON: ignorar
        }
      }}
      style={{ flex: 1, backgroundColor: theme.bg }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
