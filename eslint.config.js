// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // initials/ es solo referencia; webeditor/ y pdfviewer/ son proyectos aparte
    // con su propio build; katex-css.ts es generado.
    ignores: ['initials/*', 'webeditor/*', 'pdfviewer/*', 'android/*', 'dist/*', 'src/lib/katex-css.ts'],
  },
]);
