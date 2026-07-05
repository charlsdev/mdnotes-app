"""
Logo editorial para MDNotes.
Estilo masthead de revista: serif Fraunces, reglas horizontales,
contraste de peso entre 'MD' y 'Notes'.
"""
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from pathlib import Path

OUT = Path('/home/claude/mdnotes-assets/png')
OUT.mkdir(parents=True, exist_ok=True)
SVG = Path('/home/claude/mdnotes-assets/svg')
SVG.mkdir(parents=True, exist_ok=True)

INK = (26, 23, 20)
PAPER = (245, 241, 234)
NOCTURNE = (18, 16, 14)
VERMILION = (193, 74, 43)
MUTED = (138, 130, 117)

VAR = '/tmp/fonts/Fraunces-Variable.ttf'

# Generar instancias estáticas de Fraunces en distintos pesos
def make_weight(wght, opsz=144, path=None):
    f = TTFont(VAR)
    instantiateVariableFont(f, {'wght': wght}, inplace=True)
    f.save(path)
    return path

print("Generando pesos de Fraunces...")
FR_BLACK = make_weight(900, path='/tmp/fonts/Fr-Black.ttf')
FR_BOLD = make_weight(600, path='/tmp/fonts/Fr-Bold.ttf')
FR_MEDIUM = make_weight(500, path='/tmp/fonts/Fr-Medium.ttf')
FR_LIGHT = make_weight(340, path='/tmp/fonts/Fr-Light.ttf')
FR_REGULAR = make_weight(400, path='/tmp/fonts/Fr-Regular.ttf')

# Italic
def make_italic(wght, path):
    f = TTFont(VAR)
    instantiateVariableFont(f, {'wght': wght}, inplace=True)
    f.save(path)
    return path

MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
MONO_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'


def font(path, size):
    return ImageFont.truetype(path, size)


def measure(draw, text, fnt):
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


# ============================================================
# VARIANTE 1 — Masthead con reglas horizontales
# "MD" black + "Notes" light, dos reglas tipo revista
# ============================================================
def variant_masthead(dark=False):
    bg = NOCTURNE if dark else PAPER
    fg = PAPER if dark else INK
    img = Image.new('RGB', (1200, 500), bg)
    d = ImageDraw.Draw(img)

    cx = 600

    # Kicker arriba
    kicker = font(MONO, 18)
    d.text((cx, 130), 'E S T A B L I S H E D   2 0 2 6', font=kicker,
           fill=VERMILION, anchor='mm')

    # Regla superior doble
    d.line([(180, 165), (1020, 165)], fill=fg, width=3)
    d.line([(180, 172), (1020, 172)], fill=fg, width=1)

    # Wordmark central: MD (black) + Notes (light)
    md_font = font(FR_BLACK, 130)
    notes_font = font(FR_LIGHT, 130)

    md_w, _ = measure(d, 'MD', md_font)
    notes_w, _ = measure(d, 'Notes', notes_font)
    total = md_w + notes_w
    start_x = cx - total // 2
    baseline = 320

    d.text((start_x, baseline), 'MD', font=md_font, fill=fg, anchor='ls')
    d.text((start_x + md_w, baseline), 'Notes', font=notes_font, fill=fg, anchor='ls')

    # Regla inferior doble
    d.line([(180, 355), (1020, 355)], fill=fg, width=1)
    d.line([(180, 362), (1020, 362)], fill=fg, width=3)

    # Subtítulo abajo
    sub = font(MONO_REG, 16)
    d.text((cx, 400), 'MARKDOWN  ·  NOTES  ·  PREVIEW', font=sub,
           fill=MUTED, anchor='mm')

    return img


# ============================================================
# VARIANTE 2 — Stacked, MD grande arriba, Notes abajo
# Con línea vertical bermellón (guiño al margen)
# ============================================================
def variant_stacked(dark=False):
    bg = NOCTURNE if dark else PAPER
    fg = PAPER if dark else INK
    img = Image.new('RGB', (1200, 500), bg)
    d = ImageDraw.Draw(img)

    # Línea vertical bermellón a la izquierda del bloque
    line_x = 400
    d.rounded_rectangle([line_x, 150, line_x + 6, 350], radius=3, fill=VERMILION)
    d.ellipse([line_x - 3, 132, line_x + 9, 144], fill=VERMILION)

    # MD grande
    md_font = font(FR_BLACK, 150)
    d.text((line_x + 45, 285), 'MD', font=md_font, fill=fg, anchor='ls')

    # Notes en italic-ish (light) al lado
    notes_font = font(FR_LIGHT, 88)
    md_w, _ = measure(d, 'MD', md_font)
    d.text((line_x + 55 + md_w, 250), 'Notes', font=notes_font, fill=VERMILION, anchor='ls')

    # Tagline
    tag = font(MONO_REG, 17)
    d.text((line_x + 48, 330), 'ESCRIBE  ·  LEE  ·  PREVISUALIZA', font=tag,
           fill=MUTED, anchor='ls')

    return img


