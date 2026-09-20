// Aserciones contra los módulos REALES (no copias): render de markdown, enlaces
// internos y rutas de adjuntos.
import { mdToHtml, unescapeMarkers } from '@/lib/markdown';
import { buildLinkIndex, resolveWikilink, backlinksFor, shortestLinkLabel } from '@/lib/wikilinks';
import {
  relativeTo,
  resolveRel,
  encodeRef,
  attachmentFolderFromConfig,
  inferAttachmentFolder,
  createImageResolver,
  attachmentFolderFromSetting,
  sanitizeFolderPath,
} from '@/lib/paths';
import { buildTreeRows } from '@/lib/tree';
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
check('sin config → null (decide quien llama)', attachmentFolderFromConfig(null, 'README') === null);
check("'/' → raíz del vault", attachmentFolderFromConfig('/', 'README') === '');
check("'assets' → desde la raíz", attachmentFolderFromConfig('assets', 'README') === 'assets');
check("'/assets' → desde la raíz", attachmentFolderFromConfig('/assets', 'README') === 'assets');
check("'./' → junto a la nota", attachmentFolderFromConfig('./', 'README') === 'README');
check("'./img' → subcarpeta de la nota", attachmentFolderFromConfig('./img', 'README') === 'README/img',
  String(attachmentFolderFromConfig('./img', 'README')));
check("'./img' con nota en la raíz", attachmentFolderFromConfig('./img', '') === 'img');

// --- Notas que YA existen: sus referencias no se pueden romper ---

// 16. Un vault real: nota en README/ que apunta a .\img\imagen.png (barras de Windows)
const vaultImages = {
  'README/img/imagen.png': 'content://saf/README%2Fimg%2Fimagen.png',
  'README/img/otra foto.png': 'content://saf/README%2Fimg%2Fotra%20foto.png',
  'adjuntos/nueva.jpg': 'content://saf/adjuntos%2Fnueva.jpg',
};
const find = createImageResolver(vaultImages);
const IMG = vaultImages['README/img/imagen.png'];

check('.\\img\\imagen.png (barras de Windows)', find('.\\img\\imagen.png', 'README') === IMG, String(find('.\\img\\imagen.png', 'README')));
check('./img/imagen.png', find('./img/imagen.png', 'README') === IMG);
check('img/imagen.png (sin ./)', find('img/imagen.png', 'README') === IMG);
check('README/img/imagen.png (desde la raíz)', find('README/img/imagen.png', '') === IMG);
check('../README/img/imagen.png (subiendo)', find('../README/img/imagen.png', 'Otra') === IMG);
check('imagen.png suelta → por nombre de archivo', find('imagen.png', 'Otra') === IMG);
check('espacios escapados con %20', find('./img/otra%20foto.png', 'README') === vaultImages['README/img/otra foto.png']);
check('ruta nueva estilo adjuntos', find('../adjuntos/nueva.jpg', 'README') === vaultImages['adjuntos/nueva.jpg']);
check('las URLs remotas se dejan quietas', find('https://ejemplo.com/x.png', 'README') === null);
check('los data URI se dejan quietos', find('data:image/png;base64,AAA', 'README') === null);
check('una imagen que no existe → null', find('./img/no-existe.png', 'README') === null);

// 17. La convención del vault manda: con notas que usan img/, la foto nueva va ahí
const existing = Object.keys(vaultImages).filter((p) => p.startsWith('README/img/'));
check('vault con img/ junto a la nota → la foto nueva cae en README/img',
  inferAttachmentFolder(existing, 'README') === 'README/img', String(inferAttachmentFolder(existing, 'README')));
check('misma convención para una nota de otra carpeta → Otra/img',
  inferAttachmentFolder(existing, 'Otra') === 'Otra/img', String(inferAttachmentFolder(existing, 'Otra')));
check('vault con img/ en la RAÍZ → carpeta central',
  inferAttachmentFolder(['img/a.png', 'img/b.png'], 'README') === 'img',
  String(inferAttachmentFolder(['img/a.png', 'img/b.png'], 'README')));
