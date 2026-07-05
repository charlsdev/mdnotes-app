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
  .use(githubAlerts);

export function mdToBody(markdown: string): string {
  return md.render(markdown);
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

function pageCss(p: Palette, isDark: boolean, forPdf: boolean, marginMm: number): string {
  const a = alertColors(isDark);
  const alertBlock = (name: keyof ReturnType<typeof alertColors>, cls: string) => `
    blockquote.gh-alert-${cls} { border-left-color: ${a[name]}; background: ${a[name]}22; }
    blockquote.gh-alert-${cls} .gh-alert-title { color: ${a[name]}; }`;
  // El margen del PDF se aplica como padding del body (determinista en expo-print);
  // `@page margin: 0` quita el margen por defecto de la impresora para no sumar.
  const pageRule = forPdf ? `@page { size: A4; margin: 0; }` : '';
  const bodyPad = forPdf ? `${marginMm}mm` : '20px 18px 60px';
  const bodyBg = forPdf ? '#ffffff' : p.bg;
  return `
    ${pageRule}
    :root { color-scheme: ${isDark ? 'dark' : 'light'}; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: ${bodyPad}; background: ${bodyBg}; color: ${p.ink};
      font-family: -apple-system, Roboto, system-ui, sans-serif; font-size: 16px; line-height: 1.65;
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
  `;
}

// HTML completo y autónomo. `mode` decide la paleta; 'pdf' usa siempre claro.
export function mdToHtml(
  markdown: string,
  mode: 'light' | 'dark' | 'pdf' = 'light',
  opts: { pdfMarginMm?: number } = {}
): string {
  const isDark = mode === 'dark';
  const forPdf = mode === 'pdf';
  const p = isDark ? DARK : LIGHT;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>${KATEX_CSS}</style>
<style>${pageCss(p, isDark, forPdf, opts.pdfMarginMm ?? 12)}</style>
</head>
<body>${mdToBody(markdown)}</body>
</html>`;
}
