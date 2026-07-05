// Bundlea el editor Crepe a un HTML autónomo y lo escribe como string en
// ../src/lib/webeditor-html.ts (embebido en el WebView del app, sin red).
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
  loader: { '.css': 'css', '.ttf': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl', '.svg': 'dataurl' },
  logLevel: 'info',
});

let js = '';
let css = '';
for (const out of result.outputFiles) {
  if (out.path.endsWith('.css')) css += out.text;
  else js += out.text;
}

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>${js}</script>
</body>
</html>`;

// Se escribe como ASSET .html (lo carga el WebView por archivo, NO pesa en el
// bundle JS). Ver metro.config.js (assetExts incluye 'html').
const outPath = path.join(appRoot, 'assets/webeditor.html');
fs.writeFileSync(outPath, html);
console.log('assets/webeditor.html:', (html.length / 1024).toFixed(0), 'KB (js', (js.length / 1024).toFixed(0), 'KB, css', (css.length / 1024).toFixed(0), 'KB)');