check('gana la carpeta más usada',
  inferAttachmentFolder(['img/a.png', 'img/b.png', 'img/c.png', 'assets/x.png'], '') === 'img');
check('vault sin imágenes → null (se usa el default)', inferAttachmentFolder([], 'README') === null);
check('imágenes sueltas en la raíz no son una convención', inferAttachmentFolder(['a.png', 'b.png'], 'README') === null);

// 18. El ajuste de la app (gana sobre Obsidian y sobre la deducción)
check('modo automático → null (deciden config/deducción)',
  attachmentFolderFromSetting('auto', 'img', 'README') === null);
check("'junto a la nota' con nombre → README/fotos",
  attachmentFolderFromSetting('note', 'fotos', 'README') === 'README/fotos',
  String(attachmentFolderFromSetting('note', 'fotos', 'README')));
check("'junto a la nota' sin nombre → la carpeta de la nota",
  attachmentFolderFromSetting('note', '', 'README') === 'README');
check("'junto a la nota' con nota en la raíz", attachmentFolderFromSetting('note', 'img', '') === 'img');
check("'carpeta fija' → ruta desde la raíz",
  attachmentFolderFromSetting('vault', 'assets/img', 'README') === 'assets/img');
check("'carpeta fija' vacía → raíz del vault",
  attachmentFolderFromSetting('vault', '', 'README') === '');
check('se limpia lo que escribe el usuario (barras y espacios)',
  attachmentFolderFromSetting('vault', ' \\mis fotos\\ ', '') === 'mis fotos',
  String(attachmentFolderFromSetting('vault', ' \\mis fotos\\ ', '')));
check('`..` no puede sacar el adjunto del vault',
  attachmentFolderFromSetting('vault', '../../etc', '') === 'etc',
  String(attachmentFolderFromSetting('vault', '../../etc', '')));
check('sanitizeFolderPath deja una ruta normal intacta', sanitizeFolderPath('assets/img') === 'assets/img');

// 19. Lo que escribimos para la foto nueva resuelve a donde la guardamos
const newFolder = inferAttachmentFolder(existing, 'README')!; // 'README/img'
const newPath = `${newFolder}/imagen-20260919-214300.jpg`;
const link = encodeRef(relativeTo('README', newPath));
// Misma forma que ya usan las notas del usuario: `img/…` desde la carpeta de la nota.
check('la foto nueva se enlaza con la convención del vault', link === 'img/imagen-20260919-214300.jpg', link);
check('y ese enlace resuelve al archivo guardado',
  createImageResolver({ [newPath]: 'uri-nueva' })(link, 'README') === 'uri-nueva');

// 19. El enlace generado tiene que renderizar como imagen (no como enlace roto)
const written = encodeRef(relativeTo('README', 'adjuntos/imagen-20260919-214300.jpg'));
const h16 = render(`![imagen](${written})`);
check('el markdown generado produce un <img>', h16.includes('<img') && h16.includes(written), h16);

// --- Árbol con varias carpetas abiertas ---

const vNote = (id: string, name: string, vaultId: string, folder = ''): MdFile => ({
  id, name, content: '', createdAt: 0, updatedAt: 0, folder, vaultId,
});

const multi = [
  vNote('a1', 'Nota A', 'v1'),
  vNote('a2', 'Sub A', 'v1', 'README'),
  vNote('b1', 'Nota B', 'v2'),
  vNote('b2', 'Sub B', 'v2', 'README'),
  { id: 'i1', name: 'Interna', content: '', createdAt: 0, updatedAt: 0 } as MdFile,
];
const groups = [
  { id: 'v1', name: 'Trabajo' },
  { id: 'v2', name: 'Personal' },
  { id: '', name: 'En el dispositivo' },
];

// 20. Una sola carpeta: el árbol no cambia (sin filas de vault)
const single = buildTreeRows(multi.filter((n) => n.vaultId === 'v1'), new Set());
check('con una sola carpeta no aparecen raíces de vault', !single.some((r) => r.kind === 'vault'),
  JSON.stringify(single.map((r) => r.kind)));

