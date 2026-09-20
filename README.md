# MDNotes

App móvil para leer, escribir y previsualizar Markdown. Editorial, offline-first,
con **vault**: abres una carpeta del teléfono y editas los `.md` reales en sitio
inspirado en Typora. Tus archivos son tuyos.

> Tagline: **Notas y Markdown**

## Stack

- **React Native 0.81** + **Expo SDK 54** (managed, expo-router 6, React 19, New Architecture)
- **TypeScript** estricto · **Zustand** (estado, vault-aware) · **expo-file-system** + AsyncStorage
- **react-native-webview** + **markdown-it** + **KaTeX** + **highlight.js** (preview VER y PDF)
- **Milkdown Crepe** (editor WYSIWYG VIVO, bundleado offline en `webeditor/`)
- **react-native-keyboard-controller** (teclado) · **expo-image-picker** + **expo-image-manipulator** (imágenes)
- **expo-print** + **expo-sharing** (exportar/compartir)
- Fuentes: **Fraunces** / **Inter Tight** / **JetBrains Mono** vía `@expo-google-fonts/*`

## Estructura

```
mdnotes-app/
├── app/
│   ├── _layout.tsx        Fuentes + splash + KeyboardProvider + AlertProvider + Stack
│   ├── index.tsx          Biblioteca: lista/árbol, abrir carpeta, importar, crear, buscar, ⚙
│   ├── editor/[id].tsx    Editor 3 modos (VIVO/MD/VER) + toolbar + cajón (☰) + guardado
│   └── settings.tsx       Ajustes: tema, lectura, autoguardado, imágenes, margen del PDF
├── src/
│   ├── components/        EditorToolbar, ModeToggle, MarkdownPreview (VER), MarkdownWysiwyg (VIVO),
│   │                      NoteTree, NoteTreeDrawer, AppAlert, Footer, CharlsdevMark, Wordmark
│   ├── storage/           files.ts (internas) · vault.ts (SAF) · store.ts · settings.ts
│   ├── lib/               markdown.ts · katex-css.ts (generado) · tree.ts
│   ├── theme/ · types/ · utils/
├── assets/                icon, splash, favicon, webeditor.html (editor VIVO, generado)
├── webeditor/             Proyecto de build del editor WYSIWYG (Milkdown Crepe) — no se compila
├── pdfviewer/             Proyecto de build del visor de PDF (pdf.js) — no se compila
├── plugins/               withCmakeVersion.js (fix rutas largas de Windows)
├── initials/              SOLO referencia (brand book, scaffold, assets) — no se compila
└── app.json · eas.json · metro.config.js · tsconfig.json · babel.config.js · .npmrc
```

Docs: **AGENTS.md** (arquitectura + gotchas) · **COMPILACION.md** (build) · **MARCA.md**.

## Funcionalidades

- **Vault**: abrir carpetas del teléfono (recursivo, subcarpetas) y editar los `.md`
  reales en sitio; **árbol** colapsable. (Solo almacenamiento local, no Drive.)
- **Todo el directorio en el árbol**, no solo los `.md`: PDF, imágenes y scripts se
  listan junto a las notas con su extensión como etiqueta (`PDF`, `PNG`, `SH`), y
  también aparecen las carpetas vacías. El árbol arranca **recogido**, abierto solo en
  la nota que estés viendo.
- **Visores propios, sin salir de la app**: PDF (pdf.js, offline), imágenes (con pinch
  y doble toque para acercar) y archivos de texto o scripts (con resaltado de sintaxis).
- **Enlaces a otras notas**: funcionan tanto `[[wikilinks]]` como los enlaces Markdown
  relativos de toda la vida (`[texto](OTRA.md)`), y también hacia un PDF de la carpeta.
- **Varias carpetas a la vez**: el árbol las separa por carpeta y, al crear o importar,
  la app pregunta en cuál va (ofreciendo primero la última que usaste). Cada carpeta es
  un mundo: sus imágenes, sus adjuntos y sus `[[enlaces]]` no se mezclan con los de otra.
- **Importar** archivos `.md` sueltos (incl. desde Drive: copia local), o abrirlos
  desde otra app con "Abrir con MDNotes" / compartir (se importa una **copia**: el
  intent no da permiso para editar el original en sitio).
- Notas internas cuando no hay carpeta abierta. Crear / editar / eliminar.
- **Guardado configurable**: autoguardado (con indicador "Guardando…/Guardado") o manual
  con botón "Guardar". Se elige en Ajustes. Si la escritura falla (carpeta no disponible,
  archivo borrado desde otra app) se avisa y el texto se queda en pantalla — nunca dice
  "Guardado" sin haber escrito.
- **Editor de 3 modos** (toggle VIVO/MD/VER):
  - **VIVO** — WYSIWYG inspirado en Typora (Milkdown Crepe): editas sobre el documento renderizado,
    con callouts de color, imágenes, tablas, código, mates.
  - **MD** — Markdown crudo + toolbar (H1–H6, negrita/cursiva/tachado/resaltado/limpiar,
    listas, checkbox, cita, código, tabla, callout, ecuación, imagen, link, regla).
  - **VER** — preview de solo lectura (WebView) con **callouts de color** (estilo GitHub),
    **KaTeX** (offline), **resaltado de sintaxis**, footnotes, tablas e imágenes (galería y
    **locales del vault** `./img/x.png`). Mismo motor que el **PDF**.
- **Enlaces internos** estilo Obsidian: `[[nota]]`, `[[nota|alias]]`, `![[imagen.png]]`.
  Se tocan para saltar a la nota, hay autocompletado al escribir `[[` y cada nota muestra
  al final quién la menciona (**backlinks**). Los enlaces a notas que no existen se ven
  apagados, no rotos a mitad de camino.
- **Tags editables** desde el editor (chips), guardados en **frontmatter YAML** (`---\ntags: [..]\n---`);
  también se derivan `#hashtags` del cuerpo. Portable (Obsidian). **Filtro por tag** en la biblioteca.
- Saltar de una nota a otra desde el editor (cajón ☰) sin volver a la biblioteca.
- Exportar a **PDF** (A4, **margen configurable**, sin cortar bloques entre páginas) y compartir el `.md`.
- **Imágenes** de galería redimensionadas y comprimidas. Con carpeta abierta se guardan como
  **archivo de la carpeta** (`adjuntos/`, o donde diga la config de Obsidian) y la nota solo
  lleva la ruta: el `.md` queda legible y portable. Sin carpeta, se incrustan en la nota.
- **Ajustes** (⚙): **carpeta de imágenes** (automática / junto a la nota / carpeta fija),
  **tema** (sistema/claro/oscuro), **tamaño** y **fuente** de lectura, autoguardado,
  margen del PDF. Búsqueda en contenido.

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

- [ ] Integración real con Google Drive (OAuth) para editar en la nube — grande
```
