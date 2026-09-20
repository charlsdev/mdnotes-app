import { StyleSheet, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useMemo } from 'react';
import { mdToHtml } from '@/lib/markdown';
import { useEffectiveScheme } from '@/theme';
import { useSettings, READING_FONTS } from '@/storage/settings';

// Preview del Markdown renderizado en WebView (markdown-it + KaTeX + callouts).
// Es read-only; el WebView da fidelidad tipo Typora (mates, tablas, alertas).
export function MarkdownPreview({
  content,
  background,
  resolveLink,
  backlinks,
  onOpenNote,
}: {
  content: string;
  background: string;
  // Resolución de los enlaces internos [[nota]] → id de nota (null si no existe).
  resolveLink?: (target: string) => string | null;
  backlinks?: Array<{ id: string; name: string }>;
  onOpenNote?: (id: string) => void;
}) {
  const scheme = useEffectiveScheme();
  const scale = useSettings((s) => s.readingScale);
  const fontKey = useSettings((s) => s.readingFont);
  const fontStack = READING_FONTS.find((f) => f.value === fontKey)?.stack;

  const html = useMemo(
    () => mdToHtml(content, scheme, { scale, fontStack, resolveLink, backlinks }),
    [content, scheme, scale, fontStack, resolveLink, backlinks]
  );

  return (
    <WebView
      style={[styles.web, { backgroundColor: background }]}
      originWhitelist={['*']}
      source={{ html }}
      // El documento se carga dentro; los enlaces http(s) se abren fuera del WebView.
      onShouldStartLoadWithRequest={(req) => {
        if (/^https?:/.test(req.url)) {
          Linking.openURL(req.url);
          return false;
        }
        return true;
      }}
      // Tap en un [[enlace interno]]: el documento no navega, abre la nota en RN.
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === 'open-note' && msg.id) onOpenNote?.(msg.id);
        } catch {
          // mensaje no-JSON: ignorar
        }
      }}
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1 },
});
