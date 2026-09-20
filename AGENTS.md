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
  settings.tsx       Ajustes: tema, lectura, autoguardado, carpeta de imágenes, margen del PDF
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
  carpeta abierta; `vaultId` = cuál de las carpetas abiertas la contiene. Editar/crear/
  borrar opera sobre el `.md` real.

El `store` es **vault-aware**: si `file.uri` existe → operación SAF; si no → interna.
Ambas se muestran mezcladas. Al crear/importar con un vault abierto, el archivo se
escribe **dentro** de la carpeta.

### `MdFile.content` en el store es una copia LIGERA (no la guardes)
La lista mantiene el texto con los **base64 de las imágenes elididos** (`elideDataUris`
en `src/utils/text.ts`): una nota con fotos pesa KB de texto en memoria en vez de MB.
Alcanza para listar, buscar, derivar tags/preview y el árbol.
- El editor **relee el archivo completo del disco al abrir la nota** (`readContent` del
  store) y compara contra `savedRef` para saber si hay cambios — NO contra `file.content`.
  Escribir la copia ligera al disco **corrompería el `.md`** (perdería las imágenes).
- Efecto secundario bueno: al abrir una nota se toman las ediciones hechas fuera de la
  app (Obsidian, PC) sin necesidad de reabrir la carpeta.
- Si la relectura falla (archivo movido/borrado desde otra app) el editor avisa y vuelve;
  nunca cae al contenido del store.

### Errores de escritura: `upsert`/`remove` LANZAN
El `set` de zustand ocurre **después** de que la escritura tuvo éxito. El editor hace
`await upsert(...)` dentro de `try/catch`: si falla, marca `dirty`, muestra el error y
**no navega** (salir perdería el texto). No vuelvas al patrón optimista sin `await`:
decía "Guardado" con el archivo intacto.

### Vault (Storage Access Framework) — `src/storage/vault.ts`
- "Abrir carpeta" → `requestDirectoryPermissionsAsync` (el picker deja elegir
  CUALQUIER carpeta del teléfono: interno, Descargas, Documentos, SD). El permiso
  se **persiste** en AsyncStorage, sobrevive reinicios.

### Varias carpetas a la vez
El store tiene `vaults: VaultRef[]` (`{id, uri, name}`, `id = vaultIdForUri(raíz)`),
persistido como JSON en `mdnotes:vaults`. `getVaultUris()` **migra** la clave vieja de una
sola carpeta (`mdnotes:vault-uri`) la primera vez y la borra.
- Cada nota lleva `vaultId`. Eso define **cuatro** cosas, y mezclarlas es el error a
  evitar: dónde se crea, dónde van sus adjuntos, contra qué índice de imágenes se
  resuelve y hasta dónde llegan sus `[[enlaces]]`.
- **Los enlaces NO cruzan carpetas** (`buildLinkIndex(vaultFiles)` en el editor). Un
  enlace que funcione acá pero no en Obsidian sería peor que uno roto: en Obsidian un
  vault es un mundo cerrado.
- `vaultImages` es `Record<vaultId, Record<relPath, uri>>`. Con un índice plano, dos
  carpetas con un `img/logo.png` cada una mostrarían la imagen equivocada.
- **Notas nuevas**: con más de una carpeta abierta la biblioteca PREGUNTA destino
  (`chooseVault`, con la última usada primero; `lastVaultId` se persiste). Importar
  pregunta igual. La excepción es abrir un `.md` desde otra app: ahí va a la última
  usada sin preguntar, porque el usuario espera ver el archivo, no un diálogo.
- Si una carpeta no se puede leer al arrancar (permiso perdido), se descarta **solo
  esa** y el resto carga igual.
- **PDF e imágenes se listan** junto a las notas (`kind: 'pdf' | 'image'`, sin contenido
  ni tags) y al tocarlos los abre el **visor del teléfono** (`openWithSystemViewer` →
  `expo-intent-launcher` con `ACTION_VIEW` + `FLAG_GRANT_READ_URI_PERMISSION`; sin ese
  flag el visor recibe la URI SAF pero no puede leerla, por eso no sirve `Linking`).
  `isNote()` los separa: no entran al editor, ni al cajón, ni al índice de enlaces, ni
  a la cuenta de "N notas".
  - Las imágenes van **doblemente registradas**: en `images` (resuelve las referencias
    de las notas) y como fila del árbol. Sin la fila, una carpeta llena de fotos se
    vería VACÍA ahora que se listan todas las carpetas.
  - La fila se distingue con la **extensión en mayúsculas** (`fileBadge`), no con un
    ícono por tipo: es honesto sobre qué es el archivo y se generaliza solo.
  - Los límites del escaneo van separados (`MAX_NOTES` 1000 / `MAX_ENTRIES` 5000): si
    todo contara junto, una carpeta con miles de fotos dejaría NOTAS afuera.
