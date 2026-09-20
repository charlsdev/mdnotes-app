// Visor de PDF que corre dentro del WebView del app (mismo patrón que webeditor/).
// Puente con React Native:
//   RN → WV: window.__PDF_URL__ / __DARK__ (antes de cargar) y window.MDPDF.setTheme
//   WV → RN: postMessage({ type: 'loaded' | 'progress' | 'error' })
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import './viewer.css';

// CLAVE: con `globalThis.pdfjsWorker` presente, pdf.js usa su "fake worker" y hace
// todo en el mismo hilo. Si no, intentaría `new Worker(file://…)`, que el WebView
// bloquea por origen — y el visor quedaría cargando para siempre.
(globalThis as any).pdfjsWorker = pdfjsWorker;

declare global {
  interface Window {
    __PDF_URL__?: string;
    __DARK__?: boolean;
    MDPDF: { setTheme: (t: 'light' | 'dark') => void };
    ReactNativeWebView?: { postMessage: (s: string) => void };
  }
}

function post(obj: unknown) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(obj));
}

const pagesEl = document.getElementById('pages')!;
const statusEl = document.getElementById('status')!;

function applyTheme(dark: boolean) {
  document.body.classList.toggle('dark', dark);
}

async function render(url: string) {
  try {
    const doc = await pdfjsLib.getDocument({ url, isEvalSupported: false }).promise;
    post({ type: 'loaded', pages: doc.numPages });
    statusEl.textContent = '';

    // Ancho del contenido; el zoom fino lo hace el pinch del WebView.
    const width = Math.max(320, Math.min(document.documentElement.clientWidth, 1400)) - 16;
    // Cap del devicePixelRatio: en pantallas 3x un PDF largo agotaría la memoria.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const scale = width / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale: scale * dpr });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const wrap = document.createElement('div');
      wrap.className = 'page';
      wrap.appendChild(canvas);
      pagesEl.appendChild(wrap);

      // Página por página: la primera se ve enseguida aunque el documento sea largo.
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      page.cleanup();
      post({ type: 'progress', page: n, pages: doc.numPages });
    }
  } catch (e: any) {
    statusEl.textContent = 'No pude abrir este PDF.';
    post({ type: 'error', message: String(e?.message ?? e) });
  }
}

window.MDPDF = {
  setTheme: (t) => applyTheme(t === 'dark'),
};

applyTheme(!!window.__DARK__);
if (window.__PDF_URL__) {
  void render(window.__PDF_URL__);
} else {
  statusEl.textContent = 'No recibí el archivo.';
  post({ type: 'error', message: 'sin URL' });
}
