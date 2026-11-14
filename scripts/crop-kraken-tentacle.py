#!/usr/bin/env python3
"""Extract a single vertical tentacle sprite from the kraken sheet."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/images/enemy-kraken.png'
OUT = ROOT / 'assets/images/kraken-tentacle.png'

# One curved tentacle with suckers on the lower-left cluster.
CROP_BOX = (170, 700, 290, 928)
ROTATE_DEG = 160


def main() -> None:
    image = Image.open(SRC).convert('RGBA')
    crop = image.crop(CROP_BOX)
    bbox = crop.split()[3].getbbox()

    if bbox is None:
        raise SystemExit('No visible pixels in tentacle crop region')

    crop = crop.crop(bbox)
    vertical = crop.rotate(ROTATE_DEG, expand=True, resample=Image.Resampling.BICUBIC)
    bbox = vertical.split()[3].getbbox()

    if bbox is None:
        raise SystemExit('No visible pixels after tentacle rotation')

    vertical.crop(bbox).save(OUT)
    print(f'Wrote {OUT}')


if __name__ == '__main__':
    main()
