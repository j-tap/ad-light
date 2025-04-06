import Phaser from 'phaser';

interface LevelCreateConfig {
  backgroundFar: string,
  backgroundNear: string,
}

export class LevelManager {
  private scene: Phaser.Scene;
  private backgroundFar!: Phaser.GameObjects.TileSprite;
  private backgroundNear!: Phaser.GameObjects.TileSprite;
  private planktonEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createLevel(config: LevelCreateConfig) {
    this.createBackground(config.backgroundFar, config.backgroundNear);
    this.createPlanktonEmitter();
    this.createLighting();
  }

  update(time: number, delta: number) {
    this.backgroundFar.tilePositionX = this.scene.cameras.main.scrollX * 0.2;
    this.backgroundNear.tilePositionX = this.scene.cameras.main.scrollX * 0.5;

    if (this.planktonEmitter) {
      this.planktonEmitter.setPosition(
        this.scene.cameras.main.scrollX,
        this.scene.cameras.main.scrollY
      );
    }
  }

  private createBackgroundLayer(texture: string) {
    const bg = this.scene.add.tileSprite(
      0,
      this.scene.scale.height,
      this.scene.scale.width,
      0,
      texture,
    )
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setPipeline('Light2D');

    const textureHeight = this.scene.textures.get(texture).getSourceImage().height;
    const scaleY = this.scene.scale.height / textureHeight;
    bg.setScale(1, scaleY);

    return bg;
  }

  private createBackground(far: string, near: string) {
    this.backgroundFar = this.createBackgroundLayer(far);
    this.backgroundFar.postFX.addBlur()

    this.backgroundNear = this.createBackgroundLayer(near);
  }

  private createPlanktonEmitter() {
    this.planktonEmitter = this.scene.add.particles(0, 0, 'planktonParticle', {
      x: { min: 0, max: this.scene.scale.width },
      y: { min: 0, max: this.scene.scale.height },
      lifespan: 5000,
      speedX: { min: -10, max: 10 },
      speedY: { min: -20, max: -5 },
      scale: { onEmit: () => Phaser.Math.FloatBetween(0.05, 0.4), end: 0 },
      alpha: { start: 0.8, end: 0 },
      rotate: { min: -360, max: 360 },
      tint: { start: 0x6576c3, end: 0x65c37d },
      quantity: Phaser.Math.Between(2, 4),
      frequency: 800,
      gravityY: 0,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.planktonEmitter.setPipeline('Light2D');
  }

  private createLighting() {
    this.scene.lights.enable().setAmbientColor(0x1a2a6c);
  }
}
