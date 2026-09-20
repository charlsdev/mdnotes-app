// Aserciones contra los módulos REALES (no copias): render de markdown, enlaces
// internos y rutas de adjuntos.
import { mdToHtml, unescapeMarkers } from '@/lib/markdown';
import { buildLinkIndex, resolveWikilink, backlinksFor, shortestLinkLabel } from '@/lib/wikilinks';
import { relativeTo, resolveRel, encodeRef, attachmentFolderFromConfig } from '@/lib/paths';
import type { MdFile } from '@/types';

const note = (id: string, name: string, folder = '', content = ''): MdFile => ({
  id,
  name,
  content,
  createdAt: 0,
  updatedAt: 0,
  folder,
});

const files: MdFile[] = [
  note('n1', 'Ideas', '', 'Apunta a [[Reunión semanal]] y a [[Proyectos/Ideas]].'),
  note('n2', 'Reunión semanal', 'Diario'),
  note('n3', 'Ideas', 'Proyectos'),
  note('n4', 'Sin enlaces', '', 'Texto plano.'),
];

const index = buildLinkIndex(files);
const resolveLink = (t: string) => resolveWikilink(t, '', index);

let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FALLA'}  ${label}${ok || !detail ? '' : `\n        ${detail}`}`);
}

// Sin el <script> del puente: contiene la cadena 'data-note' y ensuciaría los asserts.
const render = (md: string) =>
  (mdToHtml(md, 'light', { resolveLink }).split('<body>')[1] ?? '').replace(/<script>[\s\S]*?<\/script>/g, '');

// 1. Resolución básica y alias
const h1 = render('Ver [[Ideas]] y [[Reunión semanal|la reu]].');
check('[[Ideas]] resuelve a la nota de la raíz', h1.includes('data-note="n1"'), h1);
check('alias se usa como etiqueta', h1.includes('>la reu</a>'), h1);

// 2. Ruta y ancla
const h2 = render('[[Proyectos/Ideas]] y [[Reunión semanal#Acuerdos]]');
check('ruta completa resuelve a la nota anidada', h2.includes('data-note="n3"'), h2);
check('el #ancla no rompe la resolución', h2.includes('data-note="n2"'), h2);

// 3. Enlace roto
const h3 = render('[[No existe esta nota]]');
check('enlace roto → span, no <a>', h3.includes('wikilink-broken') && !h3.includes('<a'), h3);

// 4. EL CASO CRÍTICO: nada de esto debe convertirse en enlace
const code = ['```python', 'arr[[0]] = x', 'ref = doc[[1]]', '```', '', 'Inline: `[[no soy enlace]]`'].join('\n');
const h4 = render(code);
// hljs envuelve el `0` en un span, así que se verifica por partes + ausencia de enlaces.
check('bloque de código intacto', h4.includes('arr[[') && h4.includes(']] = x') && !h4.includes('wikilink'), h4.slice(0, 300));
check('código inline intacto', h4.includes('<code>[[no soy enlace]]</code>'), h4.slice(-200));

// 5. Embeds de imagen
const h5 = render('![[foto.png]] y ![[data:image/png;base64,AAAABBBB]]');
check('![[foto.png]] → <img>', h5.includes('<img src="foto.png"'), h5);
check('embed ya resuelto a data URI → <img>', h5.includes('src="data:image/png;base64,AAAABBBB"'), h5);

// 6. Embed de nota (no imagen) → enlace
const h6 = render('![[Ideas]]');
check('![[nota]] (no imagen) → enlace a la nota', h6.includes('data-note="n1"'), h6);

// 7. Corchetes sueltos / mal cerrados no explotan
const h7 = render('Un [[ suelto, y [[esto no cierra');
check('wikilink sin cerrar se deja como texto', !h7.includes('wikilink'), h7);

// 8. Des-escape de lo que produce Crepe
check('unescapeMarkers arregla \\[\\[nota]]', unescapeMarkers('\\[\\[Ideas]]') === '[[Ideas]]', unescapeMarkers('\\[\\[Ideas]]'));
check('unescapeMarkers sigue arreglando \\[!NOTE]', unescapeMarkers('> \\[!NOTE]') === '> [!NOTE]');
const h8 = render('\\[\\[Ideas]]');
check('un enlace escapado por Crepe igual renderiza', h8.includes('data-note="n1"'), h8);

