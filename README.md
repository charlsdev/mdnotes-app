# MDNotes

App móvil para leer, escribir y previsualizar Markdown. Editorial, offline-first,
con **vault**: abres una carpeta del teléfono y editas los `.md` reales en sitio
(tipo Obsidian/Typora). Tus archivos son tuyos.

> Tagline: **Notas y Markdown**

## Stack

- **React Native 0.81** + **Expo SDK 54** (managed, expo-router 6, React 19, New Architecture)
- **TypeScript** estricto · **Zustand** (estado, vault-aware) · **expo-file-system** + AsyncStorage
- **react-native-webview** + **markdown-it** + **KaTeX** + **highlight.js** (preview VER y PDF)
- **Milkdown Crepe** (editor WYSIWYG VIVO, bundleado offline en `webeditor/`)
- **react-native-keyboard-controller** (teclado) · **expo-image-picker** (imágenes)
- **expo-print** + **expo-sharing** (exportar/compartir)
- Fuentes: **Fraunces** / **Inter Tight** / **JetBrains Mono** vía `@expo-google-fonts/*`

## Estructura

```
mdnotes-app/
├── app/
│   ├── _layout.tsx        Fuentes + splash + KeyboardProvider + AlertProvider + Stack
│   ├── index.tsx          Biblioteca: lista/árbol, abrir carpeta, importar, crear, buscar, ⚙
│   ├── editor/[id].tsx    Editor 3 modos (VIVO/MD/VER) + toolbar + cajón (☰) + guardado
│   └── settings.tsx       Ajustes: autoguardado + margen del PDF
├── src/
│   ├── components/        EditorToolbar, ModeToggle, MarkdownPreview (VER), MarkdownWysiwyg (VIVO),
│   │                      NoteTree, NoteTreeDrawer, AppAlert, Footer, CharlsdevMark, Wordmark
│   ├── storage/           files.ts (internas) · vault.ts (SAF) · store.ts · settings.ts
│   ├── lib/               markdown.ts · katex-css.ts (generado) · tree.ts
│   ├── theme/ · types/ · utils/
├── assets/                icon, splash, favicon, webeditor.html (editor VIVO, generado)
├── webeditor/             Proyecto de build del editor WYSIWYG (Milkdown Crepe) — no se compila
├── plugins/               withCmakeVersion.js (fix rutas largas de Windows)
├── initials/              SOLO referencia (brand book, scaffold, assets) — no se compila
└── app.json · eas.json · metro.config.js · tsconfig.json · babel.config.js · .npmrc
```

Docs: **AGENTS.md** (arquitectura + gotchas) · **COMPILACION.md** (build) · **MARCA.md**.

## Funcionalidades

- **Vault**: abrir una carpeta del teléfono (recursivo, subcarpetas) y editar los `.md`
  reales en sitio; **árbol** de carpetas colapsable. (Solo almacenamiento local, no Drive.)
- **Importar** archivos `.md` sueltos (incl. desde Drive: copia local).
- Notas internas cuando no hay carpeta abierta. Crear / editar / eliminar.
- **Guardado configurable**: autoguardado (con indicador "Guardando…/Guardado") o manual
  con botón "Guardar". Se elige en Ajustes.
- **Editor de 3 modos** (toggle VIVO/MD/VER):
  - **VIVO** — WYSIWYG tipo Typora (Milkdown Crepe): editas sobre el documento renderizado,
    con callouts de color, imágenes, tablas, código, mates.
  - **MD** — Markdown crudo + toolbar (H1–H6, negrita/cursiva/tachado/resaltado/limpiar,
    listas, checkbox, cita, código, tabla, callout, ecuación, imagen, link, regla).
  - **VER** — preview de solo lectura (WebView) con **callouts de color** (estilo GitHub),
    **KaTeX** (offline), **resaltado de sintaxis**, footnotes, tablas e imágenes (galería y
    **locales del vault** `./img/x.png`). Mismo motor que el **PDF**.
- Saltar de una nota a otra desde el editor (cajón ☰) sin volver a la biblioteca.
- Exportar a **PDF** (A4, **margen configurable**) y compartir el `.md` crudo.
- **Ajustes** (⚙): autoguardado y margen del PDF. Búsqueda en contenido. Claro/oscuro automático.

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

- [ ] Tags editables desde el editor (hoy se derivan de `#tag`)
- [ ] Callouts en VIVO con el marcador oculto también durante la edición (pulido)
- [ ] Integración real con Google Drive (OAuth) para editar en la nube — grande
```
