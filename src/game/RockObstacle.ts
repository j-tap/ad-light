import Phaser from 'phaser';
import { config, RockObstacleDef, type RockSide } from '../config';

const ROCK_TEXTURE_PREFIX = 'rock_obstacle_';
let rockIdCounter = 0;

/** Inset from the silhouette bounding box to keep the collider inside visible pixels. */
const COLLIDER_INSET = 12;

export class RockObstacle {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly body: Phaser.Physics.Arcade.StaticBody;
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private shaking = false;
  /** Bounding box of the silhouette points inside the texture (local coords). */
  private silhouetteBounds = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    scene: Phaser.Scene,
    def: RockObstacleDef,
    worldWidth: number,
    worldHeight: number,
  ) {
    this.scene = scene;

    const { rock } = config;
    const textureKey = this.generateTexture(def.width, def.height, def.side);

    const pos = this.resolvePosition(def, worldHeight, worldWidth);

    this.sprite = scene.add.sprite(pos.x, pos.y, textureKey)
      .setOrigin(0.5)
      .setPipeline('Light2D')
      .setDepth(5);

    scene.physics.add.existing(this.sprite, true);
    this.body = this.sprite.body as Phaser.Physics.Arcade.StaticBody;
    this.fitColliderToSilhouette(def.side);

    this.emitter = scene.add.particles(pos.x, pos.y, 'planktonParticle', {
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(
          -def.width / 2 - 20, -def.height / 2 - 20,
          def.width + 40, def.height + 40,
        ),
      },
      lifespan: 3500,
      speedX: { min: -8, max: 8 },
      speedY: { min: -8, max: 8 },
      scale: { start: 0.15, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: rock.particleColor,
      quantity: 1,
      frequency: Math.max(200, 3000 / rock.particleCount),
      gravityY: 0,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.emitter.setPipeline('Light2D');
  }

  getSprite() {
    return this.sprite;
  }

  getBody() {
    return this.body;
  }

  onPlayerCollision() {
    if (this.shaking) return;

    this.shaking = true;

    const { hitShakeDuration, hitShakeIntensity } = config.rock;
    const originX = this.sprite.x;
    const originY = this.sprite.y;

    this.scene.tweens.add({
      targets: this.sprite,
      x: { value: originX + hitShakeIntensity, yoyo: true, repeat: 3, duration: hitShakeDuration / 6 },
      y: { value: originY + hitShakeIntensity * 0.5, yoyo: true, repeat: 3, duration: hitShakeDuration / 6 },
      onComplete: () => {
        this.sprite.setPosition(originX, originY);
        this.shaking = false;
      },
    });
  }

  getDeadZone(): Phaser.Geom.Rectangle {
    const pad = config.rock.molluskDeadZone;

    return new Phaser.Geom.Rectangle(
      this.sprite.x - this.sprite.displayWidth / 2 - pad,
      this.sprite.y - this.sprite.displayHeight / 2 - pad,
      this.sprite.displayWidth + pad * 2,
      this.sprite.displayHeight + pad * 2,
    );
  }

  /**
   * Fit the rectangular physics body to the bounding box of the generated silhouette
   * points, with an inset so the player doesn't collide with transparent edges.
   * The wall-anchored edge stays flush (no inset there).
   */
  private fitColliderToSilhouette(side: RockSide) {
    const b = this.silhouetteBounds;
    const ins = COLLIDER_INSET;

    let x = b.x;
    let y = b.y;
    let w = b.w;
    let h = b.h;

    if (side !== 'left') { x += ins; w -= ins; }
    if (side !== 'right') { w -= ins; }
    if (side !== 'top') { y += ins; h -= ins; }
    if (side !== 'bottom') { h -= ins; }

    this.body.setSize(Math.max(w, 8), Math.max(h, 8));
    this.body.setOffset(x, y);
  }

  private resolvePosition(def: RockObstacleDef, worldHeight: number, worldWidth: number) {
    switch (def.side) {
      case 'top':
        return { x: def.x + def.width / 2, y: def.height / 2 };
      case 'bottom':
        return { x: def.x + def.width / 2, y: worldHeight - def.height / 2 };
      case 'left':
        return { x: def.width / 2, y: def.y + def.height / 2 };
      case 'right':
        return { x: worldWidth - def.width / 2, y: def.y + def.height / 2 };
    }
  }

  private generateTexture(w: number, h: number, side: RockSide): string {
    const key = `${ROCK_TEXTURE_PREFIX}${rockIdCounter++}`;
    const { edgeColor, bodyColor, edgeWidth } = config.rock;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const points = this.generateSilhouette(w, h, side);

    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (const p of points) {
      if (p.x! < minX) minX = p.x!;
      if (p.x! > maxX) maxX = p.x!;
      if (p.y! < minY) minY = p.y!;
      if (p.y! > maxY) maxY = p.y!;
    }
    this.silhouetteBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

    const path = new Path2D();
    path.moveTo(points[0].x!, points[0].y!);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x!, points[i].y!);
    }
    path.closePath();

    const baseR = (bodyColor >> 16) & 0xff;
    const baseG = (bodyColor >> 8) & 0xff;
    const baseB = bodyColor & 0xff;

    // Gradient fill matching the anchor side (darker towards open edge)
    const gx0 = side === 'right' ? w : 0;
    const gy0 = side === 'bottom' ? h : 0;
    const gx1 = side === 'left' ? w : side === 'right' ? 0 : gx0;
    const gy1 = side === 'top' ? h : side === 'bottom' ? 0 : gy0;
    const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    grad.addColorStop(0, `rgb(${baseR + 18},${baseG + 18},${baseB + 12})`);
    grad.addColorStop(0.5, `rgb(${baseR},${baseG},${baseB})`);
    grad.addColorStop(1, `rgb(${Math.max(baseR - 10, 0)},${Math.max(baseG - 10, 0)},${Math.max(baseB - 6, 0)})`);

    ctx.save();
    ctx.clip(path);

    ctx.fillStyle = grad;
    ctx.fill(path);

    // Grain noise for texture
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const noise = (Math.random() - 0.5) * 22;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.7));
    }
    ctx.putImageData(imageData, 0, 0);

    ctx.restore();

    // Edge highlight (only on the open side)
    const edgeR = (edgeColor >> 16) & 0xff;
    const edgeG = (edgeColor >> 8) & 0xff;
    const edgeB = edgeColor & 0xff;
    ctx.strokeStyle = `rgba(${edgeR},${edgeG},${edgeB},0.45)`;
    ctx.lineWidth = edgeWidth;
    ctx.stroke(path);

    // Inner shadow line for depth
    ctx.save();
    ctx.clip(path);
    ctx.strokeStyle = `rgba(0,0,0,0.35)`;
    ctx.lineWidth = edgeWidth + 3;
    ctx.stroke(path);
    ctx.restore();

    if (this.scene.textures.exists(key)) {
      this.scene.textures.remove(key);
    }
    this.scene.textures.addCanvas(key, canvas);

    return key;
  }

  /**
   * Generate a jagged silhouette anchored to one side.
   * The "open" edge undulates around 60–80% of the dimension (not full extent),
   * keeping the visible shape closer to the physics rectangle.
   */
  private generateSilhouette(
    w: number,
    h: number,
    side: RockSide,
  ): Phaser.Types.Math.Vector2Like[] {
    const points: Phaser.Types.Math.Vector2Like[] = [];
    const segments = 10 + Math.floor(Math.random() * 3);
    const jX = w * 0.06;
    const jY = h * 0.06;

    switch (side) {
      case 'top': {
        points.push({ x: 0, y: 0 });
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          points.push({
            x: t * w + (Math.random() - 0.5) * jX,
            y: h * (0.6 + Math.random() * 0.25) + (Math.random() - 0.5) * jY,
          });
        }
        points.push({ x: w, y: 0 });
        break;
      }
      case 'bottom': {
        points.push({ x: 0, y: h });
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          points.push({
            x: t * w + (Math.random() - 0.5) * jX,
            y: h * (0.15 + Math.random() * 0.25) + (Math.random() - 0.5) * jY,
          });
        }
        points.push({ x: w, y: h });
        break;
      }
      case 'left': {
        points.push({ x: 0, y: 0 });
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          points.push({
            x: w * (0.6 + Math.random() * 0.25) + (Math.random() - 0.5) * jX,
            y: t * h + (Math.random() - 0.5) * jY,
          });
        }
        points.push({ x: 0, y: h });
        break;
      }
      case 'right': {
        points.push({ x: w, y: 0 });
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          points.push({
            x: w * (0.15 + Math.random() * 0.25) + (Math.random() - 0.5) * jX,
            y: t * h + (Math.random() - 0.5) * jY,
          });
        }
        points.push({ x: w, y: h });
        break;
      }
    }

    return points;
  }
}
