#!/usr/bin/env python3
"""Post-process Recraft rock: game palette, no flora, transparent bg."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

THRESHOLD = 242
BLUR = 0.85

OUTLINE = (10, 9, 7)
SHADOW = (32, 34, 28)
BODY = (48, 50, 38)
LIGHT = (70, 68, 54)


def lerp(a: int, b: int, t: float) -> int:
    return max(0, min(255, int(a + (b - a) * t)))


def lerp3(
    c0: tuple[int, int, int],
    c1: tuple[int, int, int],
    t: float,
) -> tuple[int, int, int]:
    return (lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t))


def luminance(r: int, g: int, b: int) -> float:
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255


def is_bright(r: int, g: int, b: int) -> bool:
    return r > THRESHOLD and g > THRESHOLD and b > THRESHOLD


def is_vegetation(r: int, g: int, b: int) -> bool:
    if r > 200 and g > 200 and b > 180:
        return True
    if g > r + 4 and g > b + 2 and g > 45:
        return True
    # yellow / tan flora
    if r > 130 and g > 110 and b < 110 and r >= g:
        return True
    return False


def strip_flora_bottom_band(px, w: int, h: int, y_start: int) -> None:
    """Remove ground clutter only in the very bottom strip."""
    for y in range(y_start, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if is_vegetation(r, g, b) or is_ground(r, g, b):
                px[x, y] = (0, 0, 0, 0)


def is_ground(r: int, g: int, b: int) -> bool:
    return r > 150 and g > 120 and b > 80 and r > b + 15


def warm_shift(r: int, g: int, b: int) -> tuple[int, int, int]:
    avg = (r + g + b) / 3
    return (
        int(r * 0.88 + avg * 0.12),
        int(g * 0.92 + avg * 0.08),
        int(b * 0.72 + avg * 0.18),
    )


def flatten_ai_bottom_shadow(r: int, g: int, b: int, y: int, h: int) -> tuple[int, int, int]:
    """Recraft adds a heavy bottom shadow; flatten so rotated variants stay readable."""
    y_norm = y / max(h - 1, 1)
    if y_norm <= 0.42:
        return r, g, b

    t = min(1.0, (y_norm - 0.42) / 0.58)
    boost = 1.0 + t * 1.15
    return (
        min(255, int(r * boost)),
        min(255, int(g * boost)),
        min(255, int(b * boost)),
    )


def map_to_game_rock(r: int, g: int, b: int) -> tuple[int, int, int, int]:
    r, g, b = warm_shift(r, g, b)
    lum = luminance(r, g, b)
    lum = lum ** 0.58

    if lum < 0.05:
        return (*OUTLINE, 255)
    if lum < 0.32:
        t = (lum - 0.05) / 0.27
        c = lerp3(SHADOW, BODY, t)
    elif lum < 0.54:
        t = (lum - 0.32) / 0.22
        c = lerp3(BODY, LIGHT, t)
    else:
        t = min(1.0, (lum - 0.54) / 0.22) * 0.4
        c = lerp3(LIGHT, (82, 74, 58), t)

    return (*c, 255)


def soften_detail(img: Image.Image) -> Image.Image:
    alpha = img.split()[3]
    rgb = Image.merge('RGB', img.split()[:3])
    rgb = rgb.filter(ImageFilter.GaussianBlur(radius=BLUR))
    rgb = ImageEnhance.Brightness(rgb).enhance(0.92)
    return Image.merge('RGBA', (*rgb.split(), alpha))


def process(src: Path, dest: Path) -> None:
    img = Image.open(src).convert('RGBA')
    px = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]

            if is_bright(r, g, b):
                px[x, y] = (0, 0, 0, 0)
                continue

            if is_vegetation(r, g, b):
                px[x, y] = (0, 0, 0, 0)
                continue

            if is_ground(r, g, b) and y > h * 0.68:
                px[x, y] = (0, 0, 0, 0)
                continue

            r, g, b = flatten_ai_bottom_shadow(r, g, b, y, h)
            px[x, y] = map_to_game_rock(r, g, b)

    strip_flora_bottom_band(px, w, h, int(h * 0.84))

    img = soften_detail(img)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, 'PNG', optimize=True)
    print(f'Post-processed {src.name} -> {dest} ({img.size[0]}x{img.size[1]})')


if __name__ == '__main__':
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('assets/images/rocks/test-rock-recraft.png')
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('assets/images/rocks/test-rock.png')
    process(source, target)
