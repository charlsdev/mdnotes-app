# MDNotes — Guía técnica y gotchas

> App de notas Markdown, **offline-first**, con vault (editar los `.md` reales de
> una carpeta del teléfono). Tus archivos son tuyos: `.md` plano, portable.

## Stack

- **Expo SDK 54** · React 19.1 · React Native 0.81.5 · **New Architecture** (`newArchEnabled: true`)
- **expo-router 6** (rutas basadas en archivos), TypeScript estricto
- **Zustand** (`src/storage/store.ts`) — estado global de notas + vault
- **expo-file-system** (persistencia) — API clásica vía `expo-file-system/legacy`
- **react-native-webview** — render del preview (markdown-it + KaTeX + highlight.js)
- **react-native-keyboard-controller** — teclado (como daemoni)
- **@expo-google-fonts** — Fraunces (display), Inter Tight (UI), JetBrains Mono (editor)
- Export/compartir: expo-print + expo-sharing · Imágenes: expo-image-picker
- Markdown: markdown-it + plugins (mark, footnote, task-lists, `@vscode/markdown-it-katex`)
  + **highlight.js** (resaltado de sintaxis)

## Estructura

```
app/
  _layout.tsx        Fuentes + splash + KeyboardProvider + AlertProvider + Stack + carga de ajustes
  index.tsx          Biblioteca: lista/árbol, abrir carpeta (vault), importar, crear, buscar, ⚙ ajustes
  editor/[id].tsx    Editor + preview (WebView) + toolbar + cajón de notas (☰) + indicador de guardado
  settings.tsx       Ajustes: autoguardado (on/off) + margen del PDF
src/
  components/         EditorToolbar, ModeToggle, MarkdownPreview, NoteTree, NoteTreeDrawer,
                     AppAlert, Footer, CharlsdevMark, Wordmark
  storage/           files.ts (notas internas) · vault.ts (carpeta SAF) · store.ts (Zustand)
                     · settings.ts (ajustes: pdfMarginMm, autosave — AsyncStorage)
  lib/               markdown.ts (mdToHtml, compartido preview/PDF) · katex-css.ts (GENERADO)
                     · tree.ts (buildTreeRows)
  theme/             Paleta de marca + fuentes + tokens
  types/  utils/
assets/              icon, icon-dark, adaptive-icon, splash(*), favicon
plugins/             withCmakeVersion.js (fix rutas largas de Windows, ver COMPILACION.md)
initials/            SOLO material de referencia — NO se compila (ver abajo)
```

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
- **Márgenes del PDF**: expo-print NO pone márgenes solo. `mdToHtml(md, 'pdf', {pdfMarginMm})`
  los aplica como **padding del body** (`@page margin: 0` quita el default de la impresora).
  El valor sale de los ajustes.
- **Imágenes de galería** (toolbar 🖼): se insertan como **data URI base64** en el `.md`
  (portable, sin resize aún).
- **Imágenes locales del vault** (`![](./img/x.png)` o `<img src>`): el escaneo indexa las
  imágenes (`VaultScan.images`: relPath→uri) y el editor las resuelve a data URI antes del
  preview/PDF (`inlineLocalImages` + `resolveRel` en `editor/[id].tsx`; `readImageDataUri`
  lee SAF en base64). Maneja `./`, `../` y `\` de Windows.

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
  (zustand + AsyncStorage `mdnotes:settings`, cargado en `_layout`). Margen del PDF +
  autoguardado on/off.
- **Guardado**: el editor tiene `SaveState` (saved/saving/dirty) + `SaveIndicator` en el
  topbar. Autosave ON → debounce 600ms, muestra "Guardando…"/"Guardado". Autosave OFF →
  botón "Guardar" cuando hay cambios; igual guarda al salir (`goBack`) y al saltar de nota
  (`switchTo`) para no perder datos. `doSave` es la fuente única.
- **Toolbar del editor** (`EditorToolbar.tsx`): H1–H6, B / i / S (tachado) / ▮ (resaltado)
  / T✕ (limpiar formato), cita, listas, checkbox, código, tabla, callout, ∑ (ecuación),
  🖼 (imagen de galería), link, regla.
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
