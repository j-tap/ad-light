import Phaser from 'phaser';
import { config, CoralKind, TAU } from '../../config';
import { ensureCanvasTexture } from '../textures';
import { between, createRng, Rng } from './random';

const settings = config.coral;

interface Palette {
  body: string,
  light: string,
  tip: string,
}

interface Limb {
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
}

type Painter = (context: CanvasRenderingContext2D, width: number, height: number, rng: Rng, palette: Palette) => void;

const painters: Record<CoralKind, Painter> = {
  branch: (context, width, height, rng, palette) => paintBranch(context, width, height, rng, palette, settings.branch),
  great: (context, width, height, rng, palette) => paintBranch(context, width, height, rng, palette, settings.great),
  tubes: paintTubes,
  frond: paintFrond,
};

/** Corals share the look of the title art: flat colour, a heavy dark outline, a lighter accent. */
export function ensureCoralTexture(scene: Phaser.Scene, kind: CoralKind, paletteIndex: number, variant: number) {
  const { width, height } = settings.size[kind];
  const palette = settings.palettes[paletteIndex % settings.palettes.length];
  const key = `coral-${kind}-${paletteIndex}-${variant}`;

  return ensureCanvasTexture(scene, key, width, height, context => {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    painters[kind](context, width, height, createRng(settings.seed + variant * 53 + paletteIndex * 7), palette);
    shadeTowardsBase(context, width, height);
  });
}

function shadeTowardsBase(context: CanvasRenderingContext2D, width: number, height: number) {
  const { color, strength, from } = settings.shade;
  const gradient = context.createLinearGradient(0, height * from, 0, height);

  gradient.addColorStop(0, `rgba(${color}, 0)`);
  gradient.addColorStop(1, `rgba(${color}, ${strength})`);

  // Only what has already been painted is darkened, the transparent surroundings stay clear.
  context.globalCompositeOperation = 'source-atop';
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
}

function paintBranch(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  rng: Rng,
  palette: Palette,
  shape: { depth: number, minWidth: number, trunk: number, maxLean: number }
) {
  const { outlineWidth, outline } = settings;
  const limbs: Limb[] = [];
  const tips: { x: number, y: number, radius: number }[] = [];

  const grow = (x: number, y: number, angle: number, length: number, thickness: number, depth: number) => {
    const toX = x + Math.cos(angle) * length;
    const toY = y + Math.sin(angle) * length;

    limbs.push({ fromX: x, fromY: y, toX, toY, width: thickness });

    if (depth >= shape.depth || thickness < shape.minWidth) {
      tips.push({ x: toX, y: toY, radius: Math.max(thickness * 0.75, 6) });
      return;
    }

    const forks = depth === 0 ? 3 : (rng() < 0.75 ? 2 : 1);

    for (let fork = 0; fork < forks; fork++) {
      const spread = forks === 1 ? between(rng, -0.3, 0.3) : Phaser.Math.Linear(-0.55, 0.55, fork / (forks - 1));
      const next = Phaser.Math.Clamp(
        angle + spread + between(rng, -0.18, 0.18),
        -Math.PI / 2 - shape.maxLean,
        -Math.PI / 2 + shape.maxLean
      );

      grow(toX, toY, next, length * between(rng, 0.66, 0.84), thickness * 0.74, depth + 1);
    }
  };

  grow(width / 2, height - outlineWidth, -Math.PI / 2 + between(rng, -0.08, 0.08), height * 0.24, shape.trunk, 0);

  const strokeLimbs = (color: string, grow: number, shiftX: number) => {
    context.strokeStyle = color;
    limbs.forEach(limb => {
      const lineWidth = limb.width * (shiftX === 0 ? 1 : 0.3) + grow;

      context.lineWidth = lineWidth;
      context.beginPath();
      context.moveTo(limb.fromX + shiftX * limb.width, limb.fromY);
      context.lineTo(limb.toX + shiftX * limb.width, limb.toY);
      context.stroke();
    });
  };

  strokeLimbs(outline, outlineWidth * 2, 0);
  strokeLimbs(palette.body, 0, 0);
  strokeLimbs(palette.light, 0, -0.22);

  tips.forEach(tip => {
    context.beginPath();
    context.arc(tip.x, tip.y, tip.radius, 0, TAU);
    context.fillStyle = palette.tip;
    context.fill();
    context.lineWidth = outlineWidth * 0.6;
    context.strokeStyle = outline;
    context.stroke();
  });
}

