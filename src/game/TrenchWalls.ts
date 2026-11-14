import Phaser from 'phaser';
import { config, Point, ShaftConfig, ShaftLedge, ShaftSide, TAU } from '../config';
import { paintRock, RockFeatures, scatterCracks } from './art/RockPainter';
import { between, createRng, Rng } from './art/random';
import { Terrain } from './systems/Terrain';
import { ensureCanvasTexture, solidTexture } from './textures';

const settings = config.shaft;
const { palette } = config.rock.paint;
const FILLER_TEXTURE = 'rockFiller';

/** A crack or bedding line with its vertical extent, so chunks only paint what crosses them. */
interface Feature {
  points: Point[],
  top: number,
  bottom: number,
}

interface WallSide {
  side: ShaftSide,
  /** Water edge x for every sample row. */
  edge: Float32Array,
  cracks: Feature[],
  strata: Feature[],
}

interface Chunk {
  wall: WallSide,
  top: number,
  key: string,
  image?: Phaser.GameObjects.Image,
}

/**
 * The walls of a vertical shaft. Each wall is a single valued function of depth, which keeps
 * both the collision outline and the chunked artwork derivable from a few control points.
 * The artwork is painted chunk by chunk as the camera gets near and dropped once it is far.
 */
export class TrenchWalls {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly rows: number;
  private readonly left: WallSide;
  private readonly right: WallSide;
  private readonly chunks: Chunk[] = [];

  constructor(scene: Phaser.Scene, shaft: ShaftConfig, worldWidth: number, worldHeight: number, textureKey: string) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.rows = Math.ceil((worldHeight + settings.overscan * 2) / settings.sampleStep) + 1;

    this.left = this.buildSide('left', shaft);
    this.right = this.buildSide('right', shaft);

    for (let top = 0, index = 0; top < worldHeight; top += settings.chunkHeight, index++) {
      this.chunks.push(
        { wall: this.left, top, key: `${textureKey}-left-${index}` },
        { wall: this.right, top, key: `${textureKey}-right-${index}` }
      );
    }