// 21. Varias carpetas: una raíz por carpeta, con sus notas debajo
const rows = buildTreeRows(multi, new Set(), groups);
const vaultRows = rows.filter((r) => r.kind === 'vault');
check('una raíz por carpeta (incluidas las internas)', vaultRows.length === 3,
  JSON.stringify(vaultRows.map((r) => r.name)));
check('las raíces salen en el orden dado', vaultRows.map((r) => r.name).join(',') === 'Trabajo,Personal,En el dispositivo');
check('cada raíz cuenta solo sus notas', vaultRows.every((r) => r.kind === 'vault' && r.count === (r.name === 'En el dispositivo' ? 1 : 2)),
  JSON.stringify(vaultRows.map((r) => r.kind === 'vault' && r.count)));
check('las notas quedan indentadas bajo su carpeta',
  rows.filter((r) => r.kind === 'file').every((r) => r.depth >= 1));

// 22. Colapsar una carpeta NO afecta a la otra (el bug clásico: mismo nombre de
// subcarpeta en dos vaults compartiendo estado de colapso)
const collapsedV1 = buildTreeRows(multi, new Set(['vault:v1']), groups);
check('colapsar una carpeta oculta solo sus notas',
  !collapsedV1.some((r) => r.kind === 'file' && r.note.vaultId === 'v1') &&
    collapsedV1.some((r) => r.kind === 'file' && r.note.vaultId === 'v2'),
  JSON.stringify(collapsedV1.filter((r) => r.kind === 'file').map((r) => r.kind === 'file' && r.note.id)));

const folderRows = rows.filter((r) => r.kind === 'folder');
check('dos carpetas con un README cada una son filas distintas',
  folderRows.length === 2 && folderRows[0].kind === 'folder' && folderRows[1].kind === 'folder' &&
    folderRows[0].path !== folderRows[1].path,
  JSON.stringify(folderRows.map((r) => r.kind === 'folder' && r.path)));

const collapsedReadmeV1 = buildTreeRows(multi, new Set([folderRows[0].kind === 'folder' ? folderRows[0].path : '']), groups);
check('colapsar el README de una carpeta no colapsa el de la otra',
  collapsedReadmeV1.filter((r) => r.kind === 'file' && r.note.folder === 'README').length === 1,
  JSON.stringify(collapsedReadmeV1.filter((r) => r.kind === 'file').map((r) => r.kind === 'file' && r.note.id)));

// 23. Una carpeta sin notas (o filtrada) no deja una raíz vacía
const onlyV2 = buildTreeRows(multi.filter((n) => n.vaultId === 'v2'), new Set(), groups);
check('no se muestran raíces de carpetas sin notas',
  onlyV2.filter((r) => r.kind === 'vault').length === 1,
  JSON.stringify(onlyV2.filter((r) => r.kind === 'vault').map((r) => r.name)));

// 24. Los [[enlaces]] no cruzan carpetas
const linked = [
  vNote('a1', 'Compartida', 'v1'),
  vNote('b1', 'Compartida', 'v2'),
  vNote('b2', 'Desde B', 'v2'),
];
const idxV2 = buildLinkIndex(linked.filter((n) => n.vaultId === 'v2'));
check('un [[enlace]] resuelve dentro de SU carpeta',
  resolveWikilink('Compartida', '', idxV2) === 'b1', String(resolveWikilink('Compartida', '', idxV2)));
const idxV1 = buildLinkIndex(linked.filter((n) => n.vaultId === 'v1'));
check('y en la otra carpeta resuelve a la suya',
  resolveWikilink('Compartida', '', idxV1) === 'a1', String(resolveWikilink('Compartida', '', idxV1)));
check('una nota que solo existe en otra carpeta queda como enlace roto',
  resolveWikilink('Desde B', '', idxV1) === null);

console.log(failed === 0 ? '\nTODO OK' : `\n${failed} FALLAS`);
process.exit(failed === 0 ? 0 : 1);