# ============================================================
# VARIANTE 3 — Inline clásico, un solo peso, muy refinado
# "MDNotes" con la M y la N con capitales, resto fino
# ============================================================
def variant_inline(dark=False):
    bg = NOCTURNE if dark else PAPER
    fg = PAPER if dark else INK
    img = Image.new('RGB', (1200, 400), bg)
    d = ImageDraw.Draw(img)

    cx = 600
    baseline = 235

    # MD en bold, Notes en medium — sutil contraste
    md_font = font(FR_BOLD, 120)
    notes_font = font(FR_REGULAR, 120)

    md_w, _ = measure(d, 'MD', md_font)
    notes_w, _ = measure(d, 'Notes', notes_font)
    total = md_w + notes_w
    start_x = cx - total // 2

    d.text((start_x, baseline), 'MD', font=md_font, fill=fg, anchor='ls')
    d.text((start_x + md_w, baseline), 'Notes', font=notes_font, fill=fg, anchor='ls')

    # Punto bermellón al final (como un punto final editorial)
    dot_x = start_x + total + 18
    d.ellipse([dot_x, baseline - 22, dot_x + 20, baseline - 2], fill=VERMILION)

    # Regla fina debajo con kicker
    d.line([(start_x, 270), (start_x + total + 38, 270)], fill=MUTED, width=1)
    kicker = font(MONO_REG, 15)
    d.text((start_x, 295), 'MARKDOWN EDITOR', font=kicker, fill=MUTED)
    d.text((start_x + total + 38, 295), 'v0.1', font=kicker, fill=VERMILION, anchor='rs')

    return img


# ============================================================
# ÍCONO — Monograma "M." editorial para la app
# ============================================================
def icon(size, bg_color, fg_color, adaptive=False):
    scale = size / 1024
    img = Image.new('RGBA', (size, size),
                    bg_color + (255,) if bg_color else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if adaptive:
        m_size = int(440 * scale)
        m_y = int(660 * scale)
        cx = size // 2
        rule_w = int(300 * scale)
    else:
        m_size = int(560 * scale)
        m_y = int(700 * scale)
        cx = size // 2
        rule_w = int(360 * scale)

    # M black centrada
    md_font = font(FR_BLACK, m_size)
    mw, _ = measure(d, 'M', md_font)
    d.text((cx, m_y), 'M', font=md_font, fill=fg_color, anchor='ms')

    # Regla editorial debajo con punto bermellón
    rule_y = m_y + int(30 * scale)
    d.line([(cx - rule_w // 2, rule_y), (cx + rule_w // 2, rule_y)],
           fill=fg_color, width=max(2, int(8 * scale)))
    # Punto bermellón centrado sobre la regla, a la derecha
    dot_r = max(3, int(20 * scale))
    d.ellipse([cx + rule_w // 2 - dot_r, rule_y - dot_r,
               cx + rule_w // 2 + dot_r, rule_y + dot_r], fill=VERMILION)

    return img


# === Generar wordmarks ===
print("Generando variantes de logo...")

variant_masthead().save(OUT / 'logo-masthead.png')
variant_masthead(dark=True).save(OUT / 'logo-masthead-dark.png')
print("  ✓ masthead (claro + oscuro)")

variant_stacked().save(OUT / 'logo-stacked.png')
variant_stacked(dark=True).save(OUT / 'logo-stacked-dark.png')
print("  ✓ stacked (claro + oscuro)")

variant_inline().save(OUT / 'logo-inline.png')
variant_inline(dark=True).save(OUT / 'logo-inline-dark.png')
print("  ✓ inline (claro + oscuro)")

# === Íconos ===
print("Generando íconos...")
icon(1024, PAPER, INK).save(OUT / 'icon.png')
icon(1024, NOCTURNE, PAPER).save(OUT / 'icon-dark.png')
icon(1024, None, PAPER, adaptive=True).save(OUT / 'adaptive-icon.png')
icon(180, PAPER, INK).save(OUT / 'icon-180.png')
icon(120, PAPER, INK).save(OUT / 'icon-120.png')
icon(512, PAPER, INK).save(OUT / 'android-play-store.png')
print("  ✓ íconos generados")

print("\n✓ Listo")
