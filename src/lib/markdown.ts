import MarkdownIt from 'markdown-it';
// @ts-expect-error sin tipos
import markPlugin from 'markdown-it-mark';
// @ts-expect-error sin tipos
import footnotePlugin from 'markdown-it-footnote';
// @ts-expect-error sin tipos
import taskListsPlugin from 'markdown-it-task-lists';
import * as katexMod from '@vscode/markdown-it-katex';
import hljs from 'highlight.js/lib/common';
import { KATEX_CSS } from './katex-css';
import { stripFrontmatter } from './frontmatter';

const katexPlugin: any = (katexMod as any).default ?? katexMod;

// Alertas estilo GitHub: label (ES) + ícono octicon (SVG). Colores en pageCss.
const ALERTS: Record<string, { label: string; icon: string }> = {
  NOTE: {
    label: 'Nota',
    icon: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
  TIP: {
    label: 'Consejo',
    icon: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.32-.207.245-.383.454-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
  },
  IMPORTANT: {
    label: 'Importante',
    icon: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  },
  WARNING: {
    label: 'Advertencia',
    icon: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  },
  CAUTION: {
    label: 'Precaución',
    icon: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
};
// Tolerante: espacios iniciales y mayúsc/minúsc (`>  [!warning]` también cuenta).
const ALERT_RE = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;
const ALERT_STRIP = /^\s*\[![a-z]+\]\s*\n?/i;

function githubAlerts(md: MarkdownIt) {
  md.core.ruler.after('block', 'github_alerts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'blockquote_open') continue;
      const inline = tokens[i + 2];
      if (!inline || inline.type !== 'inline') continue;
      const m = inline.content.match(ALERT_RE);
      if (!m) continue;
      const type = m[1].toUpperCase();
      tokens[i].attrJoin('class', `gh-alert gh-alert-${type.toLowerCase()}`);
      tokens[i].meta = { ...(tokens[i].meta || {}), alert: type };
      inline.content = inline.content.replace(ALERT_STRIP, '');
      const kids = inline.children;
      if (kids && kids[0] && kids[0].type === 'text' && ALERT_RE.test(kids[0].content)) {
        kids[0].content = kids[0].content.replace(/^\s*\[![a-z]+\]\s*/i, '');
        if (kids[0].content === '' && kids[1] && (kids[1].type === 'softbreak' || kids[1].type === 'hardbreak')) {
          kids.splice(0, 2);
        } else if (kids[0].content === '') {
          kids.splice(0, 1);
        }
      }
    }
    return false;
  });

  const renderToken = (t: any, idx: number, opts: any, _env: any, self: any) => self.renderToken(t, idx, opts);
  const prevOpen = md.renderer.rules.blockquote_open || renderToken;
  md.renderer.rules.blockquote_open = function (tokens, idx, opts, env, self) {
    const html = prevOpen(tokens, idx, opts, env, self);
    const meta = (tokens[idx] as any).meta;
    if (meta && meta.alert) {
      const { label, icon } = ALERTS[meta.alert];
      const svg = `<svg class="gh-alert-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="${icon}"/></svg>`;
      return html + `<p class="gh-alert-title">${svg}${label}</p>`;
    }
    return html;
  };
}

// Enlaces internos `[[nota]]` / `[[nota|alias]]` y embeds `![[imagen.png]]`.
// Va como regla INLINE (no como reemplazo de texto) para que un `[[` dentro de un
// bloque de código se quede como está.
const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;

function wikilinks(md: MarkdownIt) {
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const src = state.src;
    let pos = state.pos;
    const embed = src.charCodeAt(pos) === 0x21; /* ! */
    if (embed) pos++;
    if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) return false; /* [[ */
    const close = src.indexOf(']]', pos + 2);
    if (close < 0) return false;
    const body = src.slice(pos + 2, close);
    if (!body || body.includes('[') || body.includes('\n')) return false;

    if (!silent) {
      const bar = body.indexOf('|');
      const alias = bar >= 0 ? body.slice(bar + 1).trim() : '';
      const target = (bar >= 0 ? body.slice(0, bar) : body).replace(/[#^].*$/, '').trim();
      const token = state.push(embed ? 'wikiembed' : 'wikilink', '', 0);
      token.meta = { target, alias, label: alias || (bar >= 0 ? body.slice(0, bar) : body).trim() };
    }
    state.pos = close + 2;
    return true;
  });

  const esc = md.utils.escapeHtml;

  // OJO: los enlaces internos son `<span>`, NO `<a href="#">`. El documento se carga
  // con `source={{html}}` (base URL `about:blank`): cualquier navegación, incluido un
  // `#`, reemplaza la página por una EN BLANCO. Sin href no hay nada que navegar; el
  // tap lo maneja el script del preview vía `data-note`.
  const noteLink = (id: string, label: string) =>
    `<span class="wikilink" role="link" data-note="${esc(id)}">${esc(label)}</span>`;

  md.renderer.rules.wikilink = (tokens, idx, _opts, env: any) => {
    const { target, label } = tokens[idx].meta;
    const id = env?.resolveLink?.(target);
    if (!id) {
      return `<span class="wikilink wikilink-broken" title="No encontré esa nota">${esc(label)}</span>`;
    }
    return noteLink(id, label);
  };

  md.renderer.rules.wikiembed = (tokens, idx, _opts, env: any) => {
    const { target, label } = tokens[idx].meta;
    // Las imágenes del vault ya vienen sustituidas por su data URI (inlineLocalImages).
    if (target.startsWith('data:') || IMG_EXT_RE.test(target)) {
      return `<img src="${esc(target)}" alt="${esc(label)}" />`;
    }
    const id = env?.resolveLink?.(target);
    if (!id) return `<span class="wikilink wikilink-broken" title="No encontré eso">${esc(label)}</span>`;
    return noteLink(id, label);
  };
}

