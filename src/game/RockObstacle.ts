import Phaser from 'phaser';
import { config, RockObstacleDef } from '../config';
import { paintRock, Point, scatterCracks } from './art/RockPainter';
import { between, createRng } from './art/random';
import { ensureCanvasTexture } from './textures';

const settings = config.rock.obstacle;
const OUTLINE_BLEED = config.rock.paint.outlineWidth;

/**
 * A rock spike hanging from the ceiling or standing on the floor. The artwork and the solid
 * outline come from the same generated shape, so what looks like rock is exactly what blocks.
 */
export class RockObstacle {
  private readonly scene: Phaser.Scene;
  private readonly def: RockObstacleDef;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shape: Point[];
  private collider: Point[] = [];
  private anchorX = 0;
  private lastHitTime = Number.NEGATIVE_INFINITY;

  constructor(scene: Phaser.Scene, def: RockObstacleDef, index: number) {
    const variant = index % settings.variants;

    this.scene = scene;
    this.def = def;
    this.shape = spikeShape(variant);

    this.sprite = scene.add.image(0, 0, ensureSpikeTexture(scene, variant, this.shape))
      .setFlipY(def.side === 'bottom')
      .setFlipX(index % 3 === 1)
      .setPipeline('Light2D')
      .setDepth(config.render.rockObstacle);
  }

  /** The spike is sized from the viewport, so it has to be placed again after every resize. */
  layout(worldHeight: number) {
    const fromTop = this.def.side === 'top';
    const height = Phaser.Math.Clamp(worldHeight * settings.viewportShare, settings.minHeight, settings.maxHeight);
    const width = this.def.width;
    const scaleX = width / settings.textureWidth;
    const scaleY = height / settings.textureHeight;
    const baseY = fromTop ? 0 : worldHeight;

    this.anchorX = this.def.x + width / 2;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite
      .setOrigin(0.5, fromTop ? 0 : 1)
      .setPosition(this.anchorX, baseY)
      .setDisplaySize(width, height);

    this.collider = this.shape.map(point => {
      const localX = (this.sprite.flipX ? settings.textureWidth - point.x : point.x) - settings.textureWidth / 2;
      const reach = point.y * scaleY * settings.colliderInset;

      return {
        x: this.anchorX + localX * scaleX * settings.colliderInset,
        y: fromTop ? baseY + reach : baseY - reach,
      };
    });
  }

  getCollider() {
    return this.collider;
  }

  containsX(x: number, margin: number) {
    return Math.abs(x - this.anchorX) <= this.def.width / 2 + margin;
  }

  /** Returns false while the previous hit is still cooling down. */
  registerHit() {
    const now = this.scene.time.now;
    const { hitCooldownMs, hitShakeDuration, hitShakeIntensity } = config.rock;

    if (now - this.lastHitTime < hitCooldownMs) return false;

    this.lastHitTime = now;

    this.scene.tweens.add({
      targets: this.sprite,
      x: this.anchorX + hitShakeIntensity,
      duration: hitShakeDuration / 6,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.sprite.setX(this.anchorX),
    });

    return true;
  }
}

/** Outline in texture space, base at the top; ordered so the open side is on the right of travel. */
function spikeShape(variant: number): Point[] {
  const { textureWidth, textureHeight, sidePoints, jag, lean, seed } = settings;
  const rng = createRng(seed + variant * 131);
  const halfBase = textureWidth / 2 - OUTLINE_BLEED;
  const tipY = textureHeight - OUTLINE_BLEED * 1.5;
  const leanPx = between(rng, -lean, lean) * textureWidth;
  const taper = between(rng, 0.7, 1.05);
  const right: Point[] = [];
  const left: Point[] = [];

  for (let i = 0; i <= sidePoints; i++) {
    const v = i / sidePoints;
    const centre = textureWidth / 2 + leanPx * Math.pow(v, 1.4);
    const half = halfBase * Math.pow(1 - v, taper) * (1 - v * 0.08) + 10;
    const y = i === 0 ? -OUTLINE_BLEED * 2 : v * tipY * (i === sidePoints ? 1 : between(rng, 0.96, 1.04));
    const wobble = i === 0 || i === sidePoints ? 0 : textureWidth * jag;

    right.push({ x: centre + half + between(rng, -wobble, wobble), y });
    left.push({ x: centre - half + between(rng, -wobble, wobble), y });
  }

  return [...right, ...left.reverse()];
}

/** The spike artwork on its own, for scenery that wants a rock without the obstacle. */
export function spikeTexture(scene: Phaser.Scene, variant: number) {
  return ensureSpikeTexture(scene, variant, spikeShape(variant));
}

function ensureSpikeTexture(scene: Phaser.Scene, variant: number, shape: Point[]) {
  const { textureWidth, textureHeight, seed } = settings;

  return ensureCanvasTexture(scene, `rockSpike-${variant}`, textureWidth, textureHeight, context => {
    const rng = createRng(seed + variant * 977);
    const strata: Point[][] = [];

    for (let y = between(rng, 40, 90); y < textureHeight; y += between(rng, 70, 130)) {
      const tilt = between(rng, -0.12, 0.12);

      strata.push([
        { x: 0, y },
        { x: textureWidth / 2, y: y + tilt * textureWidth / 2 + between(rng, -8, 8) },
        { x: textureWidth, y: y + tilt * textureWidth },
      ]);
    }

    paintRock(
      context,
      { polygon: shape, edge: shape },
      { cracks: scatterCracks(shape, rng), strata },
      { x: 0, y: 0, width: textureWidth, height: textureHeight },
      rng
    );
  });
}