- **Todas las carpetas se listan**, incluidas las que no tienen notas (`img/`, `bash/`).
  `VaultScan.folders` las junta durante el escaneo (que ya las recorría) y el árbol las
  muestra aunque estén vacías — como hace Obsidian. Con un filtro activo NO se pasan:
  filtrando, el árbol debe mostrar lo que coincide, no la estructura entera.
- El **árbol** antepone una raíz por carpeta solo cuando hay más de una
  (`buildTreeRows(notes, collapsed, groups)`); con una sola se ve como siempre. Los
  estados de colapso van prefijados por carpeta: dos vaults con un `README` cada uno
  no comparten colapso (hay casos de prueba para eso).
- El escaneo es por carpeta y secuencial: N carpetas grandes = N veces el arranque.
  Es el motivo más fuerte para hacer el escaneo incremental por `mtime`.
- **Escaneo RECURSIVO**: lee los `.md` de la carpeta y subcarpetas (cap depth 8 /
  1000 archivos). Detecta subcarpeta con heurística (sin extensión → intenta listar).
- **Fechas reales**: el escaneo toma `modificationTime` del archivo con la API NUEVA de
  `expo-file-system` (`new File(uri).modificationTime`, propiedad **síncrona** que sí
  funciona sobre `content://`; la legacy `getInfoAsync` no la expone). Si el proveedor no
  la da → `0` y la UI **no muestra hora** (`relativeTime` devuelve `''`). NO vuelvas a
  poner `Date.now()` en el escaneo: mostraba "ahora" en archivos de hace años.

### GOTCHA CRÍTICO: SAF no trunca al escribir (texto duplicado al final)
`FileSystem.writeAsStringAsync` sobre una URI SAF termina en
`contentResolver.openOutputStream(uri)`, o sea modo **`"w"`**, que en
`ExternalStorageProvider` **NO trunca** el archivo. Al guardar un texto más corto que el
anterior, la **cola del contenido viejo queda pegada al final** del `.md` — y reaparece en
VIVO, MD y VER porque está en el archivo, no en el render. Desde JS no se puede pedir
modo `"wt"`.
- `writeVaultFile` (`src/storage/vault.ts`) lo compensa: escribe, compara el tamaño real
  (`new File(uri).size`) contra `utf8Length(content)` y, si sobra, **borra y recrea** el
  archivo. El orden importa — primero escribir (el archivo nunca queda vacío ni a medias),
  después recrear.
- En los proveedores locales el document id se deriva de la ruta, así que el archivo
  recreado conserva la **misma URI** (y por tanto el mismo id de nota). Aun así `upsert`
  guarda la URI que devuelve la función, por si cambiara.
- Se recrea **solo** con `.md`/`.txt` (mimes que Android reconstruye sin renombrar). Con
  `.markdown`/`.mdx` se prefiere dejar la cola antes que renombrar el archivo del usuario.
- Por eso `MdFile.dirUri` (la carpeta contenedora) se guarda en el escaneo: hace falta
  para recrear. Sin él se deriva del document id (`parentDirUri`).
- Antes de borrar se confirma la cola **leyendo el archivo** (el `size` del proveedor
  puede mentir y lo que sigue es destructivo) y se deja el texto en un
  `recover-<ts>.md` del almacenamiento interno, que se borra al terminar bien. Si la
  recreación falla, el error dice dónde quedó.
- **Las escrituras van EN COLA** (`queued()` en `store.ts`): entre el borrado y la
  recreación el `.md` no existe, y un segundo guardado cayendo en ese hueco falla con
  `Location '…' isn't writable` — que es, confusamente, lo que SAF responde cuando el
  documento NO EXISTE (`DocumentFile.canWrite()` consulta el mime; sin archivo, `false`).
  Pasaba de verdad: el autoguardado con debounce y el `flushSave` al salir/saltar de nota
  se solapaban. El editor además no reenvía al disco un texto que ya está escribiéndose
  (`savingContentRef`). NO quites ninguna de las dos protecciones.

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
  **expo-image-manipulator**. Con carpeta abierta se guardan como **archivo real del vault**
  y la nota solo lleva la ruta (ver abajo); sin vault —o si la escritura falla— caen al
  **data URI JPEG** incrustado, que siempre funciona.

