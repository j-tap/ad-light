import Phaser from 'phaser';
import { config } from '../config';

const settings = config.mollusk;
const TAU = Math.PI * 2;

/**
 * Mollusks breathe: the closer the player gets, the faster and brighter the pulse, which
 * turns a nest into an audible-looking beacon guiding the player through the dark.
 */
export class Mollusk {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly light: Phaser.GameObjects.Light;
  private readonly baseY: number;
  private pulse = Math.random() * TAU;
  private bob = Math.random() * TAU;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.baseY = y;
    this.sprite = scene.add.sprite(x, y, 'mollusk')
      .setScale(settings.scale)
      .setPipeline('Light2D');

    this.light = scene.lights.addLight(x, y, settings.lightRadius, settings.lightColor, 1);
  }

  update(delta: number, playerX: number, playerY: number) {
    const { pulse: pulseSettings } = settings;
    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.baseY, playerX, playerY);
    const closeness = 1 - Phaser.Math.Clamp(
      (distance - pulseSettings.nearDistance) / (pulseSettings.farDistance - pulseSettings.nearDistance),
      0,
      1
    );
    const period = Phaser.Math.Linear(pulseSettings.slowMs, pulseSettings.fastMs, closeness);
    const wave = Math.sin(this.pulse);

    this.pulse += (delta / period) * TAU;
    this.bob += (delta / pulseSettings.bobMs) * TAU;

    this.sprite.y = this.baseY + Math.sin(this.bob) * pulseSettings.bobDistance;
    this.sprite.rotation = Math.sin(this.bob * 1.4) * pulseSettings.tiltRad;
    this.sprite.setScale(settings.scale * (1 + wave * pulseSettings.scaleAmount * closeness));

    this.light.x = this.sprite.x;
    this.light.y = this.sprite.y;
    this.light.intensity = pulseSettings.intensityBase
      + wave * pulseSettings.intensityAmount * (pulseSettings.closenessFloor + closeness);
  }

  getSprite() {
    return this.sprite;
  }

  destroy() {
    this.scene.lights.removeLight(this.light);
    this.sprite.destroy();
  }
}
