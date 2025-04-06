import Phaser from 'phaser';

export class Mollusk {
  private scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly light: Phaser.GameObjects.Light;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = scene.add.sprite(x, y, 'mollusk')
      .setScale(0.5)
      .setPipeline('Light2D');

    this.light = scene.lights.addLight(x, y, 70, 0x66ccff, 1.5);

    scene.tweens.add({
      targets: this.sprite,
      rotation: { from: Phaser.Math.DegToRad(-5), to: Phaser.Math.DegToRad(5) },
      yoyo: true,
      repeat: -1,
      duration: 3000,
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
