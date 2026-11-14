import Phaser from 'phaser';
import { config, Point } from '../../config';
import { ensureCanvasTexture } from '../textures';
import { between, createRng, Rng } from './random';

/**
 * Rock outlines follow one convention everywhere, in the artwork and in the collision built
 * from it: walking along an edge, open water is on the right hand side.
 */
export interface RockShape {
  /** Closed outline of the solid part. */
  polygon: Point[],
  /** The part of the outline that borders open water. */
  edge: Point[],
}

export interface RockFeatures {
  cracks: Point[][],
  strata: Point[][],
}

export interface StrataArea {
  fromX: number,
  toX: number,
  /** Signed extent along y, measured from 0: negative grows upwards. */
  length: number,
}

const settings = config.rock.paint;
const { palette } = settings;
const GRAIN_TEXTURE = 'rockGrain';
const GRAIN_SEED = 71;

/**
 * Rock in the style of the hand drawn backdrops: flat muted tones, a lighter rim along the
 * water, a heavy dark outline and a handful of cracks.
 */
export function paintRock(
  scene: Phaser.Scene,
  context: CanvasRenderingContext2D,
  shape: RockShape,
  features: RockFeatures
) {
  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';

  context.save();
  tracePath(context, shape.polygon, true);
  context.clip();

  context.fillStyle = palette.shade;
  context.fill();

  context.strokeStyle = palette.strata;
  context.lineWidth = settings.strataWidth;
  features.strata.forEach(line => {
    tracePath(context, line, false);
    context.stroke();
  });

  // The stroke is centred on the edge, so only its inner half survives the clip.
  context.strokeStyle = palette.body;
  context.lineWidth = settings.rimWidth * 2;
  tracePath(context, shape.edge, false);
  context.stroke();

  context.strokeStyle = palette.light;
  context.lineWidth = settings.lightRimWidth * 2;
  context.stroke();

  const grain = context.createPattern(grainTile(scene), 'repeat');

  if (grain) {
    tracePath(context, shape.polygon, true);
    context.fillStyle = grain;
    context.fill();
  }

  context.strokeStyle = palette.outline;
  features.cracks.forEach(crack => paintCrack(context, crack));

  context.restore();

  context.strokeStyle = palette.outline;
  context.lineWidth = settings.outlineWidth;
  tracePath(context, shape.edge, false);
  context.stroke();

  context.restore();
}

/** Cracks start on the edge and wander into the rock. */
export function scatterCracks(edge: Point[], rng: Rng): Point[][] {
  const cracks: Point[][] = [];
  const { crackSpacing, crackLength, crackBend } = settings;
  let travelled = 0;
  let next = between(rng, crackSpacing.min, crackSpacing.max) * 0.5;

  for (let i = 0; i < edge.length - 1; i++) {
    const a = edge[i];
    const b = edge[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);

    travelled += length;

    if (travelled < next || length === 0) continue;

    travelled = 0;
    next = between(rng, crackSpacing.min, crackSpacing.max);

    // Into the rock is the left hand side of travel.
    let angle = Math.atan2(-(b.x - a.x), b.y - a.y) + Math.PI + between(rng, -crackBend, crackBend);
    let x = a.x;
    let y = a.y;
    const crack: Point[] = [{ x, y }];
    const steps = 2 + Math.floor(rng() * 2);
    const reach = between(rng, crackLength.min, crackLength.max) / steps;

    for (let step = 0; step < steps; step++) {
      x += Math.cos(angle) * reach;
      y += Math.sin(angle) * reach;
      crack.push({ x, y });
      angle += between(rng, -crackBend, crackBend);
    }

    cracks.push(crack);
  }

  return cracks;
}

/** Gently sloped bedding lines across a free standing piece of rock. */
export function scatterStrata(area: StrataArea, rng: Rng): Point[][] {
  const { first, spacing, tilt, jitter } = settings.strata;
  const lines: Point[][] = [];
  const direction = Math.sign(area.length);
  const width = area.toX - area.fromX;

  for (let y = between(rng, first.min, first.max); y < Math.abs(area.length); y += between(rng, spacing.min, spacing.max)) {
    const slope = between(rng, -tilt, tilt) * width;

    lines.push([
      { x: area.fromX, y: direction * y },
      { x: area.fromX + width / 2, y: direction * y + slope / 2 + between(rng, -jitter, jitter) },
      { x: area.toX, y: direction * y + slope },
    ]);
  }

  return lines;
}

function tracePath(context: CanvasRenderingContext2D, points: Point[], closed: boolean) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });

  if (closed) context.closePath();
}

function paintCrack(context: CanvasRenderingContext2D, crack: Point[]) {
  for (let i = 0; i < crack.length - 1; i++) {
    const taper = 1 - i / (crack.length - 1);

    context.lineWidth = Math.max(settings.crackWidth * taper, 1.5);
    context.beginPath();
    context.moveTo(crack[i].x, crack[i].y);
    context.lineTo(crack[i + 1].x, crack[i + 1].y);
    context.stroke();
  }
}

/** Speckle painted once into a small tile and laid over the rock as a repeating fill. */
function grainTile(scene: Phaser.Scene) {
  const size = settings.grainTile;

  ensureCanvasTexture(scene, GRAIN_TEXTURE, size, size, context => {
    const rng = createRng(GRAIN_SEED);
    const count = Math.round((size * size * settings.grainDensity) / 1000);

    for (let i = 0; i < count; i++) {
      const dot = rng() < 0.8 ? 1.5 : 2.5;

      context.fillStyle = rng() < 0.5 ? palette.grainDark : palette.grainLight;
      context.fillRect(rng() * size, rng() * size, dot, dot);
    }
  });

  return scene.textures.get(GRAIN_TEXTURE).getSourceImage() as HTMLCanvasElement;
}
