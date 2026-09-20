// Corre las aserciones de `render-cases.ts` contra los módulos REALES (markdown,
// wikilinks, paths).
//
// Por qué existe: son las partes que se rompen en silencio. Un `[[` dentro de un
// bloque de código convertido en enlace, o una ruta relativa mal calculada para un
// adjunto, no se notan hasta que mirás el preview en el teléfono. `tsc` no ve nada
// de eso.
//
//   node scripts/check-render.mjs
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

const outFile = path.join(root, 'node_modules/.cache/mdnotes/render-cases.cjs');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(here, 'render-cases.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: outFile,
  alias: { '@': path.join(root, 'src') },
  logLevel: 'error',
});

// El módulo corre las aserciones e invoca process.exit con el código que toca.
require_(outFile);
