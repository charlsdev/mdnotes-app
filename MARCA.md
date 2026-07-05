# MDNotes · Manual de Marca

> Notas y Markdown. Editorial, offline-first, con vault:
> abres una carpeta del teléfono y editas tus `.md` reales en sitio.
> Tus archivos son tuyos.

---

## 00 · Índice

1. Esencia
2. Nombre y logo
3. Color
4. Tipografía
5. Iconografía
6. El editor
7. Voz y tono
8. Créditos

---

## 01 · Esencia

**MDNotes es un cuaderno, no una nube.**

La mayoría de apps de notas te encierran: tu texto vive en su servidor, en su formato,
bajo sus reglas. MDNotes hace lo contrario. Abres una carpeta del teléfono y editas los
`.md` que ya tienes — planos, portables, tuyos. Como Obsidian o Typora, pero en el bolsillo.

Tres ideas sostienen la marca:

1. **La escritura es una conversación con el texto.** No un capturador de palabras: un lugar para pensar.
2. **Menos cromo, más tinta.** Nada de gradientes ni efectos. Tipografía, espacio y una gota de color.
3. **Los archivos son tuyos.** `.md` plano, en tu disco, portable a cualquier otro editor. Sin cárceles de datos.

### El sentimiento

Papel cálido y tinta cálida. Una revista bien compuesta abierta sobre una mesa de madera.
La calma de una página en blanco que no te apura. Lo contrario de un dashboard.

---

## 02 · Nombre y logo

### Nombre

**MDNotes** — se escribe siempre así, sin espacio, con "MD" y "N" en mayúscula.
Nunca "Mdnotes", "md notes" ni "MD Notes".

El tratamiento es **editorial**: "MD" en peso alto (presencia de cabecera de revista) y
"Notes" en peso fino, con una línea vertical y un punto bermellón al margen — el guiño a
la corrección editorial hecha a mano.

### Wordmark

Implementado en `src/components/Wordmark.tsx`. Tres tratamientos según el contexto:

| Variante | Cuándo usarla |
|---|---|
| **Masthead** | Web header, splash, presentaciones. Reglas dobles arriba y abajo, la más "revista". |
| **Stacked** | Espacios cuadrados o estrechos. "MD" domina, con la línea del margen bermellón. |
| **Inline** | Firmas, footers, contextos compactos. "MD" bold + "Notes" regular + punto final bermellón. |

### Símbolo

El monograma es la **"M" en Fraunces Black** con una regla editorial debajo y el punto
bermellón a la derecha — como el punto final de un artículo. Funciona a 1024 px y sigue
legible a 40 px en la barra de estado.

### Zona de seguridad

Alrededor del logo, deja libre como mínimo la altura de la "M". Nunca lo inclines,
distorsiones, le añadas sombras ni degradados.

---

## 03 · Color

**Bermellón es el único acento de la interfaz.** Sin azul, verde ni morado en la UI. Un solo
color de énfasis en toda la app hace que cada aparición pese más.

Paleta en `src/theme/index.ts`.

| Token | Claro | Oscuro | Rol |
|---|---|---|---|
| `bg` | `#f5f1ea` (papel) | `#12100e` (nocturno) | Fondo. Nunca blanco ni negro puro. |
| `bg2` | `#e8e0d0` | `#1c1a16` | Superficies elevadas, píldoras. |
| `ink` | `#1a1714` | `#f5f1ea` | Texto principal. |
| `muted` | `#8a8275` | `#8a8275` | Secundario, timestamps. |
| `accent` | `#c14a2b` | `#c14a2b` | Link, FAB, énfasis, nota abierta. |
| `sepia` | `#8a7355` | `#8a7355` | Tags, callouts nota/consejo. |
| `line` | `#d8d2c5` | `#2a2620` | Divisores, bordes hairline. |

### Reglas

- **Tinta nunca es negro puro** (`#000`). Demasiado duro contra el papel cálido.
- **Papel nunca es blanco puro** (`#fff`). El fondo cálido evita el brillo azulado que cansa la vista.
- **Bermellón** se reserva para lo que importa: un link, el botón primario, la nota abierta, el FAB.
- **Sepia** para tags y callouts de tipo nota/consejo, para que no compitan con el bermellón.

### La excepción · callouts estilo GitHub

Los callouts (`> [!NOTE]`, `> [!TIP]`, etc.) son la única excepción consciente al
monocromático: heredan el código de color de GitHub para que quien ya escribe Markdown los
reconozca al instante. Fuera de los callouts, la regla del acento único sigue firme.

| Tipo | Color |
|---|---|
| NOTE | Azul `#4493f8` |
| TIP | Verde `#3fb950` |
| IMPORTANT | Morado `#ab7df8` |
| WARNING | Ámbar `#d29922` |
| CAUTION | Rojo `#f85149` |

### Contraste claro / oscuro

El modo oscuro no es solo invertir. Papel `#f5f1ea` sobre nocturno `#12100e`; las tarjetas
suben a `#1c1a16`; las líneas a `#2a2620`. El bermellón se mantiene idéntico en ambos —
es la constante de la marca.

---

## 04 · Tipografía

Tres familias, cargadas vía `@expo-google-fonts`. La asimetría es intencional: el editor
es monospace ("hacer"), el preview es serif + sans ("leer").

### Fraunces — Display

Títulos, nombres de archivo, H1/H2 del preview, el wordmark. Serif con carácter y buen
contraste de trazo. En el logo: **Black (900)** para "MD", **Light (340)** para "Notes".

### Inter Tight — UI

