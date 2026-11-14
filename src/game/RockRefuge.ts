import Phaser from 'phaser';
import { config, Point } from '../config';
import { paintRock, scatterCracks, scatterStrata } from './art/RockPainter';
import { between, createRng, Rng } from './art/random';
import { addSoftGlow, ensureCanvasTexture, solidTexture } from './textures';

const settings = config.chase.refuge;
const BLEED = config.rock.paint.outlineWidth;
const BACKDROP_TEXTURE = 'refugeBackdrop';

/**
 * One half of the rock face, in local space: x from the face, y from its side of the crack.
 * `edge` borders the water with the open side on the right of travel; `far` is the y the rock
 * runs off to, negative for the half above the crack.
 */
interface Half {
  edge: Point[],
  far: number,
  image: Phaser.GameObjects.Image,
}

/**
 * The rock face that closes the kraken tunnel, split by a crack the fish can slip into.
 * Both halves hang off the vertical middle of the tunnel, so the crack stays in place whatever
 * the screen height is.
 */
export class RockRefuge {
  private readonly scene: Phaser.Scene;
  private readonly halves: Half[];
  private readonly backdrop: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly light: Phaser.GameObjects.Light;
  private middleY = 0;

  constructor(scene: Phaser.Scene) {
    const { glow, seed, height } = settings;

    this.scene = scene;

    this.backdrop = scene.add.image(0, 0, solidTexture(scene, BACKDROP_TEXTURE, settings.backdrop))
      .setOrigin(0, 0.5)
      .setPipeline('Light2D')
      .setDepth(config.render.scenery);

    this.glow = addSoftGlow(scene, 0, 0, glow.color)
      .setAlpha(glow.alpha)
      .setScale(glow.scale)
      .setDepth(config.render.scenery + 1);

    this.light = scene.lights.addLight(0, 0, glow.lightRadius, glow.color, glow.lightIntensity);

    const upper = upperEdge(createRng(seed));
    // Mirrored, the walk runs the wrong way round the rock, so it is reversed as well.
    const lower = upperEdge(createRng(seed + 1)).map(point => ({ x: point.x, y: -point.y })).reverse();

    this.halves = [
      this.createHalf('refuge-upper', upper, -height),
      this.createHalf('refuge-lower', lower, height),
    ];
  }

  layout(worldHeight: number) {
    const { wallX, pad, height, halfGap, width, funnel, glow } = settings;

    this.middleY = worldHeight / 2;
    this.halves.forEach(half => half.image.setPosition(
      wallX - pad,
      half.far < 0 ? this.middleY - halfGap - height : this.middleY + halfGap - BLEED
    ));
    this.backdrop.setPosition(wallX + funnel, this.middleY).setDisplaySize(width, worldHeight + height);
    this.glow.setPosition(wallX + glow.inset, this.middleY);
    this.light.setPosition(wallX + glow.inset, this.middleY);
  }

  /** Solid outlines in world space, one per half. */
  getColliders(): Point[][] {
    const { wallX, halfGap } = settings;

    return this.halves.map(half => outline(half.edge, half.far).map(point => ({
      x: wallX + point.x,
      y: this.middleY + Math.sign(half.far) * halfGap + point.y,
    })));
  }

  private createHalf(key: string, edge: Point[], far: number): Half {
    const { width, height, pad, seed } = settings;

    ensureCanvasTexture(this.scene, key, width + pad, height + BLEED, context => {
      const rng = createRng(seed + far);

      context.translate(pad, far < 0 ? height : BLEED);
      paintRock(this.scene, context, { polygon: outline(edge, far), edge }, {
        cracks: scatterCracks(edge, rng),
        strata: scatterStrata({ fromX: -pad, toX: width, length: far }, rng),
      });
    });

    const image = this.scene.add.image(0, 0, key)
      .setOrigin(0)
      .setPipeline('Light2D')
      .setDepth(config.render.rockObstacle);

    return { edge, far, image };
  }
}

/** Closes a half's water edge along the far side of the rock. */
function outline(edge: Point[], far: number): Point[] {
  return [...edge, { x: settings.width, y: far }];
}

/** The half above the crack: from the far end of the crack out along its roof, then up the face. */
function upperEdge(rng: Rng): Point[] {
  const { width, height, funnel, roof, mouth, mouthJitter, face } = settings;
  const points: Point[] = [{ x: width, y: 0 }];

  for (let x = width - roof.step; x > funnel; x -= roof.step) {
    points.push({ x, y: between(rng, -roof.wave, roof.wave) });
  }

  points.push({ x: funnel, y: 0 });
  mouth.forEach(([share, rise]) => {
    points.push({ x: funnel * share, y: -(rise + between(rng, -mouthJitter, mouthJitter)) });
  });

  for (let y = face.from; y < height; y += between(rng, face.step.min, face.step.max)) {
    points.push({ x: between(rng, -face.jag, face.jag), y: -y });
  }

  points.push({ x: 0, y: -height });

  return points;
}