// 9. Backlinks
const bl = backlinksFor('n2', files, index);
check('backlinks encuentra quién menciona la nota', bl.length === 1 && bl[0].id === 'n1', JSON.stringify(bl.map((b) => b.id)));
const blSelf = backlinksFor('n4', files, index);
check('nota sin menciones → sin backlinks', blSelf.length === 0);
const h9 = mdToHtml('hola', 'light', { resolveLink, backlinks: [{ id: 'n1', name: 'Ideas' }] });
check('sección "Mencionada en" se inyecta', h9.includes('Mencionada en') && h9.includes('data-note="n1"'));
const h9pdf = mdToHtml('hola', 'pdf', { resolveLink, backlinks: [{ id: 'n1', name: 'Ideas' }] });
check('el PDF NO lleva backlinks ni el script del puente', !h9pdf.includes('Mencionada en') && !h9pdf.includes('ReactNativeWebView'));

// 10. Etiqueta más corta para autocompletar (nombre ambiguo → ruta)
check('nombre único → se enlaza por nombre', shortestLinkLabel(files[1], index) === 'Reunión semanal');
check('nombre ambiguo → se enlaza por ruta', shortestLinkLabel(files[2], index) === 'Proyectos/Ideas');

// 11. Que no se haya roto lo de antes
const h11 = render('> [!TIP]\n> Ojo\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n$x^2$\n\n==marcado==');
check('alertas, tablas, mates y ==marcado== siguen funcionando',
  h11.includes('gh-alert-tip') && h11.includes('<table>') && h11.includes('katex') && h11.includes('<mark>'),
  h11.slice(0, 200));

// --- Adjuntos: dónde va la imagen y cómo se la enlaza desde la nota ---

// 12. Ruta del adjunto vista desde la nota
check('nota en la raíz → ruta directa', relativeTo('', 'adjuntos/x.jpg') === 'adjuntos/x.jpg');
check('nota en subcarpeta → sube con ..', relativeTo('README', 'adjuntos/x.jpg') === '../adjuntos/x.jpg',
  relativeTo('README', 'adjuntos/x.jpg'));
check('nota anidada dos niveles → ../../', relativeTo('a/b', 'adjuntos/x.jpg') === '../../adjuntos/x.jpg',
  relativeTo('a/b', 'adjuntos/x.jpg'));
check('adjunto junto a la nota → sin ..', relativeTo('README', 'README/x.jpg') === 'x.jpg',
  relativeTo('README', 'README/x.jpg'));
check('adjunto en subcarpeta de la nota', relativeTo('README', 'README/img/x.jpg') === 'img/x.jpg',
  relativeTo('README', 'README/img/x.jpg'));
check('adjunto en la raíz desde nota anidada', relativeTo('a/b', 'x.jpg') === '../../x.jpg',
  relativeTo('a/b', 'x.jpg'));

// 13. Ida y vuelta: lo que se escribe en la nota tiene que volver a la misma ruta
for (const [noteFolder, target] of [
  ['', 'adjuntos/x.jpg'],
  ['README', 'adjuntos/x.jpg'],
  ['a/b', 'adjuntos/x.jpg'],
  ['README', 'README/x.jpg'],
] as const) {
  const written = relativeTo(noteFolder, target);
  check(`round-trip '${noteFolder || "(raíz)"}' → ${written}`, resolveRel(noteFolder, written) === target,
    `${resolveRel(noteFolder, written)} ≠ ${target}`);
}

// 14. Escape mínimo en la ruta
check('los espacios se escapan', encodeRef('mis adjuntos/foto (1).jpg') === 'mis%20adjuntos/foto%20%281%29.jpg',
  encodeRef('mis adjuntos/foto (1).jpg'));
check('los acentos se dejan legibles', encodeRef('imágenes/ñandú.jpg') === 'imágenes/ñandú.jpg');

// 15. attachmentFolderPath de Obsidian
check("sin config → carpeta propia", attachmentFolderFromConfig(null, 'README') === 'adjuntos');
check("'/' → raíz del vault", attachmentFolderFromConfig('/', 'README') === '');
check("'assets' → desde la raíz", attachmentFolderFromConfig('assets', 'README') === 'assets');
check("'/assets' → desde la raíz", attachmentFolderFromConfig('/assets', 'README') === 'assets');
check("'./' → junto a la nota", attachmentFolderFromConfig('./', 'README') === 'README');
check("'./img' → subcarpeta de la nota", attachmentFolderFromConfig('./img', 'README') === 'README/img',
  attachmentFolderFromConfig('./img', 'README'));
check("'./img' con nota en la raíz", attachmentFolderFromConfig('./img', '') === 'img');

// 16. El enlace generado tiene que renderizar como imagen (no como enlace roto)
const written = encodeRef(relativeTo('README', 'adjuntos/imagen-20260919-214300.jpg'));
const h16 = render(`![imagen](${written})`);
check('el markdown generado produce un <img>', h16.includes('<img') && h16.includes(written), h16);

console.log(failed === 0 ? '\nTODO OK' : `\n${failed} FALLAS`);
process.exit(failed === 0 ? 0 : 1);
