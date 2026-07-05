// Regenera src/lib/katex-css.ts: el katex.min.css con las fuentes woff2 embebidas
// en base64, para que KaTeX funcione OFFLINE dentro del WebView del preview.
// Correr tras actualizar `katex`:  node scripts/gen-katex-css.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'node_modules/katex/dist');
let css = fs.readFileSync(path.join(dist, 'katex.min.css'), 'utf8');

// Deja solo woff2 (WebView moderno lo soporta) y quita fallbacks woff/ttf.
css = css.replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\)/g, '');
css = css.replace(/,url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, '');

// Inline woff2 como data URI base64.
css = css.replace(/url\(fonts\/([^)]+\.woff2)\)/g, (_m, file) => {
  const b64 = fs.readFileSync(path.join(dist, 'fonts', file)).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});

const out = `// AUTO-GENERADO por scripts/gen-katex-css.mjs — no editar a mano.
// katex.min.css con las fuentes woff2 embebidas en base64 (KaTeX offline en WebView).
export const KATEX_CSS = ${JSON.stringify(css)};
`;
fs.writeFileSync(path.join(root, 'src/lib/katex-css.ts'), out);
console.log('katex-css.ts:', (out.length / 1024).toFixed(0), 'KB');
