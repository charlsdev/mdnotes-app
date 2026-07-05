# MDNotes — Logo & Assets

Logo editorial y todos los iconos para la app **MDNotes**.

## El concepto

Tratamiento **editorial** inspirado en cabeceras de revista y periódicos:
serif Fraunces, reglas horizontales, y contraste de peso entre "MD" (grueso,
presencia de masthead) y "Notes" (fino, elegante). El punto y la línea bermellón
son el acento de la marca — un guiño a la corrección editorial hecha a mano.

## Variantes de logo

| Variante | Archivo | Cuándo usarla |
|---|---|---|
| **A · Masthead** | `logo-masthead.svg` | Web header, splash, presentaciones formales. La más "revista". |
| **B · Stacked** | `logo-stacked.svg` | Cuando hay poco ancho. MD domina, con la línea del margen. |
| **C · Inline** | `logo-inline.svg` | Firmas, footers, contextos compactos. Refinada. |

Cada una viene en versión clara (`.svg`) y oscura (`-dark.svg`).

## Estructura

```
mdnotes-assets/
├── svg/                        # Vectoriales, texto trazado a curvas (no requieren fuente)
│   ├── logo-masthead.svg / -dark.svg
│   ├── logo-stacked.svg / -dark.svg
│   ├── logo-inline.svg / -dark.svg
│   ├── icon.svg / -dark.svg
│   └── adaptive-icon.svg
└── png/                        # Rasterizados listos para usar
    ├── logo-masthead.png / -dark.png
    ├── logo-stacked.png / -dark.png
    ├── logo-inline.png / -dark.png
    ├── icon.png                # 1024×1024 (Expo)
    ├── icon-dark.png
    ├── adaptive-icon.png       # transparente, para Android
    ├── favicon.png
    ├── ios-*.png               # 13 tamaños iOS
    └── android-*.png           # 6 tamaños Android + Play Store
```

## Instalar en tu proyecto Expo

```bash
cp png/icon.png            md-editor-app/assets/icon.png
cp png/adaptive-icon.png   md-editor-app/assets/adaptive-icon.png
cp png/favicon.png         md-editor-app/assets/favicon.png
```

Y actualiza el nombre en `app.json`:

```json
{
  "expo": {
    "name": "MDNotes",
    "slug": "mdnotes",
    ...
  }
}
```

## Los SVG son 100% editables

El texto está convertido a curvas (`<path>`), así que se ven idénticos en
cualquier máquina sin necesidad de instalar Fraunces. Para editarlos, ábrelos
en Figma, Illustrator o Inkscape. Si quieres reeditar el texto como texto
(no curvas), instala Fraunces desde https://fonts.google.com/specimen/Fraunces
y regenera con `generate_logos.py`.

## Colores

- Tinta: `#1a1714`
- Papel: `#f5f1ea`
- Nocturno: `#12100e`
- Bermellón: `#c14a2b`
- Muted: `#8a8275`

## Tipografía

- **Fraunces** (display serif) — logo, títulos. Pesos: Black (900) para "MD", Light (340) para "Notes".
- **Monospace** — kickers y metadata (`ESTABLISHED 2026`, `MARKDOWN EDITOR`).
