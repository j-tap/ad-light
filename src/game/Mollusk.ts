import Phaser from 'phaser';
import { config } from '../config';

export class Mollusk {
  private scene: Phaser.Scene;
  private readonly lightRadius: number = config.mollusk.lightRadius;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly light: Phaser.GameObjects.Light;
  private readonly rotationAngle: number = 7;
  private readonly floatDistance: number = 5;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = scene.add.sprite(x, y, 'mollusk')
      .setScale(0.6)
      .setPipeline('Light2D');

    this.light = scene.lights.addLight(x, y, this.lightRadius, 0x66ccff, 1);

    scene.tweens.add({
      targets: this.sprite,
      rotation: { from: Phaser.Math.DegToRad(-this.rotationAngle), to: Phaser.Math.DegToRad(this.rotationAngle) },
      yoyo: true,
      repeat: -1,
      duration: Phaser.Math.Between(1200, 1600),
      delay: Phaser.Math.Between(0, 800),
      ease: 'Sine.easeInOut'
    });

    scene.tweens.add({
      targets: this.sprite,
      y: { from: y - this.floatDistance, to: y + this.floatDistance },
      yoyo: true,
      repeat: -1,
      duration: Phaser.Math.Between(1800, 2500),
      delay: Phaser.Math.Between(0, 1000),
      ease: 'Sine.easeInOut'
    });
  }

  getSprite() {
    return this.sprite;
  }

  destroy() {
    this.scene.lights.removeLight(this.light);
    this.sprite.destroy();
  }
}
