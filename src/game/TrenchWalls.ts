import Phaser from 'phaser';
import { config, ShaftConfig, ShaftLedge, ShaftSide } from '../config';
import { paintRock, Point, RockFeatures, scatterCracks } from './art/RockPainter';
import { between, createRng } from './art/random';
import { Terrain } from './systems/Terrain';
import { ensureCanvasTexture, solidTexture } from './textures';

const settings = config.trench.walls;
const { palette } = config.rock.paint;
const FILLER_TEXTURE = 'rockFiller';

interface WallSide {
  side: ShaftSide,
  /** Water edge x for every sample row. */
  edge: Float32Array,
  features: RockFeatures,
}

/**
 * The walls of a vertical shaft. Each wall is a single valued function of depth, which keeps
 * both the collision outline and the chunked artwork derivable from a few control points.
 */
export class TrenchWalls {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly rows: number;
  private readonly left: WallSide;
  private readonly right: WallSide;

  constructor(
    scene: Phaser.Scene,
    shaft: ShaftConfig,
    worldWidth: number,
    worldHeight: number,
    terrain: Terrain,
    textureKey: string
  ) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.rows = Math.ceil((worldHeight + settings.overscan * 2) / settings.sampleStep) + 1;

    this.left = this.buildSide('left', shaft);
    this.right = this.buildSide('right', shaft);

    terrain.addPolyline(this.outline(this.left, 0, this.rows - 1, settings.collisionStride));
    terrain.addPolyline(this.outline(this.right, 0, this.rows - 1, settings.collisionStride));
    terrain.addPolyline(this.floorOutline());

    this.createChunks(this.left, textureKey);
    this.createChunks(this.right, textureKey);
    this.createFloor(textureKey);
    this.createFillers();
  }

  leftAt(y: number) {
    return this.sample(this.left.edge, y);
  }

  rightAt(y: number) {
    return this.sample(this.right.edge, y);
  }

  centerAt(y: number) {
    return (this.leftAt(y) + this.rightAt(y)) / 2;
  }

  /** Depth at which a wall first reaches out to `x`, scanning downwards; undefined if it never does. */
  surfaceY(side: ShaftSide, x: number, from: number, to: number) {
    const edge = side === 'left' ? this.left.edge : this.right.edge;
    const fromRow = Math.max(Math.round((from + settings.overscan) / settings.sampleStep), 0);
    const toRow = Math.min(Math.round((to + settings.overscan) / settings.sampleStep), this.rows - 1);

    for (let row = fromRow; row <= toRow; row++) {
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

    const wall: WallSide = { side, edge, features: { cracks: [], strata: [] } };
    const rng = createRng(settings.seed + phase);

    wall.features.cracks = scatterCracks(this.outline(wall, 0, this.rows - 1, 1), rng);
    wall.features.strata = this.buildStrata(side, rng);

    return wall;
  }

  private buildStrata(side: ShaftSide, rng: () => number) {
    const lines: Point[][] = [];
    const direction = side === 'left' ? 1 : -1;
    const startX = side === 'left' ? -settings.outerPad : this.worldWidth + settings.outerPad;
    let y = -settings.overscan;

    while (y < this.worldHeight + settings.overscan) {
      y += between(rng, settings.strataSpacing.min, settings.strataSpacing.max);

      const line: Point[] = [];
      const tilt = between(rng, -0.08, 0.08);
      const wave = between(rng, 6, 16);
      const offset = rng() * Math.PI * 2;

      for (let step = 0; step <= settings.strataSteps; step++) {
        const distance = (step / settings.strataSteps) * settings.strataReach;

        line.push({
          x: startX + direction * distance,
          y: y + distance * tilt + Math.sin(distance / 70 + offset) * wave,
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
    const { floorHeight, floorWave, floorStep, outerPad } = settings;

    for (let x = -outerPad; x <= this.worldWidth + outerPad; x += floorStep) {
      points.push({
        x,
        y: this.worldHeight - floorHeight
          + Math.sin(x / 83) * floorWave
          + Math.sin(x / 31 + 1.7) * floorWave * 0.4,
      });
    }

    return points;
  }

  private createChunks(wall: WallSide, textureKey: string) {
    const { chunkHeight, chunkPad, sampleStep, overscan, outerPad, edgeMargin } = settings;
    const chunks = Math.ceil(this.worldHeight / chunkHeight);
    const isLeft = wall.side === 'left';

    for (let chunk = 0; chunk < chunks; chunk++) {
      const top = chunk * chunkHeight;
      const fromRow = Math.max(Math.floor((top - chunkPad + overscan) / sampleStep), 0);
      const toRow = Math.min(Math.ceil((top + chunkHeight + chunkPad + overscan) / sampleStep), this.rows - 1);
      const edge = this.outline(wall, fromRow, toRow, 1);
      const reach = edge.reduce(
        (furthest, point) => Math.max(furthest, isLeft ? point.x : this.worldWidth - point.x),
        0
      );
      const width = Math.ceil(reach + edgeMargin);
      const originX = isLeft ? 0 : this.worldWidth - width;
      const outerX = isLeft ? -outerPad : this.worldWidth + outerPad;
      const key = `${textureKey}-${wall.side}-${chunk}`;

      ensureCanvasTexture(this.scene, key, width, chunkHeight, context => {
        context.translate(-originX, -top);

        paintRock(
          context,
          {
            polygon: [...edge, { x: outerX, y: edge[edge.length - 1].y }, { x: outerX, y: edge[0].y }],
            edge,
          },
          wall.features,
          { x: originX, y: top, width, height: chunkHeight },
          createRng(settings.seed + chunk * 2 + (isLeft ? 0 : 1))
        );
      });

      this.scene.add.image(originX, top, key)
        .setOrigin(0)
        .setPipeline('Light2D')
        .setDepth(config.render.rockObstacle);
    }
  }

  private createFloor(textureKey: string) {
    const { floorHeight, floorWave, edgeMargin } = settings;
    const height = floorHeight + floorWave * 2 + edgeMargin;
    const top = this.worldHeight - height;
    const edge = this.floorOutline();
    const key = `${textureKey}-floor`;
    const rng = createRng(settings.seed + 977);

    ensureCanvasTexture(this.scene, key, this.worldWidth, height, context => {
      context.translate(0, -top);

      paintRock(
        context,
        {
          polygon: [
            ...edge,
            { x: edge[edge.length - 1].x, y: this.worldHeight + edgeMargin },
            { x: edge[0].x, y: this.worldHeight + edgeMargin },
          ],
          edge,
        },
        { cracks: scatterCracks(edge, rng), strata: [] },
        { x: 0, y: top, width: this.worldWidth, height },
        rng
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
