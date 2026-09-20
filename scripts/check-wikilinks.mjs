// Corre las aserciones de `wikilinks-cases.ts` contra el módulo REAL de markdown.
//
// Por qué existe: la regla inline de wikilinks es la parte del render más fácil de
// romper en silencio (un `[[` dentro de un bloque de código convertido en enlace no
// se nota hasta que lo ves en el teléfono). `tsc` no prueba nada de eso.
//
//   node scripts/check-wikilinks.mjs
//
// Usa el esbuild de webeditor/ (la app no lo tiene en la raíz) solo para bundlear
// el TS a algo que Node pueda ejecutar.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const esbuildEntry = path.join(root, 'webeditor/node_modules/esbuild/lib/main.js');

if (!fs.existsSync(esbuildEntry)) {
  console.error('Falta esbuild. Corre: cd webeditor && npm install   (ver COMPILACION.md)');
  process.exit(1);
}

const require_ = createRequire(import.meta.url);
const esbuild = require_(esbuildEntry);

const outFile = path.join(root, 'node_modules/.cache/mdnotes/wikilinks-cases.cjs');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(here, 'wikilinks-cases.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: outFile,
  alias: { '@': path.join(root, 'src') },
  logLevel: 'error',
});

// El módulo corre las aserciones e invoca process.exit con el código que toca.
require_(outFile);
