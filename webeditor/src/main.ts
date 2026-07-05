// Editor WYSIWYG (Milkdown Crepe) que corre dentro del WebView del app.
// Puente con React Native:
//   RN → WV: window.__MD__/__DARK__ (antes de cargar) y window.MDNOTES.setContent/setTheme
//   WV → RN: postMessage({ type: 'ready' | 'change', md })
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './theme.css';
import { alertPlugin } from './alerts';

declare global {
  interface Window {
    __MD__?: string;
    __DARK__?: boolean;
    __SCALE__?: number;
    MDNOTES: {
      setContent: (md: string) => void;
      setTheme: (t: 'light' | 'dark') => void;
      setScale: (px: number) => void;
    };
    ReactNativeWebView?: { postMessage: (s: string) => void };
  }
}

function post(obj: unknown) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(obj));
}

let crepe: Crepe | null = null;
let dark = !!window.__DARK__;

function applyTheme() {
  document.body.classList.toggle('dark', dark);
}

// Escala el tamaño de fuente del editor (px del cuerpo del ProseMirror).
function applyScale(px: number) {
  let s = document.getElementById('mdn-scale');
  if (!s) {
    s = document.createElement('style');
    s.id = 'mdn-scale';
    document.head.appendChild(s);
  }
  s.textContent = `.milkdown .ProseMirror{font-size:${px}px;}`;
}

async function mount(md: string) {
  if (crepe) {
    await crepe.destroy();
    crepe = null;
  }
  const root = document.getElementById('app')!;
  root.innerHTML = '';
  const instance = new Crepe({ root, defaultValue: md });
  // La 1ª emisión es la normalización del parse inicial: no la reportamos como
  // cambio (si no, abrir una nota reescribiría el .md al instante).
  let ignoreFirst = true;
  instance.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      if (ignoreFirst) {
        ignoreFirst = false;
        return;
      }
      post({ type: 'change', md: markdown });
    });
  });
  instance.editor.use(alertPlugin);
  await instance.create();
  crepe = instance;
  post({ type: 'ready' });
}

window.MDNOTES = {
  setContent: (md) => {
    void mount(md);
  },
  setTheme: (t) => {
    dark = t === 'dark';
    applyTheme();
  },
  setScale: (px) => applyScale(px),
};

applyTheme();
applyScale(window.__SCALE__ ?? 15);
void mount(window.__MD__ ?? '');
