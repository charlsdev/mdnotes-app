# MDNotes — Marca aplicada

Resumen de la marca **tal como está implementada** en la app. El brand book completo
(exploratorio, usa el nombre viejo "Marginalia" — ignóralo) está en `initials/brand.md`.

## Nombre
**MDNotes** — tratamiento editorial: "MD" grueso + "Notes" fino, con una línea vertical
y un punto bermellón al margen. Wordmark en `src/components/Wordmark.tsx`.

## Paleta (`src/theme/index.ts`)

Bermellón es el **ÚNICO** acento. Sin azul/verde/morado para nada.

| Token | Claro | Oscuro | Rol |
|---|---|---|---|
| `bg` (papel/nocturne) | `#f5f1ea` | `#12100e` | Fondo (nunca blanco/negro puro) |
| `bg2` | `#e8e0d0` | `#1c1a16` | Superficies elevadas / píldoras |
| `ink` (tinta) | `#1a1714` | `#f5f1ea` | Texto principal |
| `muted` | `#8a8275` | `#8a8275` | Secundario, timestamps |
| `accent` (bermellón) | `#c14a2b` | `#c14a2b` | Link, FAB, énfasis, nota abierta |
| `sepia` | `#8a7355` | `#8a7355` | Tags, callouts nota/consejo |
| `line` | `#d8d2c5` | `#2a2620` | Divisores, bordes |

## Tipografía (vía `@expo-google-fonts`)

- **Fraunces** — display: títulos, nombres, H1/H2 del preview.
- **Inter Tight** — UI: cuerpo, listas, botones.
- **JetBrains Mono** — editor, timestamps, labels `— SECCIÓN`, código.

La asimetría es intencional: el editor es monospace ("hacer"), el preview serif+sans ("leer").

## Íconos

- **App**: `assets/icon.png` (símbolo "M" en tinta sobre papel). En Android adaptativo,
  la capa frontal usa ese mismo `icon.png` porque MIUI ignora el color de fondo (ver AGENTS.md).
- **Splash**: el símbolo cuadrado centrado (Android 12 recorta logos anchos).
- Assets fuente: `initials/mdnotes-assets/` (svg + png en todos los tamaños).

## Voz
Concreta y cálida sin cursi. Español neutro. Sin emojis en la UI. "Nueva nota" mejor que
"Comenzar una nueva entrada"; "Guardado" (pasado) no "Guardando…".

## Atribución
Footer "por charlsdev" → charlsdev.xyz, **fijo** en todas las apps del usuario
(`src/components/Footer.tsx` + `CharlsdevMark.tsx`). No se quita.
