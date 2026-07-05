# MDNotes — Guía técnica y gotchas

> App de notas Markdown, **offline-first**, con vault (editar los `.md` reales de
> una carpeta del teléfono). Tus archivos son tuyos: `.md` plano, portable.

## Stack

- **Expo SDK 54** · React 19.1 · React Native 0.81.5 · **New Architecture** (`newArchEnabled: true`)
- **expo-router 6** (rutas basadas en archivos), TypeScript estricto
- **Zustand** (`src/storage/store.ts`) — estado global de notas + vault
- **expo-file-system** (persistencia) — API clásica vía `expo-file-system/legacy`
- **react-native-webview** — render del preview (VER) **y** del editor WYSIWYG (VIVO)
- **react-native-keyboard-controller** — teclado (como daemoni)
- **@expo-google-fonts** — Fraunces (display), Inter Tight (UI), JetBrains Mono (editor)
- Export/compartir: expo-print + expo-sharing · Imágenes: expo-image-picker + expo-image-manipulator (resize)
- Preview (VER): markdown-it + plugins (mark, footnote, task-lists, `@vscode/markdown-it-katex`)
  + **highlight.js** (resaltado de sintaxis)
- **Editor WYSIWYG (VIVO)**: **Milkdown Crepe** bundleado offline (proyecto aparte `webeditor/`)

## Estructura

```
app/
  _layout.tsx        Fuentes + splash + KeyboardProvider + AlertProvider + Stack + carga de ajustes
  index.tsx          Biblioteca: lista/árbol, abrir carpeta (vault), importar, crear, buscar, ⚙ ajustes
  editor/[id].tsx    Editor de 3 modos (VIVO/MD/VER) + toolbar + cajón (☰) + indicador de guardado
  settings.tsx       Ajustes: autoguardado (on/off) + margen del PDF
src/
  components/         EditorToolbar, ModeToggle, MarkdownPreview (VER), MarkdownWysiwyg (VIVO),
                     NoteTree, NoteTreeDrawer, TagsBar, AppAlert, Footer, CharlsdevMark, Wordmark
  storage/           files.ts (notas internas) · vault.ts (carpeta SAF) · store.ts (Zustand)
                     · settings.ts (ajustes: pdfMarginMm, autosave, theme, readingScale/Font)
  lib/               markdown.ts (mdToHtml, compartido VER/PDF) · katex-css.ts (GENERADO)
                     · tree.ts (buildTreeRows) · frontmatter.ts (tags YAML)
  theme/             Paleta de marca + fuentes + tokens
  types/  utils/
assets/              icon, icon-dark, adaptive-icon, splash(*), favicon, webeditor.html (GENERADO)
plugins/             withCmakeVersion.js (fix rutas largas de Windows, ver COMPILACION.md)
scripts/             gen-katex-css.mjs (regenera src/lib/katex-css.ts)
webeditor/           Proyecto de build del editor VIVO (Milkdown Crepe) → assets/webeditor.html
initials/            SOLO material de referencia — NO se compila (ver abajo)
```

`webeditor/` e `initials/` NO son parte de la app: excluidos en tsconfig, metro.config.js
(`resolver.blockList`) y `.easignore`. `metro.config.js` añade `'html'` a `assetExts`.

## Reglas de oro (romper esto rompe el build o el runtime)

### pnpm + Metro
- **`.npmrc` con `node-linker=hoisted`** es obligatorio. Sin él, Metro no resuelve
  `@babel/runtime` (el store anidado de pnpm rompe React Native/Expo). No lo quites.

### `initials/` no entra a la app
Es material de referencia (brand book, `md-editor-app` scaffold base, `mdnotes-assets`
con logos/iconos). Está excluido en **4 sitios**, mantenlos sincronizados:
- `tsconfig.json` → `exclude`
- `metro.config.js` → `resolver.blockList`
- `app.json` → `assetBundlePatterns: ["assets/**/*"]` (NO `**/*`)
- `.easignore`

### Nombre y marca
- La app es **MDNotes** (el `initials/brand.md` usa el nombre viejo "Marginalia" —
  IGNÓRALO). Paleta en `src/theme/index.ts` y `MARCA.md`: tinta `#1a1714` /
  papel `#f5f1ea` / bermellón `#c14a2b` (**único** acento). Ver `MARCA.md`.
- Footer "por charlsdev" (→ charlsdev.xyz) es **fijo** en todas las apps del usuario
  (`src/components/Footer.tsx` + `CharlsdevMark.tsx`). No lo quites.

