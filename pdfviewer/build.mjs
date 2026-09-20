// Bundlea el visor de PDF (pdf.js) a un HTML autónomo en ../assets/pdfviewer.html,
// que el WebView del app carga como archivo (offline, sin red).
//
// Mismo patrón que webeditor/: proyecto aparte con su propio node_modules, salida
// como asset .html (no como string, para no inflar el bundle JS de la app).
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');

const result = await esbuild.build({
  entryPoints: [path.join(here, 'src/main.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  write: false,
  outdir: path.join(here, 'dist'),
  loader: { '.css': 'css' },
  // pdf.js tiene un `import()` dinámico para cargar el worker que NUNCA se ejecuta
  // (ver main.ts: le damos el worker por `globalThis.pdfjsWorker`). Sin esto,
  // esbuild avisa de que no puede resolverlo estáticamente.
  logOverride: { 'unsupported-dynamic-import': 'silent' },
  logLevel: 'info',
});

let js = '';
let css = '';
for (const out of result.outputFiles) {
  if (out.path.endsWith('.css')) css += out.text;
  else js += out.text;
}

// `user-scalable=yes`: el zoom del PDF es el pinch nativo del WebView. Renderizar
// a más escala desde pdf.js sería más nítido pero mucho más lento y pesado.
const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
<style>${css}</style>
</head>
<body>
<div id="pages"></div>
<div id="status">Abriendo…</div>
<script>${js}</script>
</body>
</html>`;

const outPath = path.join(appRoot, 'assets/pdfviewer.html');
fs.writeFileSync(outPath, html);
console.log('assets/pdfviewer.html:', (html.length / 1024).toFixed(0), 'KB (js', (js.length / 1024).toFixed(0), 'KB)');
