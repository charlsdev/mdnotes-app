import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { useTheme } from '@/theme';

// Visor de PDF (pdf.js) embebido en un WebView. El HTML autónomo vive en
// assets/pdfviewer.html (generado por pdfviewer/build.mjs). Puente:
//   RN → WV: window.__PDF_URL__ / __DARK__ inicial + window.MDPDF.setTheme
//   WV → RN: postMessage({ type: 'loaded' | 'progress' | 'error' })
//
// `fileUri` DEBE ser un file:// (copia local): el WebView no puede leer el
// content:// de la carpeta, y pdf.js lo busca por XHR desde el propio documento.
export function PdfViewer({
  fileUri,
  onProgress,
  onError,
}: {
  fileUri: string;
  onProgress?: (page: number, pages: number) => void;
  onError?: (message: string) => void;
}) {
  const theme = useTheme();
  const dark = theme.bg === '#12100e';
  const webRef = useRef<WebView>(null);
  const [uri, setUri] = useState<string | null>(null);

  const inject = useMemo(
    () => `window.__PDF_URL__=${JSON.stringify(fileUri)};window.__DARK__=${dark ? 'true' : 'false'};true;`,
    [fileUri, dark]
  );

  useEffect(() => {
    let alive = true;
    const asset = Asset.fromModule(require('../../assets/pdfviewer.html'));
    asset.downloadAsync().then(() => {
      if (alive) setUri(asset.localUri ?? asset.uri);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    webRef.current?.injectJavaScript(
      `window.MDPDF&&window.MDPDF.setTheme(${JSON.stringify(dark ? 'dark' : 'light')});true;`
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
      // Necesarios para que pdf.js lea la copia local por XHR desde un documento file://.
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      injectedJavaScriptBeforeContentLoaded={inject}
      // El zoom es el pinch del WebView (ver el meta viewport del visor), sin los
      // botones +/- de Android encima del documento.
      setBuiltInZoomControls
      setDisplayZoomControls={false}
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === 'progress') onProgress?.(msg.page, msg.pages);
          else if (msg.type === 'loaded') onProgress?.(0, msg.pages);
          else if (msg.type === 'error') onError?.(msg.message);
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
