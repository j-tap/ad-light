import Phaser from 'phaser';
import { BaseEnemy, EnemyContext } from './BaseEnemy';
import { ensureTexture } from '../textures';
import { config, TAU } from '../../config';

const settings = config.enemy.jellyfish;
const GLOW_TEXTURE = 'jellyGlow';

/**
 * A living obstacle: it never hunts and never reacts, it just drifts and stings whatever
 * touches it. Its own glow makes it readable in the dark without spending a scene light.
 */
export class Jellyfish extends BaseEnemy {
  private readonly glow: Phaser.GameObjects.Image;
  private readonly driftPhase = Math.random() * TAU;
  private readonly driftDirection = Math.random() < 0.5 ? -1 : 1;
  private pulse = Math.random() * TAU;
  private bell = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      texture: 'jellyfish',
      terrainRadius: config.terrain.enemyRadius.jellyfish,
      lit: false,
      bodySize: settings.bodySize,
      senses: settings.senses,
      hitArea: settings.hitArea,
    });

    this.glow = this.createGlow();
    this.sprite.setAlpha(settings.alpha);
  }

  update(delta: number, context: EnemyContext) {
    super.update(delta, context);

    this.glow.setPosition(this.sprite.x, this.sprite.y);
    this.glow.setScale(settings.glowScale + this.bell * settings.glowPulse);
    this.glow.setAlpha(settings.glowAlpha + this.bell * settings.glowAlphaPulse);
  }

  destroy() {
    this.glow.destroy();
    super.destroy();
  }

  protected think(delta: number, _context: EnemyContext) {
    this.pulse += (delta / settings.pulseMs) * TAU;
    this.bell = Math.sin(this.pulse);

    this.sprite.setScale(1 - this.bell * settings.squash, 1 + this.bell * settings.squash);
    this.body.setVelocity(
      Math.sin(this.pulse * settings.driftRatio + this.driftPhase) * settings.driftSpeed * this.driftDirection,
      // The bell contracts and the jellyfish rises, then it sinks back while relaxing.
      -this.bell * settings.riseSpeed
    );
  }

  private createGlow() {
    const { glowRadius, glowColor } = settings;
    const size = glowRadius * 2;

    ensureTexture(this.scene, GLOW_TEXTURE, size, size, graphics => {
      const steps = 8;

      for (let i = steps; i > 0; i--) {
        graphics.fillStyle(glowColor, 0.05);
        graphics.fillCircle(glowRadius, glowRadius, (glowRadius * i) / steps);
      }
    });

    return this.scene.add
      .image(this.sprite.x, this.sprite.y, GLOW_TEXTURE)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.sprite.depth - 1);
  }
}
