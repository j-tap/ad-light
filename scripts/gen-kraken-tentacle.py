#!/usr/bin/env python3
"""Draw a clean vertical kraken tentacle sprite (base at bottom)."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/images/kraken-tentacle.png'

W, H = 56, 280
SKIN = (58, 62, 54, 255)
SKIN_HI = (82, 86, 74, 255)
OUTLINE = (12, 12, 14, 255)
SUCKER = (168, 152, 118, 255)
SUCKER_DARK = (96, 86, 68, 255)


def main() -> None:
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Tapered body — wide at base, slimmer toward tip.
    left = []
    right = []
    for y in range(H):
        t = y / (H - 1)
        half = (22 - t * 10) * (0.55 + 0.45 * math.sin(t * math.pi * 0.92) ** 0.35)
        cx = W / 2 + math.sin(t * 3.1) * (2.5 - t * 1.5)
        left.append((cx - half, y))
        right.append((cx + half, y))

    poly = left + list(reversed(right))
    draw.polygon(poly, fill=SKIN, outline=OUTLINE)

    # Inner shading stripe.
    shade = [(x + 4, y) for x, y in left[8:240:3]]
    for x, y in shade:
        draw.point((x, y), fill=SKIN_HI)

    # Suckers along the right edge.
    for i, t in enumerate([0.22, 0.36, 0.5, 0.64, 0.78]):
        y = int(t * H)
        cx = W / 2 + 8 - t * 3
        rx, ry = 7 - i * 0.4, 5 - i * 0.25
        draw.ellipse((cx - rx, y - ry, cx + rx, y + ry), fill=SUCKER, outline=OUTLINE)
        draw.ellipse((cx - rx * 0.45, y - ry * 0.45, cx + rx * 0.45, y + ry * 0.45), fill=SUCKER_DARK)

    # Tip curve.
    tip_y = 8
    draw.ellipse((W / 2 - 7, tip_y - 4, W / 2 + 7, tip_y + 10), fill=SKIN, outline=OUTLINE)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(f'Wrote {OUT} ({img.size[0]}x{img.size[1]})')


if __name__ == '__main__':
    main()
