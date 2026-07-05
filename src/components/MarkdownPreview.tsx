import { useColorScheme, StyleSheet, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useMemo } from 'react';
import { mdToHtml } from '@/lib/markdown';

// Preview del Markdown renderizado en WebView (markdown-it + KaTeX + callouts).
// Es read-only; el WebView da fidelidad tipo Typora (mates, tablas, alertas).
export function MarkdownPreview({ content, background }: { content: string; background: string }) {
  const scheme = useColorScheme();
  const html = useMemo(() => mdToHtml(content, scheme === 'dark' ? 'dark' : 'light'), [content, scheme]);

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
      // Evita el flash blanco antes de pintar (respeta la paleta de marca).
      overScrollMode="never"
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1 },
});