Cuerpo de interfaz, listas, botones, párrafos del preview. Limpia y neutra, aguanta textos
largos sin cansar.

### JetBrains Mono — Editor y metadata

El editor de Markdown, timestamps, labels de sección (`— SECCIÓN`), bloques de código.
Monoespaciada: cada carácter en su sitio, como debe verse el código fuente de un `.md`.

### Jerarquía

| Uso | Fuente | Tamaño | Peso |
|---|---|---|---|
| Hero / título | Fraunces | 28–32 px | 500–600 |
| H2 preview | Fraunces | 22 px | 500 |
| Nombre de archivo | Inter Tight | 15 px | 500 |
| Cuerpo | Inter Tight | 15 px | 400 |
| Editor (código MD) | JetBrains Mono | 15 px | 400 |
| Label `— SECCIÓN` | JetBrains Mono | 10 px | 500 |
| Timestamp | JetBrains Mono | 11 px | 400 |

---

## 05 · Iconografía

### App icon

`assets/icon.png` — el símbolo "M" en tinta oscura sobre papel, a sangre completa.

> **Gotcha de MIUI/Xiaomi:** MIUI ignora `adaptiveIcon.backgroundColor` y mete el ícono en
> una plaquita blanca. Por eso la capa frontal del adaptativo usa el mismo `icon.png`
> (la "M" en tinta sobre papel) — legible en cualquier launcher. No volver al
> `adaptive-icon.png` crema, que se ve invisible sobre blanco.

### Splash

El símbolo cuadrado centrado.

> **Gotcha de Android 12+:** recorta los logos anchos (el masthead salía "MDNo"). Por eso
> el splash usa el símbolo cuadrado `icon.png` centrado, no el wordmark horizontal.

### Assets fuente

`initials/mdnotes-assets/` — SVG (texto trazado a curvas, independiente de la fuente) y PNG
en todos los tamaños de iOS y Android.

---

## 06 · El editor

**Typora en el bolsillo: el mismo texto, tres modos.** Un toggle en la barra superior cambia
entre ellos según lo que necesites.

- **VIVO** — WYSIWYG en vivo tipo Typora (Milkdown Crepe). Editas sobre el documento ya
  renderizado: negritas, títulos, callouts de color, tablas, código y mates, todo en su sitio.
- **MD** — Markdown crudo en monospace con la toolbar completa. Control byte a byte, para
  cuando quieres exactamente ese `.md` sin reformateo automático.
- **VER** — preview de solo lectura, el mismo motor que genera el PDF.

**Un motor, dos salidas.** El modo VER y el export PDF comparten la misma función de render
(`mdToHtml`). Por eso la pantalla y el PDF son idénticos: lo que ves es lo que exportas.

### Tu forma de leer · ajustes

- **Tema** — sistema, claro u oscuro. El bermellón no cambia; sí el papel y la tinta.
- **Tamaño** — escala de lectura ajustable en VER, editor MD y VIVO.
- **Fuente** — sans, serif o monospace para el modo lectura.
- **Tags** — chips editables desde el editor, guardados en frontmatter YAML
  (`---\ntags: [a,b]\n---`); también se derivan de `#hashtags` del cuerpo. Portables a
  Obsidian, con filtro por tag en la biblioteca.

---

## 07 · Voz y tono

**Habla como un buen editor.**

Concreta y cálida sin cursi. Da lo esencial, sin adornos. El español es neutro. Sin emojis
en la interfaz. La calidez viene de la claridad, no de la efusividad.

### ✓ Hacer

- "Nueva nota"
- "Guardado"
- "No pudimos sincronizar. Reintentando."
- "Aún no hay notas. Toca el + para empezar."
- "Esta carpeta está en Google Drive. Usa Importar para editarla."

### ✗ Evitar

- ~~"Comenzar una nueva entrada"~~
- ~~"Procesando su solicitud…"~~ (palabrería; "Guardando…/Guardado" sí sirve)
- ~~"¡Ups! Algo salió mal 😕"~~
- ~~"¡No tienes notas aún! ¡Crea una!"~~
- ~~"Lo sentimos mucho, ha habido un problemita 😢"~~

### Principios de redacción

1. **Di el estado, no discurses.** "Guardando…" y luego "Guardado" informa en una palabra; "Procesando su solicitud…" sobra.
2. **Concreto antes que genérico.** "Nueva nota", no "Comenzar una nueva entrada".
3. **Cero emojis en la UI.** La marca se sostiene con tipografía y color, no con caritas.
4. **Tutea, con calma.** MDNotes es tu cuaderno, no una empresa que te habla.
5. **Español neutro.** Nada de regionalismos que dejen fuera a nadie.

> Nota para el código: el texto user-facing (UI, errores, alertas) va en **español neutro**;
> variables, comentarios técnicos, commits y PRs van en **inglés**.

---

## 08 · Créditos

**Diseñado por charlsdev** — Carlos A. Villacreses · Full Stack Developer

Este manual de marca fue creado siguiendo el sistema de identidad personal de charlsdev:
estética editorial, atención al detalle, y la convicción de que una app de notas también
merece un buen diseño. La atribución "por charlsdev" (→ charlsdev.xyz) es fija en la app
(`src/components/Footer.tsx` + `CharlsdevMark.tsx`) y no se retira.

| | |
|---|---|
| **Versión** | 1.1 |
| **Año** | 2026 |
| **Autor** | charlsdev (Carlos A. Villacreses) |
| **Producto** | MDNotes |

---

*MDNotes · Brand Book · v1.1 · 2026 · by charlsdev*