## Modelo de datos: notas internas vs vault

`MdFile` (`src/types`) puede ser:
- **Interna**: `id` corto aleatorio, vive en `documentDirectory` (`src/storage/files.ts`).
- **Vault**: `uri` = URI SAF del archivo real; `folder` = ruta relativa dentro de la
  carpeta abierta. Editar/crear/borrar opera sobre el `.md` real.

El `store` es **vault-aware**: si `file.uri` existe → operación SAF; si no → interna.
Ambas se muestran mezcladas. Al crear/importar con un vault abierto, el archivo se
escribe **dentro** de la carpeta.

### Vault (Storage Access Framework) — `src/storage/vault.ts`
- "Abrir carpeta" → `requestDirectoryPermissionsAsync` (el picker deja elegir
  CUALQUIER carpeta del teléfono: interno, Descargas, Documentos, SD). El permiso
  se **persiste** en AsyncStorage (`mdnotes:vault-uri`), sobrevive reinicios.
- **Escaneo RECURSIVO**: lee los `.md` de la carpeta y subcarpetas (cap depth 8 /
  1000 archivos). Detecta subcarpeta con heurística (sin extensión → intenta listar).
- **LIMITACIÓN**: SAF RECHAZA carpetas de **Google Drive** u otras nubes
  (`content://com.google.android.apps.docs...` → "not a Storage Access Framework URI").
  El vault SOLO sirve con almacenamiento del teléfono. Para Drive → "Importar
  archivos" (DocumentPicker copia local). `openFolder` detecta el error y avisa.

### GOTCHA CRÍTICO de navegación (no lo re-rompas)
El `id` de una nota vault sería su URI SAF (`content://…%2F…`) con `/` y `:` que
**rompen expo-router** ("Unmatched Route" en `mdnotes:///`) y **no sobreviven** el
round-trip del parámetro (→ editor con spinner infinito). Por eso:
- Las notas vault llevan un **id corto y estable** = `Vault.vaultIdForUri(uri)` (hash).
- **SIEMPRE** navega con objeto, nunca interpolando la URI:
  `router.push({ pathname: '/editor/[id]', params: { id } })` (helper `openNote()`).

## Preview y export (Typora-like)

- El preview del modo **VIEW** es un **WebView** (`MarkdownPreview.tsx`) que renderiza
  `mdToHtml(content, mode)` de `src/lib/markdown.ts`. **La misma función genera el
  HTML del export PDF** → lo que ves es lo que exportas.
- `md` tiene `html: true` (renderiza `<img>`, `<u>`, etc. — es contenido propio del user).
- Plugins markdown-it: `mark` (`==resaltado==`), `footnote`, `task-lists`,
  `@vscode/markdown-it-katex` (mates `$…$` / `$$…$$`), **highlight.js** en la opción
  `highlight` (resaltado de sintaxis, tema propio cálido) + plugin propio `githubAlerts`
  para `> [!NOTE|TIP|IMPORTANT|WARNING|CAUTION]`.
- **Alertas CON color estilo GitHub** (excepción consciente al monocromático de marca,
  a pedido del user): note azul, tip verde, important morado, warning ámbar, caution rojo,
  + ícono octicon. Colores en `alertColors()` de `markdown.ts`.
- **KaTeX offline**: `src/lib/katex-css.ts` es un archivo **AUTO-GENERADO** (~360 KB)
  con las fuentes woff2 embebidas en base64. Regenéralo con
  `node scripts/gen-katex-css.mjs` si actualizas `katex`. No lo edites a mano.
- **Márgenes del PDF**: `mdToHtml(md, 'pdf', {pdfMarginMm})` usa **`@page { margin }`** (aplica en
  TODAS las páginas; el padding del body solo separaba la 1ª). Valor desde ajustes. Además, en PDF
  se agregan `break-inside: avoid` (callouts, código, tablas, imágenes) y `break-after: avoid` en
  títulos para que no se corten entre páginas.
- **Imágenes de galería** (toolbar 🖼): se **redimensionan** (máx 1400px) y comprimen con
  **expo-image-manipulator** antes de embeberlas como **data URI JPEG** en el `.md` (mucho más liviano).
