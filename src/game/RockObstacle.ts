import Phaser from 'phaser';
import { config, RockObstacleDef, RockSide } from '../config';
import { ensureTexture } from './textures';

const ROCK_TEXTURE_PREFIX = 'rock_obstacle_';
let rockIdCounter = 0;

export class RockObstacle {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly body: Phaser.Physics.Arcade.StaticBody;
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private shaking = false;

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

    return ensureTexture(this.scene, key, w, h, graphics => {
      const points = this.generateSilhouette(w, h, side);

      graphics.fillStyle(bodyColor);
      graphics.beginPath();
      graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        graphics.lineTo(points[i].x, points[i].y);
      }
      graphics.closePath();
      graphics.fillPath();

      graphics.lineStyle(edgeWidth, edgeColor, 0.7);
      graphics.beginPath();
      graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        graphics.lineTo(points[i].x, points[i].y);
      }
      graphics.closePath();
      graphics.strokePath();
    });
  }

  private generateSilhouette(
    w: number,
    h: number,
    side: RockSide,
  ): Phaser.Types.Math.Vector2Like[] {
    const points: Phaser.Types.Math.Vector2Like[] = [];
    const segments = 8 + Math.floor(Math.random() * 4);
    const jitterX = w * 0.12;
    const jitterY = h * 0.15;

    switch (side) {
      case 'top': {
        points.push({ x: 0, y: 0 });
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          points.push({
            x: t * w + (Math.random() - 0.5) * jitterX,
            y: h * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * jitterY,
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
            x: t * w + (Math.random() - 0.5) * jitterX,
            y: h * Math.random() * 0.5 + (Math.random() - 0.5) * jitterY,
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
            x: w * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * jitterX,
            y: t * h + (Math.random() - 0.5) * jitterY,
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
            x: w * Math.random() * 0.5 + (Math.random() - 0.5) * jitterX,
            y: t * h + (Math.random() - 0.5) * jitterY,
          });
        }
        points.push({ x: w, y: h });
        break;
      }
    }

    return points;
  }
}