### Adjuntos: archivo del vault, no base64
Incrustar la foto en el `.md` lo vuelve ilegible fuera de la app (en Obsidian de escritorio
es un muro de base64) y engorda cada escaneo. Por eso, con vault abierto:
- `saveVaultImage()` (`vault.ts`) escribe el JPEG en la carpeta de adjuntos y **devuelve la
  ruta derivada de la URI que dio el proveedor**, no del nombre que pedimos: Android puede
  cambiarlo (`foto (1).jpg`) y la nota tiene que enlazar el nombre REAL.
- **Dónde va el adjunto**, en orden: (1) el **ajuste de la app** si no está en automático
  (`attachmentFolderFromSetting`: `auto` | `note` = junto a la nota | `vault` = carpeta fija;
  ver `— CARPETA DE IMÁGENES` en Ajustes); (2) `.obsidian/app.json` → `attachmentFolderPath`
  si el vault es de Obsidian (`/`, `x`, `./`, `./x` — `attachmentFolderFromConfig`); (3) la
  convención que YA usa el vault, deducida de las imágenes indexadas
  (`inferAttachmentFolder`: si las notas guardan en `img/` junto a la nota, la foto nueva
  cae ahí); (4) `adjuntos/`. Los pasos 2-3 existen para no plantar una segunda carpeta de
  adjuntos al lado de la que el usuario ya usaba; el 1, porque deducir es adivinar y el
  usuario tiene que poder decirlo. Los segmentos que falten se crean, reusando la carpeta
  si ya existe (crear a ciegas daría `adjuntos (1)`).
- **`''` es un valor válido** (la raíz del vault) en toda esta cadena: compara contra `null`,
  nunca por falsy, o "carpeta fija vacía" terminaría cayendo al default.
- Se enlaza con **Markdown estándar y ruta relativa a la nota** (`![imagen](../adjuntos/x.jpg)`),
  no con `![[x.jpg]]`: funciona igual en Obsidian y además fuera de él. `relativeTo()` calcula
  la ruta y `resolveRel()` la deshace — son inversas, y hay round-trips que lo prueban.
- El adjunto nuevo se registra en `vaultImages` (`addVaultImage`) para que el preview lo
  resuelva sin re-escanear la carpeta.
- Las notas viejas con base64 siguen funcionando (nada las migra automáticamente).
- **Las referencias que ya existen NO se tocan.** `createImageResolver` (`lib/paths.ts`)
  resuelve lo que haya escrito en la nota: `./img/x.png`, `img/x.png`, `../x.png`, el
  `%20` de los espacios, las **barras invertidas de Windows** (`.\img\x.png`) y, como
  último recurso, por nombre de archivo (que es como Obsidian resuelve `![[x.png]]`).
  Hay casos de prueba para cada forma en `scripts/render-cases.ts`.