function paintTubes(context: CanvasRenderingContext2D, width: number, height: number, rng: Rng, palette: Palette) {
  const { outlineWidth, outline } = settings;
  const count = settings.tubes.count;
  const tubes = Array.from({ length: count }, (_, index) => ({
    x: Phaser.Math.Linear(width * 0.16, width * 0.84, (index + between(rng, 0.1, 0.9)) / count),
    tall: between(rng, 0.38, 0.92) * (height - outlineWidth * 3),
    wide: between(rng, settings.tubes.width.min, settings.tubes.width.max),
    tilt: between(rng, -0.16, 0.16),
  })).sort((a, b) => b.tall - a.tall);

  tubes.forEach(tube => {
    const half = tube.wide / 2;

    context.save();
    context.translate(tube.x, height - outlineWidth);
    context.rotate(tube.tilt);

    context.beginPath();
    context.moveTo(-half * 1.15, 0);
    context.lineTo(-half, -tube.tall);
    context.lineTo(half, -tube.tall);
    context.lineTo(half * 1.15, 0);
    context.closePath();
    context.fillStyle = palette.body;
    context.fill();
    context.lineWidth = outlineWidth;
    context.strokeStyle = outline;
    context.stroke();

    context.strokeStyle = palette.light;
    context.lineWidth = half * 0.3;
    context.beginPath();
    context.moveTo(-half * 0.5, -outlineWidth * 2);
    context.lineTo(-half * 0.45, -tube.tall + half);
    context.stroke();

    context.beginPath();
    context.ellipse(0, -tube.tall, half, half * 0.45, 0, 0, TAU);
    context.fillStyle = palette.tip;
    context.fill();
    context.lineWidth = outlineWidth;
    context.strokeStyle = outline;
    context.stroke();

    context.beginPath();
    context.ellipse(0, -tube.tall, half * 0.5, half * 0.2, 0, 0, TAU);
    context.fillStyle = outline;
    context.fill();

    context.restore();
  });
}

function paintFrond(context: CanvasRenderingContext2D, width: number, height: number, rng: Rng, palette: Palette) {
  const { outlineWidth, outline } = settings;
  const blades = settings.frond.blades;

  for (let blade = 0; blade < blades; blade++) {
    const rootX = width / 2 + (blade - (blades - 1) / 2) * settings.frond.rootSpread;
    const tall = between(rng, 0.55, 0.96) * (height - outlineWidth * 2);
    const lean = (blade - (blades - 1) / 2) * settings.frond.lean + between(rng, -10, 10);
    const wave = between(rng, 10, 20);
    const phase = rng() * TAU;
    const half = between(rng, settings.frond.width.min, settings.frond.width.max) / 2;
    const centre = (t: number) => ({
      x: rootX + lean * t + Math.sin(t * Math.PI * 2.2 + phase) * wave * t,
      y: height - outlineWidth - tall * t,
    });
    const halfAt = (t: number) => half * Math.sin(Math.PI * Math.min(t * 0.82 + 0.18, 1)) + 2;
    const steps = 18;

    context.beginPath();

    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const point = centre(t);

      context.lineTo(point.x - halfAt(t), point.y);
    }

    for (let step = steps; step >= 0; step--) {
      const t = step / steps;
      const point = centre(t);

      context.lineTo(point.x + halfAt(t), point.y);
    }

    context.closePath();
    context.fillStyle = blade % 2 === 0 ? palette.body : palette.light;
    context.fill();
    context.lineWidth = outlineWidth;
    context.strokeStyle = outline;
    context.stroke();

    context.beginPath();

    for (let step = 1; step < steps; step++) {
      const point = centre(step / steps);

      context.lineTo(point.x, point.y);
    }

    context.lineWidth = outlineWidth * 0.45;
    context.strokeStyle = palette.tip;
    context.stroke();
  }
}
