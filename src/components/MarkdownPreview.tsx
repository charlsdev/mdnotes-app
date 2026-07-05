import { StyleSheet, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useMemo } from 'react';
import { mdToHtml } from '@/lib/markdown';
import { useEffectiveScheme } from '@/theme';
import { useSettings, READING_FONTS } from '@/storage/settings';

// Preview del Markdown renderizado en WebView (markdown-it + KaTeX + callouts).
// Es read-only; el WebView da fidelidad tipo Typora (mates, tablas, alertas).
export function MarkdownPreview({ content, background }: { content: string; background: string }) {
  const scheme = useEffectiveScheme();
  const scale = useSettings((s) => s.readingScale);
  const fontKey = useSettings((s) => s.readingFont);
  const fontStack = READING_FONTS.find((f) => f.value === fontKey)?.stack;

  const html = useMemo(
    () => mdToHtml(content, scheme, { scale, fontStack }),
    [content, scheme, scale, fontStack]
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
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1 },
});