- **Imágenes locales del vault** (`![](./img/x.png)` o `<img src>`): el escaneo indexa las
  imágenes (`VaultScan.images`: relPath→uri) y el editor las resuelve a data URI antes del
  preview/PDF (`inlineLocalImages` en `editor/[id].tsx` devuelve `{md, restore}`;
  `readImageDataUri` lee SAF en base64). Maneja `./`, `../` y `\` de Windows.

## Editor: 3 modos — VIVO / MD / VER (`EditorMode = 'live' | 'code' | 'view'`)

Toggle en el topbar (`ModeToggle`). Abrir nota → **VER** (rápido, solo lectura);
nota nueva → **MD**. **VIVO** es opt-in por nota (carga el editor pesado).

- **MD** (`code`): `<TextInput>` monoespaciado con el `EditorToolbar` (H1–H6, B/i/S/▮/T✕,
  listas, código, tabla, callout, ∑, 🖼, link, hr). Control byte-a-byte del `.md`.
- **VER** (`view`): `MarkdownPreview.tsx` (WebView, `mdToHtml`) + barra PDF/Compartir/Eliminar.
- **VIVO** (`live`): **Milkdown Crepe** (WYSIWYG tipo Typora) en `MarkdownWysiwyg.tsx`.

### VIVO (Crepe) — arquitectura y GOTCHAS
- El editor se compila **aparte** en `webeditor/` (tiene su propio `node_modules`):
  `npm install` + `node build.mjs` → **esbuild** bundlea Crepe a un HTML autónomo offline
  → **`assets/webeditor.html`** (~4 MB). Se carga como **asset** (`require('../../assets/webeditor.html')`
  + expo-asset), NO como string (no infla el bundle JS). Regenera el asset tras tocar
  `webeditor/src/*` con `cd webeditor && node build.mjs`.
- Puente RN↔WebView (`MarkdownWysiwyg.tsx`): RN→WV `window.__MD__` inicial +
  `MDNOTES.setContent/setTheme`; WV→RN `postMessage({type:'change', md})`.
- **Crepe NORMALIZA el markdown al editar** (re-serializa todo el doc). Introduce ruido que
  se limpia en `onLiveChange` antes de guardar: **des-escapa alertas** (`\[!NOTE]`→`[!NOTE]`,
  ver abajo), quita `<br />`, restaura rutas de imagen. Aun así puede reformatear detalles →
  para control exacto usar **MD**.
- **BUG alertas (resuelto)**: Crepe ESCAPA el corchete al serializar (`[!NOTE]`→`\[!NOTE]`),
  y el `\[` rompe la detección de alertas en VER/PDF (salen literales). Fix doble:
  `unescapeAlerts()` en `mdToBody` (des-escapa al renderizar) + `onLiveChange` (limpia el .md).
- **Crepe NO renderiza `<img>` HTML** (lo muestra como texto/base64): al entrar a VIVO se
  convierten a `![](...)`. Imágenes del vault se pasan como data URI (`liveMd`), y `onLiveChange`
  restaura las rutas originales (mapa `imgRestore`) para no corromper el `.md`.
- **Callouts de color en VIVO**: `webeditor/src/alerts.ts` es un plugin de ProseMirror
  (`$prose` de `@milkdown/kit`) que decora los blockquotes `[!TYPE]` con la clase de color,
  OCULTA el marcador y muestra un widget-header (ícono octicon + etiqueta), como VER.
- **Tema/CSS de Crepe**: `webeditor/src/theme.css` sobreescribe variables `--crepe-*` a la
  paleta de marca + arregla: ancho del contenido (default de Crepe es angostísimo), menú
  slash (z-index/sombra/compacto), control de bloque `+`/⠿ (`left: 8px !important`, Crepe lo
  manda fuera de pantalla), línea activa de CodeMirror (quita el cuadrito), tamaño de imagen.
- **GOTCHA tema oscuro VIVO**: Crepe define las `--crepe-color-*` en **`.milkdown`** (no en `:root`).
  Los overrides de tema DEBEN ir en `.milkdown` (claro) y `body.dark .milkdown` (oscuro) para ganar
  especificidad — si van en `:root`/`body.dark` NO llegan al editor y VIVO se queda claro aunque el
  tema sea oscuro. El fondo de `html,body` va explícito (fuera de `.milkdown` no resuelven las vars).
  El tema se manda por el bridge `setTheme` (VIVO sigue el tema de la app).

## UI

- **Alertas**: NUNCA `Alert.alert` nativo (feo en MIUI). Usa `appAlert(...)` de
  `src/components/AppAlert.tsx` (provider + API imperativa compatible, overlay animado,
  variantes error/warn/success/info; monocromático, se diferencia por ícono).
  `<AlertProvider>` envuelve la app en `_layout.tsx`.
- **Árbol de notas**: `src/lib/tree.ts` `buildTreeRows` + `NoteTree.tsx` (carpetas
  colapsables). La biblioteca lo usa con vault; sin vault, lista rica con preview/tags.
- **Saltar de nota a nota**: `NoteTreeDrawer.tsx` (cajón, botón ☰ en el editor) →
  `switchTo` hace `flushSave()` (guarda lo pendiente) + `router.replace(...)`. El editor
  recarga al cambiar `id` (ref `loadedId`).
- **Ajustes** (`app/settings.tsx`, engrane ⚙ en la biblioteca): store `settings.ts`
  (zustand + AsyncStorage `mdnotes:settings`, cargado en `_layout`). Opciones: margen del PDF,
  autoguardado, **tema** (`system|light|dark` → `useEffectiveScheme()` en `src/theme`, respetado
  por `useTheme`/`_layout`/`MarkdownPreview`), **tamaño de lectura** (`readingScale` → font-size
  en VER `mdToHtml(..,{scale})`, editor MD, y VIVO via bridge `setScale`), **fuente de lectura**
  (`readingFont` sans/serif/mono → solo VER, `mdToHtml(..,{fontStack})`).
- **Tags** (`src/lib/frontmatter.ts`): editables desde `TagsBar.tsx` (chips), guardados en
  **frontmatter YAML** (`---\ntags: [a,b]\n---`). `computeTags(content)` = frontmatter ∪ `#hashtags`
  del cuerpo. Filtro por tag en la biblioteca (`tagFilter`, barra en el hero). **GOTCHAS**:
  `mdToBody`/`deriveName`/`preview` hacen `stripFrontmatter` (si no, el `---` se renderiza/muestra
  como título); en VIVO se pasa `stripFrontmatter(content)` a Crepe y `onLiveChange` re-antepone
  el frontmatter (`contentRef` + `splitFrontmatter().fm`) para no perder los tags al guardar.
- **Guardado**: el editor tiene `SaveState` (saved/saving/dirty) + `SaveIndicator` en el
  topbar. Autosave ON → debounce 600ms, muestra "Guardando…"/"Guardado". Autosave OFF →
  botón "Guardar" cuando hay cambios; igual guarda al salir (`goBack`) y al saltar de nota
  (`switchTo`) para no perder datos. `doSave` es la fuente única.
- **Toolbar del editor** (`EditorToolbar.tsx`, solo en modo **MD**): H1–H6, B / i / S (tachado)
  / ▮ (resaltado) / T✕ (limpiar formato), cita, listas, checkbox, código, tabla, callout,
  ∑ (ecuación), 🖼 (imagen de galería), link, regla. (VIVO usa la UI propia de Crepe.)
- **Teclado**: `react-native-keyboard-controller` (`<KeyboardProvider>` + su
  `<KeyboardAvoidingView behavior="padding">`). Es **módulo nativo** → **NO corre en
  Expo Go**; probar solo con APK (`build-and-install.ps1 -Prebuild`). Ver COMPILACION.md.

### Status bar / edge-to-edge (SDK 54)
SDK 54 dibuja bajo el status bar. `SafeAreaProvider` lleva `initialMetrics={initialWindowMetrics}`
en `_layout`. Las pantallas usan `SafeAreaView edges={['top']}`. **Los Modales son root
aparte** donde SafeAreaView NO mide bien en Android → el `NoteTreeDrawer` calcula su
`paddingTop` con `StatusBar.currentHeight` (Android) combinado con el inset que recibe por
prop (`topInset`, medido en el editor). No confíes en SafeAreaView dentro de un Modal.

## Ícono y splash (Android)

- **MIUI ignora `adaptiveIcon.backgroundColor`** y mete el ícono en plaquita blanca.
  Por eso `adaptiveIcon.foregroundImage = ./assets/icon.png` (la "M" en TINTA oscura
  sobre papel, full-bleed) — legible en cualquier launcher. No volver al `adaptive-icon.png`
  crema (se ve invisible sobre blanco).
- **Splash**: Android 12+ RECORTA logos anchos (el masthead salía "MDNo"). Usa el
  símbolo cuadrado `icon.png` centrado (plugin `expo-splash-screen`, `imageWidth: 200`).
- Cambios de ícono/splash requieren `build-and-install.ps1 -Prebuild` (assembleRelease
  normal no regenera los recursos nativos).

## Verificación

- `pnpm typecheck` (tsc --noEmit) y `npx expo export --platform android` (bundle Metro)
  son el mínimo antes de dar algo por bueno. No hay acceso a device en CI; el WebView/
  KaTeX/SAF hay que verlos en el teléfono.