    this.createFloor(textureKey);
    this.createFillers();
  }

  addTo(terrain: Terrain) {
    terrain.addPolyline(this.outline(this.left, 0, this.rows - 1, settings.collisionStride));
    terrain.addPolyline(this.outline(this.right, 0, this.rows - 1, settings.collisionStride));
    terrain.addPolyline(this.floorOutline());
  }

  /** Paints the chunks coming into view and frees the ones left far behind. */
  update(camera: Phaser.Cameras.Scene2D.Camera) {
    const { chunkHeight, chunkWindow } = settings;
    const middle = camera.scrollY + camera.height / 2;
    const half = camera.height / camera.zoom / 2;

    for (const chunk of this.chunks) {
      const distance = Math.max(middle - half - (chunk.top + chunkHeight), chunk.top - (middle + half), 0);

      if (!chunk.image && distance <= chunkWindow.create) {
        this.showChunk(chunk);
      } else if (chunk.image && distance > chunkWindow.drop) {
        chunk.image.destroy();
        chunk.image = undefined;
        this.scene.textures.remove(chunk.key);
      }
    }
  }

  leftAt(y: number) {
    return this.sample(this.left.edge, y);
  }

  rightAt(y: number) {
    return this.sample(this.right.edge, y);
  }

  /** Depth at which a wall first reaches out to `x`, scanning downwards; undefined if it never does. */
  surfaceY(side: ShaftSide, x: number, from: number, to: number) {
    const edge = side === 'left' ? this.left.edge : this.right.edge;

    for (let row = this.rowAt(from); row <= this.rowAt(to); row++) {
      if (side === 'left' ? edge[row] >= x : edge[row] <= x) {
        return this.rowY(row);
      }
    }

    return undefined;
  }

  /** Keeps a point inside the water at its depth, `margin` away from both walls. */
  clampX(x: number, y: number, margin: number) {
    const left = this.leftAt(y) + margin;
    const right = this.rightAt(y) - margin;

    return left > right ? (left + right) / 2 : Phaser.Math.Clamp(x, left, right);
  }

  private sample(edge: Float32Array, y: number) {
    const position = (y + settings.overscan) / settings.sampleStep;
    const index = Phaser.Math.Clamp(Math.floor(position), 0, this.rows - 2);
    const t = Phaser.Math.Clamp(position - index, 0, 1);

    return Phaser.Math.Linear(edge[index], edge[index + 1], t);
  }

  private rowY(row: number) {
    return row * settings.sampleStep - settings.overscan;
  }

  private rowAt(y: number) {
    return Phaser.Math.Clamp(Math.round((y + settings.overscan) / settings.sampleStep), 0, this.rows - 1);
  }

  private buildSide(side: ShaftSide, shaft: ShaftConfig): WallSide {
    const edge = new Float32Array(this.rows);
    const base = side === 'left' ? shaft.left : shaft.right;
    const ledges = shaft.ledges.filter(ledge => ledge.side === side);
    const alcoves = shaft.alcoves.filter(alcove => alcove.side === side);
    const phase = side === 'left' ? 0 : settings.rightPhase;

    for (let row = 0; row < this.rows; row++) {
      const y = this.rowY(row);
      let inset = interpolateProfile(base, y);

      for (const ledge of ledges) {
        inset = Math.max(inset, ledgeInset(ledge, y, inset));
      }

      for (const alcove of alcoves) {
        inset = Math.min(inset, alcoveInset(alcove, y, inset));
      }

      inset += roughness(y, phase);
      edge[row] = side === 'left' ? inset : this.worldWidth - inset;
    }

    const wall: WallSide = { side, edge, cracks: [], strata: [] };
    const rng = createRng(settings.seed + phase);

    wall.cracks = scatterCracks(this.outline(wall, 0, this.rows - 1, 1), rng).map(toFeature);
    wall.strata = this.buildStrata(side, rng).map(toFeature);

    return wall;
  }

  private buildStrata(side: ShaftSide, rng: Rng) {
    const { spacing, steps, reach, tilt, wave, waveLength } = settings.strata;
    const lines: Point[][] = [];
    const direction = side === 'left' ? 1 : -1;
    const startX = side === 'left' ? -settings.outerPad : this.worldWidth + settings.outerPad;
    let y = -settings.overscan;

    while (y < this.worldHeight + settings.overscan) {
      y += between(rng, spacing.min, spacing.max);

      const line: Point[] = [];
      const slope = between(rng, -tilt, tilt);
      const amplitude = between(rng, wave.min, wave.max);
      const offset = rng() * TAU;

      for (let step = 0; step <= steps; step++) {
        const distance = (step / steps) * reach;

        line.push({
          x: startX + direction * distance,
          y: y + distance * slope + Math.sin(distance / waveLength + offset) * amplitude,
        });
      }

      lines.push(line);
    }

    return lines;
  }

  /** Water edge as a polyline with the open side on the right of travel. */
  private outline(wall: WallSide, fromRow: number, toRow: number, stride: number): Point[] {
    const points: Point[] = [];

    for (let row = fromRow; row < toRow; row += stride) {
      points.push({ x: wall.edge[row], y: this.rowY(row) });
    }

    points.push({ x: wall.edge[toRow], y: this.rowY(toRow) });

    return wall.side === 'left' ? points : points.reverse();
  }

  private floorOutline(): Point[] {
    const points: Point[] = [];
    const { floorHeight, floorWaves, floorStep, outerPad } = settings;

    for (let x = -outerPad; x <= this.worldWidth + outerPad; x += floorStep) {
      points.push({
        x,
        y: floorWaves.reduce(
          (y, [period, amplitude, phase]) => y + Math.sin(x / period + phase) * amplitude,
          this.worldHeight - floorHeight
        ),
      });
    }

    return points;
  }

  private showChunk(chunk: Chunk) {
    const { chunkHeight, chunkPad, outerPad, edgeMargin } = settings;
    const { wall, top, key } = chunk;
    const isLeft = wall.side === 'left';
    const bottom = top + chunkHeight;
    let reach = 0;

    for (let row = this.rowAt(top); row <= this.rowAt(bottom); row++) {
      reach = Math.max(reach, isLeft ? wall.edge[row] : this.worldWidth - wall.edge[row]);
    }

    const width = Math.ceil(reach + edgeMargin);
    const originX = isLeft ? 0 : this.worldWidth - width;

    ensureCanvasTexture(this.scene, key, width, chunkHeight, context => {
      // The outline runs past the chunk on both ends, so strokes meet cleanly at the seams.
      const edge = this.outline(wall, this.rowAt(top - chunkPad), this.rowAt(bottom + chunkPad), 1);
      const outerX = isLeft ? -outerPad : this.worldWidth + outerPad;
      const crosses = (feature: Feature) => feature.bottom >= top && feature.top <= bottom;
      const features: RockFeatures = {
        cracks: wall.cracks.filter(crosses).map(feature => feature.points),
        strata: wall.strata.filter(crosses).map(feature => feature.points),
      };

      context.translate(-originX, -top);
      paintRock(
        this.scene,
        context,
        {
          polygon: [...edge, { x: outerX, y: edge[edge.length - 1].y }, { x: outerX, y: edge[0].y }],
          edge,
        },
        features
      );
    });

    chunk.image = this.scene.add.image(originX, top, key)
      .setOrigin(0)
      .setPipeline('Light2D')
      .setDepth(config.render.rockObstacle);
  }

  private createFloor(textureKey: string) {
    const { floorHeight, floorWaves, edgeMargin, floorSeed } = settings;
    const swell = floorWaves.reduce((sum, [, amplitude]) => sum + amplitude, 0);
    const height = floorHeight + swell + edgeMargin;
    const top = this.worldHeight - height;
    const key = `${textureKey}-floor`;

    ensureCanvasTexture(this.scene, key, this.worldWidth, height, context => {
      const edge = this.floorOutline();
      const below = this.worldHeight + edgeMargin;

      context.translate(0, -top);
      paintRock(
        this.scene,
        context,
        {
          polygon: [...edge, { x: edge[edge.length - 1].x, y: below }, { x: edge[0].x, y: below }],
          edge,
        },
        { cracks: scatterCracks(edge, createRng(settings.seed + floorSeed)), strata: [] }
      );
    });

    this.scene.add.image(0, top, key)
      .setOrigin(0)
      .setPipeline('Light2D')
      .setDepth(config.render.rockObstacle - 1);
  }

  /** Rock keeps going past the world edge, otherwise wide screens would show open water there. */
  private createFillers() {
    const { fillerWidth, overscan } = settings;
    const height = this.worldHeight + overscan * 2;

    solidTexture(this.scene, FILLER_TEXTURE, palette.shade);

    [-fillerWidth, this.worldWidth].forEach(x => {
      this.scene.add.image(x, -overscan, FILLER_TEXTURE)
        .setOrigin(0)
        .setDisplaySize(fillerWidth, height)
        .setPipeline('Light2D')
        .setDepth(config.render.rockObstacle);
    });
  }
}

