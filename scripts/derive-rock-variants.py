#!/usr/bin/env python3
"""Derive rock-top / rock-left variants from rock-bottom (same art, no extra AI)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'assets/images/rocks'
SRC = ROOT / 'rock-bottom.png'


def luminance(r: int, g: int, b: int) -> float:
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255


def is_vegetation(r: int, g: int, b: int) -> bool:
    if r > 200 and g > 200 and b > 180:
        return True
    return g > r + 4 and g > b + 2 and g > 45


def is_ground(r: int, g: int, b: int) -> bool:
    return r > 150 and g > 120 and b > 80 and r > b + 15


def save(img: Image.Image, name: str) -> None:
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    out = ROOT / name
    img.save(out, 'PNG', optimize=True)
    print(f'Wrote {out} ({img.size[0]}x{img.size[1]})')


def strip_edge_flora(img: Image.Image, edge: str, ratio: float = 0.1) -> Image.Image:
    px = img.load()
    w, h = img.size
    band = int(h * ratio) if edge in ('top', 'bottom') else int(w * ratio)

    if edge == 'top':
        ys = range(0, band)
    elif edge == 'bottom':
        ys = range(h - band, h)
    else:
        ys = range(h)

    for y in ys:
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if is_vegetation(r, g, b) or (is_ground(r, g, b) and luminance(r, g, b) > 0.12):
                px[x, y] = (0, 0, 0, 0)

    return img


def make_left(img: Image.Image) -> Image.Image:
    # Point right, base left — attaches to the left wall.
    return img.rotate(-90, expand=True, resample=Image.Resampling.BICUBIC)


def main() -> None:
    base = Image.open(SRC).convert('RGBA')

    top = base.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    top = strip_edge_flora(top, 'top', 0.08)
    save(top, 'rock-top.png')

    save(make_left(base), 'rock-left.png')
    save(make_left(base).transpose(Image.Transpose.FLIP_TOP_BOTTOM), 'rock-left-2.png')


if __name__ == '__main__':
    main()
