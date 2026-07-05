# MDNotes

App móvil para leer, escribir y previsualizar Markdown. Editorial, offline-first,
con **vault**: abres una carpeta del teléfono y editas los `.md` reales en sitio
(tipo Obsidian/Typora). Tus archivos son tuyos.

> Tagline: **Notas y Markdown**

## Stack

- **React Native 0.81** + **Expo SDK 54** (managed, expo-router 6, React 19, New Architecture)
- **TypeScript** estricto · **Zustand** (estado, vault-aware) · **expo-file-system** + AsyncStorage
- **react-native-webview** + **markdown-it** + **KaTeX** (preview y PDF, `src/lib/markdown.ts`)
- **react-native-keyboard-controller** (teclado) · **expo-image-picker** (imágenes)
- **expo-print** + **expo-sharing** (exportar/compartir)
- Fuentes: **Fraunces** / **Inter Tight** / **JetBrains Mono** vía `@expo-google-fonts/*`

## Estructura

```
mdnotes-app/
├── app/
│   ├── _layout.tsx        Fuentes + splash + KeyboardProvider + AlertProvider + Stack
│   ├── index.tsx          Biblioteca: lista/árbol, abrir carpeta, importar, crear, buscar
│   └── editor/[id].tsx    Editor + preview (WebView) + toolbar + cajón de notas (☰)
├── src/
│   ├── components/        EditorToolbar, ModeToggle, MarkdownPreview, NoteTree,
│   │                      NoteTreeDrawer, AppAlert, Footer, CharlsdevMark, Wordmark
│   ├── storage/           files.ts (internas) · vault.ts (carpeta SAF) · store.ts (Zustand)
│   ├── lib/               markdown.ts · katex-css.ts (generado) · tree.ts
│   ├── theme/ · types/ · utils/
├── assets/                icon, icon-dark, adaptive-icon, splash, favicon
├── plugins/               withCmakeVersion.js (fix rutas largas de Windows)
├── initials/              SOLO referencia (brand book, scaffold, assets) — no se compila
└── app.json · eas.json · metro.config.js · tsconfig.json · babel.config.js · .npmrc
```

Docs: **AGENTS.md** (arquitectura + gotchas) · **COMPILACION.md** (build) · **MARCA.md**.

## Funcionalidades

- **Vault**: abrir una carpeta del teléfono (recursivo, subcarpetas) y editar los `.md`
  reales en sitio; **árbol** de carpetas colapsable. (Solo almacenamiento local, no Drive.)
- **Importar** archivos `.md` sueltos (incl. desde Drive: copia local).
- Notas internas cuando no hay carpeta abierta. Crear / editar / eliminar · autosave (600 ms).
- **Editor** con toolbar: H1–H3, negrita/cursiva/tachado/resaltado, listas, checkbox, cita,
  código, **tabla**, **callout** (`> [!WARNING]`), **ecuación** (`$$`), **imagen**, link, regla.
- **Preview** (WebView) con tablas, tachado, resaltado, callouts, **matemáticas KaTeX**
  (offline), footnotes, imágenes. Mismo motor que el **export PDF**.
- Saltar de una nota a otra desde el editor (cajón ☰) sin volver a la biblioteca.
- Exportar a **PDF** y compartir el `.md` crudo. Búsqueda en contenido. Claro/oscuro automático.

## Correr / probar

> ⚠️ Usa `react-native-keyboard-controller` (módulo nativo) → **no corre en Expo Go**.
> Se compila el APK. Detalle en **COMPILACION.md** (incluye el fix de CMake 4.1.2).

```bash
pnpm install
```
```powershell
pwsh -File .\build-and-install.ps1 -Prebuild   # regenera android/ + gradle + adb install
```

## Próximos pasos

- [ ] Redimensionar imágenes antes de insertarlas (hoy van base64 sin resize)
- [ ] Tags editables · resaltado de sintaxis en bloques de código
- [ ] Ajustes: fuente, tamaño, tema
- [ ] Integración real con Google Drive (OAuth) para editar en la nube
```