// Enlaces Markdown normales a archivos de la carpeta: `[texto](OTRA.md)`,
// `[x](./docs/y.md)`. Son tan comunes como los [[wikilinks]] — y dejarlos como
// `<a href>` es peor que inútil: al tocarlos el WebView navega y el preview queda
// EN BLANCO. Se les quita el href (un `<a>` sin href es inerte) y se los marca con
// `data-note` para que el tap lo maneje React Native, igual que un wikilink.
// Los `#ancla` conservan su href: el script del documento los resuelve saltando.
const EXTERNAL_HREF_RE = /^[a-z][a-z0-9+.-]*:/i;

function localLinks(md: MarkdownIt) {
  const renderToken = (t: any, i: number, o: any, _e: any, self: any) => self.renderToken(t, i, o);
  const prevOpen = md.renderer.rules.link_open || renderToken;

  md.renderer.rules.link_open = function (tokens, idx, opts, env: any, self) {
    const token = tokens[idx];
    const href = token.attrGet('href') ?? '';
    if (href && !EXTERNAL_HREF_RE.test(href) && !href.startsWith('#')) {
      let target = href;
      try {
        target = decodeURIComponent(href);
      } catch {
        // href con % suelto: se usa tal cual
      }
      const id = env?.resolveLink?.(target.replace(/[#?].*$/, ''));
      token.attrs = (token.attrs ?? []).filter(([name]) => name !== 'href');
      if (id) {
        token.attrJoin('class', 'wikilink');
        token.attrSet('data-note', id);
      } else {
        token.attrJoin('class', 'wikilink wikilink-broken');
        token.attrSet('title', 'No encontré ese archivo');
      }
    }
    return prevOpen(tokens, idx, opts, env, self);
  };
}

const md = new MarkdownIt({
  html: true, // permite <img>, <u>, etc. (contenido propio del usuario)
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str, lang) {
    const code =
      lang && hljs.getLanguage(lang)
        ? hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(str).value;
    return `<pre class="code-block"><code class="hljs">${code}</code></pre>`;
  },
})
  .use(markPlugin)
  .use(footnotePlugin)
  .use(taskListsPlugin, { label: true })
  .use(katexPlugin)
  .use(githubAlerts)
  .use(wikilinks)
  .use(localLinks);

// Crepe (VIVO) escapa los corchetes al reserializar (`> \[!NOTE]`, `\[\[nota]]`),
// y eso rompe tanto las alertas como los enlaces internos. Los des-escapamos antes
// de renderizar (por si el archivo ya quedó así); el guardado desde VIVO también
// los limpia (ver editor).
export function unescapeMarkers(markdown: string): string {
  return markdown
    .replace(/\\(\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])/gi, '$1')
    .replace(/\\\[\\\[/g, '[[')
    .replace(/\\\]\\\]/g, ']]')
    .replace(/\\\[\[/g, '[[')
    .replace(/\]\\\]/g, ']]');
}

export function mdToBody(markdown: string, env: RenderEnv = {}): string {
  return md.render(stripFrontmatter(unescapeMarkers(markdown)), env);
}

// Contexto que necesitan las reglas de render (hoy: resolver enlaces internos).
export interface RenderEnv {
  resolveLink?: (target: string) => string | null;
}

interface Palette {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  sepia: string;
  line: string;
  codeBg: string;
  codeBlockBg: string;
  codeBlockText: string;
}

const LIGHT: Palette = {
  bg: '#f5f1ea', ink: '#1a1714', muted: '#8a8275', accent: '#c14a2b', sepia: '#8a7355',
  line: '#d8d2c5', codeBg: '#ece7dd', codeBlockBg: '#1a1714', codeBlockText: '#f5f1ea',
};
const DARK: Palette = {
  bg: '#12100e', ink: '#f5f1ea', muted: '#8a8275', accent: '#c14a2b', sepia: '#8a7355',
  line: '#2a2620', codeBg: '#201d19', codeBlockBg: '#0a0908', codeBlockText: '#f5f1ea',
};

// Colores de alerta estilo GitHub (excepción al monocromático de marca, a pedido).
function alertColors(isDark: boolean) {
  return isDark
    ? { note: '#4493f8', tip: '#3fb950', important: '#ab7df8', warning: '#d29922', caution: '#f85149' }
    : { note: '#0969da', tip: '#1a7f37', important: '#8250df', warning: '#9a6700', caution: '#d1242f' };
}

function pageCss(
  p: Palette,
  isDark: boolean,
  forPdf: boolean,
  marginMm: number,
  scale: number,
  fontStack: string
): string {
  const a = alertColors(isDark);
  const alertBlock = (name: keyof ReturnType<typeof alertColors>, cls: string) => `
    blockquote.gh-alert-${cls} { border-left-color: ${a[name]}; background: ${a[name]}22; }
    blockquote.gh-alert-${cls} .gh-alert-title { color: ${a[name]}; }`;
  // Márgenes del PDF vía @page → aplican en TODAS las páginas (el padding del body
  // solo separaba la primera). Sin padding del body para no duplicar.
  const pageRule = forPdf ? `@page { size: A4; margin: ${marginMm}mm; }` : '';
  const bodyPad = forPdf ? '0' : '20px 18px 60px';
  const bodyBg = forPdf ? '#ffffff' : p.bg;
  const fontPx = Math.round(16 * scale);
  return `
    ${pageRule}
    :root { color-scheme: ${isDark ? 'dark' : 'light'}; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: ${bodyPad}; background: ${bodyBg}; color: ${p.ink};
      font-family: ${fontStack}; font-size: ${fontPx}px; line-height: 1.65;
      -webkit-text-size-adjust: 100%; word-wrap: break-word; overflow-wrap: break-word; }
    h1,h2,h3,h4,h5,h6 { font-family: Georgia, 'Times New Roman', serif; line-height: 1.25; margin: 1.4em 0 .5em; letter-spacing: -0.3px; }
    h1 { font-size: 1.9em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
    h1:first-child, h2:first-child { margin-top: 0; }
    a { color: ${p.accent}; }
    p, ul, ol { margin: 0 0 1em; }
    code { background: ${p.codeBg}; padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono', Menlo, monospace; font-size: .88em; }
    pre, pre.code-block { background: ${p.codeBlockBg}; color: ${p.codeBlockText}; padding: 14px 16px; border-radius: 10px; overflow-x: auto; font-size: .84em; line-height: 1.5; }
    pre code { background: transparent; color: inherit; padding: 0; font-size: 1em; }
    blockquote { border-left: 3px solid ${p.line}; margin: 1em 0; padding: 2px 0 2px 16px; color: ${p.muted}; font-style: italic; }
    hr { border: none; border-top: 1px solid ${p.line}; margin: 1.8em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; display: block; overflow-x: auto; }
    th, td { border: 1px solid ${p.line}; padding: 7px 11px; text-align: left; }
    th { background: ${p.codeBg}; font-weight: 600; }
    mark { background: ${p.accent}33; color: inherit; padding: 0 2px; border-radius: 3px; }
    /* Enlaces internos [[nota]] */
    .wikilink { color: ${p.accent}; text-decoration: none; border-bottom: 1px solid ${p.accent}55;
      cursor: pointer; -webkit-tap-highlight-color: ${p.accent}33; }
    .wikilink-broken { color: ${p.muted}; border-bottom: 1px dotted ${p.muted}; cursor: default; }
    .backlinks { border-top: 1px solid ${p.line}; margin-top: 2.5em; padding-top: 1em; font-size: .9em; }
    .backlinks h2 { font-family: inherit; font-size: .8em; letter-spacing: 1.5px; text-transform: uppercase;
      color: ${p.muted}; margin: 0 0 .6em; }
    .backlinks ul { margin: 0; padding-left: 1.1em; }
    .backlinks li { margin: .2em 0; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    input[type=checkbox] { margin-right: 6px; }
    ul.contains-task-list { list-style: none; padding-left: .2em; }
    .footnotes { border-top: 1px solid ${p.line}; margin-top: 2em; font-size: .85em; color: ${p.muted}; }
    /* Alertas GitHub */
    blockquote.gh-alert { border-left-width: 4px; border-radius: 0 8px 8px 0; padding: 12px 16px; font-style: normal; color: ${p.ink}; display: flex; flex-direction: column; }
    blockquote.gh-alert p { margin: .3em 0; }
    .gh-alert-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: .95em; margin: 0 0 .4em !important; order: -1; }
    .gh-alert-icon { flex: none; }
    ${alertBlock('note', 'note')}
    ${alertBlock('tip', 'tip')}
    ${alertBlock('important', 'important')}
    ${alertBlock('warning', 'warning')}
    ${alertBlock('caution', 'caution')}
    /* Ecuaciones */
    .katex { font-size: 1.05em; }
    .katex-display { overflow-x: auto; overflow-y: hidden; padding: 4px 0; }
    /* Resaltado de sintaxis (tema propio sobre fondo cálido oscuro) */
    .hljs { color: #e8e0d0; }
    .hljs-comment, .hljs-quote { color: #8a8275; font-style: italic; }
    .hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-name, .hljs-tag, .hljs-meta { color: #e0906a; }
    .hljs-string, .hljs-title, .hljs-section, .hljs-attribute, .hljs-literal, .hljs-type, .hljs-addition, .hljs-template-variable, .hljs-template-tag { color: #b5c98a; }
    .hljs-number, .hljs-symbol, .hljs-bullet, .hljs-attr, .hljs-variable, .hljs-selector-attr, .hljs-selector-pseudo { color: #d9b36a; }
    .hljs-title.function_, .hljs-doctag { color: #e8d5a0; }
    .hljs-regexp, .hljs-link, .hljs-selector-id, .hljs-selector-class { color: #c98a7a; }
    .hljs-deletion { color: #e08a8a; }
    .hljs-emphasis { font-style: italic; }
    .hljs-strong { font-weight: 700; }
    ${
      forPdf
        ? `
    /* PDF: no partir bloques entre páginas ni dejar títulos huérfanos. */
    pre, blockquote, table, tr, img, .katex-display, .footnotes { break-inside: avoid; page-break-inside: avoid; }
    h1, h2, h3, h4, h5, h6 { break-after: avoid; page-break-after: avoid; }
    p { orphans: 2; widows: 2; }`
        : ''
    }
  `;
}

// HTML completo y autónomo. `mode` decide la paleta; 'pdf' usa siempre claro.
const DEFAULT_FONT = `-apple-system, Roboto, system-ui, sans-serif`;

// Los taps en los enlaces internos se avisan por postMessage en vez de navegar: el
// WebView no tiene a dónde ir, la nota la abre React Native. En el PDF no va.
const LINK_BRIDGE = `<script>
document.addEventListener('click', function (e) {
  var el = e.target;
  while (el && el.nodeType !== 1) el = el.parentNode;   // por si el target es texto
  var node = null, anchor = null;
  for (var n = el; n; n = n.parentNode) {
    if (n.nodeType !== 1) continue;
    if (!node && n.hasAttribute('data-note')) node = n;
    if (!anchor && n.tagName === 'A' && (n.getAttribute('href') || '').charAt(0) === '#') anchor = n;
  }
  if (node) {
    e.preventDefault();
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'open-note', id: node.getAttribute('data-note') }));
    }
    return;
  }
  // Anclas internas (notas al pie): navegar a '#x' recargaría about:blank y dejaría
  // la página EN BLANCO. Saltamos nosotros, sin navegar.
  if (anchor) {
    e.preventDefault();
    var id = decodeURIComponent(anchor.getAttribute('href').slice(1));
    var target = id && (document.getElementById(id) || document.getElementsByName(id)[0]);
    if (target && target.scrollIntoView) target.scrollIntoView();
  }
}, true);
</script>`;

function backlinksHtml(backlinks: Array<{ id: string; name: string }>): string {
  if (!backlinks.length) return '';
  const items = backlinks
    .map(
      (b) =>
        `<li><span class="wikilink" role="link" data-note="${md.utils.escapeHtml(b.id)}">${md.utils.escapeHtml(b.name)}</span></li>`
    )
    .join('');
  return `<div class="backlinks"><h2>Mencionada en</h2><ul>${items}</ul></div>`;
}

export function mdToHtml(
  markdown: string,
  mode: 'light' | 'dark' | 'pdf' = 'light',
  opts: {
    pdfMarginMm?: number;
    scale?: number;
    fontStack?: string;
    resolveLink?: (target: string) => string | null;
    backlinks?: Array<{ id: string; name: string }>;
  } = {}
): string {
  const isDark = mode === 'dark';
  const forPdf = mode === 'pdf';
  const p = isDark ? DARK : LIGHT;
  const css = pageCss(p, isDark, forPdf, opts.pdfMarginMm ?? 12, opts.scale ?? 1, opts.fontStack ?? DEFAULT_FONT);
  const body = mdToBody(markdown, { resolveLink: opts.resolveLink });
  const extra = forPdf ? '' : backlinksHtml(opts.backlinks ?? []) + LINK_BRIDGE;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>${KATEX_CSS}</style>
<style>${css}</style>
</head>
<body>${body}${extra}</body>
</html>`;
}