- **Imágenes locales del vault** (`![](./img/x.png)` o `<img src>`): el escaneo indexa las
  imágenes (`VaultScan.images`: relPath→uri) y el editor las resuelve a data URI antes del
  preview/PDF (`inlineLocalImages` en `editor/[id].tsx` devuelve `{md, restore}`;
  `readImageDataUri` lee SAF en base64). Maneja `./`, `../` y `\` de Windows.

## Enlaces internos (wikilinks, estilo Obsidian)

`[[nota]]`, `[[nota|alias]]`, `[[nota#sección]]` y el embed `![[archivo]]`.
Lógica de resolución en `src/lib/wikilinks.ts`; el render, en el plugin `wikilinks` de
`markdown.ts`.

- Es una **regla inline de markdown-it**, NO un reemplazo de texto sobre el markdown: así
  un `[[` dentro de un bloque de código (o de código inline) se queda como está. No lo
  cambies por un `.replace()` global — rompería los ejemplos de código de las notas.
- **Resolución** (`resolveWikilink`): ruta desde la raíz del vault → ruta relativa a la
  carpeta de la nota → nombre suelto. Ante nombres repetidos gana la nota menos anidada,
  con desempate alfabético, para que sea estable entre escaneos. Sin match → se pinta como
  enlace roto (`.wikilink-broken`), nunca como `<a>`.
- **GOTCHA: el preview NUNCA debe navegar** (si no, queda EN BLANCO). El documento entra
  por `source={{html}}`, cuyo base URL en Android es `about:blank`: **cualquier**
  navegación —incluido un simple `#`— reemplaza la página por una vacía. Por eso:
  - Los enlaces internos son `<span class="wikilink" data-note="…">`, **nunca `<a href>`**.
    Un `href="#"` dejaba el preview en blanco cuando el tap no quedaba interceptado.
  - El script del documento también intercepta las **anclas internas** (`<a href="#fn1">`
    de las notas al pie) y salta con `scrollIntoView` en vez de navegar.
  - `onShouldStartLoadWithRequest` solo deja pasar la carga inicial (`about:blank`/`data:`);
    los `http(s)` se abren fuera con `Linking` y todo lo demás se rechaza.
  - El tap avisa a RN con `postMessage({type:'open-note', id})` → `onOpenNote` → `switchTo`
    (que guarda lo pendiente antes de saltar).
- En el **PDF** no se inyecta ni el script ni los backlinks.
- **Backlinks** ("Mencionada en"): `backlinksFor()` sobre la copia ligera del store (los
  wikilinks son texto, así que alcanza) y se inyectan al final del HTML del preview.
- **Embeds de imagen**: `![[foto.png]]` se resuelve contra el índice del vault. Obsidian
  referencia los adjuntos **por nombre**, sin ruta, así que `inlineLocalImages` indexa
  también por basename además de por ruta relativa.
- **Autocompletado**: al escribir `[[` en modo MD aparece `WikilinkSuggestions` sobre la
  toolbar. Inserta el nombre suelto si no es ambiguo y la ruta completa si lo es
  (`shortestLinkLabel`), igual que Obsidian.
- VIVO muestra los enlaces como texto plano (Crepe no los conoce); lo importante es que
  **no los corrompa** al reserializar — de eso se encarga `unescapeMarkers`.

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
  `unescapeMarkers()` en `mdToBody` (des-escapa al renderizar) + `onLiveChange` (limpia el .md).
  Esa misma función arregla los enlaces internos (`\[\[nota]]`), que Crepe escapa igual.
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
  recarga al cambiar `id` (ref `loadedId`). Si el guardado falla **no navega**.
  - **GOTCHA VIVO**: el efecto que alimenta a Crepe NO puede depender de `content` (haría
    re-feed en cada tecla), así que lee `contentRef.current` y depende de `ready`. El
    `contentRef` se sincroniza en un efecto declarado **antes** — los efectos corren en
    orden de declaración y, si no, al saltar de nota VIVO recibiría el texto de la
    anterior (y lo guardaría en el archivo nuevo).
- **Abrir un `.md` desde otra app** ("Abrir con MDNotes" / compartir): los intent filters
  están en `app.json` y el handler en `app/index.tsx` (`Linking.getInitialURL` +
  listener `url`). La URI del intent trae permiso de **solo lectura y no persistible**,
  así que NO se puede editar en sitio: se importa una **copia** (dentro del vault si hay
  carpeta abierta). El nombre sale de la URI y, si el proveedor usa ids opacos
  (Descargas: `msf:1000000123`), del primer título del contenido.
- **Ajustes** (`app/settings.tsx`, engrane ⚙ en la biblioteca): store `settings.ts`
  (zustand + AsyncStorage `mdnotes:settings`, cargado en `_layout`). Opciones: margen del PDF,
  autoguardado, **tema** (`system|light|dark` → `useEffectiveScheme()` en `src/theme`, respetado
  por `useTheme`/`_layout`/`MarkdownPreview`), **tamaño de lectura** (`readingScale` → font-size
  en VER `mdToHtml(..,{scale})`, editor MD, y VIVO via bridge `setScale`), **fuente de lectura**
  (`readingFont` sans/serif/mono → solo VER, `mdToHtml(..,{fontStack})`), **carpeta de
  imágenes** (`attachmentMode` + `attachmentFolder` → ver "Adjuntos"; el campo solo aparece
  fuera del modo automático, y el pie explica en concreto dónde terminará la foto). Encima
  del campo van **chips con las carpetas que ya existen** (`folderSuggestions`, sacadas del
  índice de imágenes y de las carpetas de las notas) y debajo un aviso si lo tipeado no
  coincide con ninguna: **un typo acá no falla, CREA una carpeta nueva**, así que hay que
  avisarlo antes, no después.
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
- `node scripts/check-render.mjs` ejercita contra los módulos reales el render de enlaces
  internos (resolución, backlinks, embeds, y que el código dentro de ``` ``` `` NO se
  convierta en enlace) y las rutas de adjuntos (incluido el round-trip
  `relativeTo` ↔ `resolveRel`). Córrelo si tocas `markdown.ts`, `wikilinks.ts` o
  `paths.ts`; `tsc` no ve nada de eso. Necesita el esbuild de `webeditor/`.
- Lo que NINGUNA de las tres cosas cubre y hay que probar en el teléfono: escritura SAF
  (truncado/recreación), el puente del WebView, y el editor VIVO.
