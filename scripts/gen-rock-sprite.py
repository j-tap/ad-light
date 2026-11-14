#!/usr/bin/env python3
"""High-quality underwater rock sprites (hand-drawn look, 4x supersampling)."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/images/rocks/test-rock.png"

OUT_SIZE = 1024
SCALE = 4
W = H = OUT_SIZE * SCALE
RNG = random.Random(42)

FILL = (54, 52, 42)
FILL_LIGHT = (92, 84, 66)
FILL_DARK = (34, 32, 26)
OUTLINE = (8, 7, 6)
KELP = (48, 62, 44)
KELP_DARK = (36, 48, 34)


def stalagmite_points() -> list[tuple[float, float]]:
    cx = W * 0.5
    base_y = H * 0.88
    segments = 18
    points: list[tuple[float, float]] = []

    points.append((cx - W * 0.30, base_y))
    for i in range(1, segments):
        t = i / segments
        wobble = math.sin(t * 7.3) * W * 0.012
        x = cx - W * (0.30 - t * 0.24) + wobble + RNG.uniform(-W * 0.008, W * 0.008)
        y = base_y - t ** 1.05 * (base_y - H * 0.12) + RNG.uniform(-H * 0.006, H * 0.006)
        points.append((x, y))

    points.append((cx + RNG.uniform(-W * 0.004, W * 0.004), H * 0.11))

    for i in range(segments - 1, 0, -1):
        t = i / segments
        wobble = math.sin(t * 6.1 + 1.2) * W * 0.011
        x = cx + W * (0.30 - t * 0.24) + wobble + RNG.uniform(-W * 0.008, W * 0.008)
        y = base_y - t ** 1.05 * (base_y - H * 0.12) + RNG.uniform(-H * 0.006, H * 0.006)
        points.append((x, y))

    points.append((cx + W * 0.30, base_y))
    return points


def point_in_poly(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def draw_rock(img: Image.Image, points: list[tuple[float, float]]) -> None:
    draw = ImageDraw.Draw(img)

    draw.polygon(points, fill=FILL)

    mid = len(points) // 2
    shade = points[: mid + 2]
    if len(shade) >= 3:
        draw.polygon(shade, fill=FILL_DARK)

    hi = [
        (W * 0.46, H * 0.30),
        (W * 0.54, H * 0.24),
        (W * 0.57, H * 0.40),
        (W * 0.50, H * 0.44),
    ]
    draw.polygon(hi, fill=FILL_LIGHT)

    # Cross-hatch stipple (Recraft-like texture)
    px = img.load()
    for _ in range(int(W * H * 0.006)):
        x = RNG.uniform(0, W)
        y = RNG.uniform(0, H)
        if not point_in_poly(x, y, points):
            continue
        tone = RNG.choice([FILL_DARK, FILL, FILL_LIGHT])
        r, g, b = tone
        n = RNG.randint(-6, 6)
        size = RNG.choice([1, 1, 1, 2]) * SCALE // 2 or 1
        x0, y0 = int(x), int(y)
        for dx in range(size):
            for dy in range(size):
                if 0 <= x0 + dx < W and 0 <= y0 + dy < H and point_in_poly(x0 + dx, y0 + dy, points):
                    px[x0 + dx, y0 + dy] = (
                        max(0, min(255, r + n)),
                        max(0, min(255, g + n)),
                        max(0, min(255, b + n // 2)),
                        255,
                    )

    # Fine cross-hatch
    draw = ImageDraw.Draw(img)
    step = SCALE * 14
    for y in range(0, H, step):
        for x in range(0, W, step):
            if point_in_poly(x, y, points):
                draw.line([(x, y), (x + step * 0.6, y + step * 0.35)], fill=(42, 40, 32), width=max(1, SCALE // 2))

    draw = ImageDraw.Draw(img)
    crack_seeds = [
        (0.48, 0.35, 0.42, 0.55),
        (0.52, 0.42, 0.58, 0.62),
        (0.44, 0.50, 0.40, 0.68),
        (0.56, 0.28, 0.53, 0.48),
        (0.50, 0.58, 0.47, 0.72),
    ]
    lw = SCALE * 2
    for sx, sy, ex, ey in crack_seeds:
        draw.line(
            [(W * sx, H * sy), (W * ex, H * ey)],
            fill=OUTLINE,
            width=lw,
            joint="curve",
        )
        draw.line(
            [(W * sx, H * sy), (W * ex, H * ey)],
            fill=(28, 26, 20),
            width=max(1, lw // 2),
            joint="curve",
        )

    # Kelp tufts
    for side in (-1, 1):
        bx = W * 0.5 + side * W * 0.16
        by = H * 0.84
        for i in range(3):
            ox = bx + side * i * SCALE * 3
            draw.line(
                [(ox, by), (ox + side * SCALE * 7, by - SCALE * 18), (ox + side * SCALE * 2, by - SCALE * 28)],
                fill=KELP_DARK,
                width=SCALE * 2,
                joint="curve",
            )
            draw.line(
                [(ox, by), (ox + side * SCALE * 7, by - SCALE * 18), (ox + side * SCALE * 2, by - SCALE * 28)],
                fill=KELP,
                width=max(1, SCALE),
                joint="curve",
            )

    # Bold outline (double pass for weight)
    outline_pts = points + [points[0]]
    for w in (SCALE * 6, SCALE * 4):
        draw.line(outline_pts, fill=OUTLINE, width=w, joint="curve")


def main() -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    points = stalagmite_points()
    draw_rock(img, points)

    img = img.resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=0.8, percent=50, threshold=3))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({OUT_SIZE}px, {SCALE}x supersampling)")


if __name__ == "__main__":
    main()