function toFeature(points: Point[]): Feature {
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }

  return { points, top, bottom };
}

/** Control points are eased into each other so the wall bends instead of kinking. */
function interpolateProfile(points: [number, number][], y: number) {
  if (y <= points[0][0]) return points[0][1];

  for (let i = 0; i < points.length - 1; i++) {
    const [fromY, fromInset] = points[i];
    const [toY, toInset] = points[i + 1];

    if (y <= toY) {
      return Phaser.Math.Linear(fromInset, toInset, Phaser.Math.SmoothStep(y, fromY, toY));
    }
  }

  return points[points.length - 1][1];
}

/** A shelf on top, a blunt tip and a long undercut below. */
function ledgeInset(ledge: ShaftLedge, y: number, base: number) {
  const u = (y - ledge.y) / ledge.height;

  if (u <= 0 || u >= 1 || ledge.reach <= base) return base;

  const { ledgeShelf, ledgeTip } = settings;
  let shape = 1;

  if (u < ledgeShelf) {
    shape = Phaser.Math.Easing.Sine.Out(u / ledgeShelf);
  } else if (u > ledgeTip) {
    shape = 1 - Phaser.Math.Easing.Sine.In((u - ledgeTip) / (1 - ledgeTip));
  }

  return Phaser.Math.Linear(base, ledge.reach, shape);
}

function alcoveInset(alcove: ShaftLedge, y: number, base: number) {
  const u = (y - alcove.y) / alcove.height;

  if (u <= 0 || u >= 1 || alcove.reach >= base) return base;

  const { alcoveLip } = settings;
  const shape = Phaser.Math.SmoothStep(u, 0, alcoveLip) * Phaser.Math.SmoothStep(1 - u, 0, alcoveLip);

  return Phaser.Math.Linear(base, alcove.reach, shape);
}

function roughness(y: number, phase: number) {
  return settings.roughness.reduce(
    (sum, [period, amplitude], index) => sum + Math.sin(y / period + phase * (index + 1)) * amplitude,
    0
  );
}
