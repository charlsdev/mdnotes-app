"""
Genera SVGs de los logos con el texto convertido a paths (curvas),
para que sean independientes de la fuente y escalables sin pérdida.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from pathlib import Path

SVG = Path('/home/claude/mdnotes-assets/svg')
SVG.mkdir(parents=True, exist_ok=True)

FONTS = {
    'black': '/tmp/fonts/Fr-Black.ttf',
    'bold': '/tmp/fonts/Fr-Bold.ttf',
    'medium': '/tmp/fonts/Fr-Medium.ttf',
    'light': '/tmp/fonts/Fr-Light.ttf',
    'regular': '/tmp/fonts/Fr-Regular.ttf',
}

_cache = {}
def load(weight):
    if weight not in _cache:
        _cache[weight] = TTFont(FONTS[weight])
    return _cache[weight]


def text_to_path(text, weight, font_size):
    """Convierte texto a un path SVG. Devuelve (path_d, ancho_total)."""
    font = load(weight)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    units_per_em = font['head'].unitsPerEm
    scale = font_size / units_per_em

    hmtx = font['hmtx']
    paths = []
    x_offset = 0

    for ch in text:
        glyph_name = cmap.get(ord(ch))
        if glyph_name is None:
            continue
        pen = SVGPathPen(glyph_set)
        glyph = glyph_set[glyph_name]
        glyph.draw(pen)
        d = pen.getCommands()
        if d:
            # Transformar: escalar y posicionar. SVG Y crece hacia abajo,
            # las fuentes crecen hacia arriba, así que invertimos Y.
            paths.append(
                f'<path d="{d}" transform="translate({x_offset:.2f},0) '
                f'scale({scale:.5f},{-scale:.5f})"/>'
            )
        advance = hmtx[glyph_name][0]
        x_offset += advance * scale

    return ''.join(paths), x_offset


INK = '#1a1714'
PAPER = '#f5f1ea'
NOCTURNE = '#12100e'
VERMILION = '#c14a2b'
MUTED = '#8a8275'


# ============ VARIANTE A: MASTHEAD ============
def build_masthead(dark=False):
    bg = NOCTURNE if dark else PAPER
    fg = PAPER if dark else INK

    md_path, md_w = text_to_path('MD', 'black', 130)
    notes_path, notes_w = text_to_path('Notes', 'light', 130)
    total = md_w + notes_w
    start_x = 600 - total / 2
    baseline = 320

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500" width="1200" height="500">
  <rect width="1200" height="500" fill="{bg}"/>
  <text x="600" y="137" font-family="monospace" font-size="18" fill="{VERMILION}" text-anchor="middle" letter-spacing="6">ESTABLISHED 2026</text>
  <line x1="180" y1="165" x2="1020" y2="165" stroke="{fg}" stroke-width="3"/>
  <line x1="180" y1="172" x2="1020" y2="172" stroke="{fg}" stroke-width="1"/>
  <g fill="{fg}">
    <g transform="translate({start_x:.2f},{baseline})">{md_path}</g>
    <g transform="translate({start_x + md_w:.2f},{baseline})">{notes_path}</g>
  </g>
  <line x1="180" y1="355" x2="1020" y2="355" stroke="{fg}" stroke-width="1"/>
  <line x1="180" y1="362" x2="1020" y2="362" stroke="{fg}" stroke-width="3"/>
  <text x="600" y="405" font-family="monospace" font-size="16" fill="{MUTED}" text-anchor="middle" letter-spacing="3">MARKDOWN · NOTES · PREVIEW</text>
</svg>'''
    return svg


# ============ VARIANTE B: STACKED ============
def build_stacked(dark=False):
    bg = NOCTURNE if dark else PAPER
    fg = PAPER if dark else INK

    md_path, md_w = text_to_path('MD', 'black', 150)
    notes_path, notes_w = text_to_path('Notes', 'light', 88)
    line_x = 400

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500" width="1200" height="500">
  <rect width="1200" height="500" fill="{bg}"/>
  <rect x="{line_x}" y="150" width="6" height="200" rx="3" fill="{VERMILION}"/>
  <circle cx="{line_x + 3}" cy="138" r="6" fill="{VERMILION}"/>
  <g transform="translate({line_x + 45},285)" fill="{fg}">{md_path}</g>
  <g transform="translate({line_x + 55 + md_w:.2f},250)" fill="{VERMILION}">{notes_path}</g>
  <text x="{line_x + 48}" y="330" font-family="monospace" font-size="17" fill="{MUTED}" letter-spacing="2">ESCRIBE · LEE · PREVISUALIZA</text>
</svg>'''
    return svg


# ============ VARIANTE C: INLINE ============
def build_inline(dark=False):
    bg = NOCTURNE if dark else PAPER
    fg = PAPER if dark else INK

    md_path, md_w = text_to_path('MD', 'bold', 120)
    notes_path, notes_w = text_to_path('Notes', 'regular', 120)
    total = md_w + notes_w
    start_x = 600 - total / 2
    baseline = 235
    dot_x = start_x + total + 18

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <rect width="1200" height="400" fill="{bg}"/>
  <g fill="{fg}">
    <g transform="translate({start_x:.2f},{baseline})">{md_path}</g>
    <g transform="translate({start_x + md_w:.2f},{baseline})">{notes_path}</g>
  </g>
  <circle cx="{dot_x + 10:.2f}" cy="{baseline - 12}" r="10" fill="{VERMILION}"/>
  <line x1="{start_x:.2f}" y1="270" x2="{start_x + total + 38:.2f}" y2="270" stroke="{MUTED}" stroke-width="1"/>
  <text x="{start_x:.2f}" y="295" font-family="monospace" font-size="15" fill="{MUTED}">MARKDOWN EDITOR</text>
  <text x="{start_x + total + 38:.2f}" y="295" font-family="monospace" font-size="15" fill="{VERMILION}" text-anchor="end">v0.1</text>
</svg>'''
    return svg


# ============ ÍCONO ============
def build_icon(dark=False, adaptive=False):
    if adaptive:
        bg_rect = ''
        fg = PAPER
    elif dark:
        bg_rect = f'<rect width="1024" height="1024" fill="{NOCTURNE}"/>'
        fg = PAPER
    else:
        bg_rect = f'<rect width="1024" height="1024" fill="{PAPER}"/>'
        fg = INK

    m_path, m_w = text_to_path('M', 'black', 560)
    cx = 512
    m_x = cx - m_w / 2
    m_y = 700
    rule_w = 360
    rule_y = m_y + 30

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  {bg_rect}
  <g transform="translate({m_x:.2f},{m_y})" fill="{fg}">{m_path}</g>
  <line x1="{cx - rule_w/2}" y1="{rule_y}" x2="{cx + rule_w/2}" y2="{rule_y}" stroke="{fg}" stroke-width="8"/>
  <circle cx="{cx + rule_w/2}" cy="{rule_y}" r="20" fill="{VERMILION}"/>
</svg>'''
    return svg


# Guardar todos
files = {
    'logo-masthead.svg': build_masthead(),
    'logo-masthead-dark.svg': build_masthead(dark=True),
    'logo-stacked.svg': build_stacked(),
    'logo-stacked-dark.svg': build_stacked(dark=True),
    'logo-inline.svg': build_inline(),
    'logo-inline-dark.svg': build_inline(dark=True),
    'icon.svg': build_icon(),
    'icon-dark.svg': build_icon(dark=True),
    'adaptive-icon.svg': build_icon(adaptive=True),
}

for name, content in files.items():
    (SVG / name).write_text(content)
    print(f"  ✓ {name}")

print("\n✓ SVGs vectoriales generados")
