import Phaser from 'phaser';

interface LevelCreateConfig {
  backgroundFar: string,
  background: string,
  foreground: string,
}

export class LevelManager {
  private scene: Phaser.Scene;
  private backgroundFar!: Phaser.GameObjects.TileSprite;
  private background!: Phaser.GameObjects.TileSprite;
  private foreground!: Phaser.GameObjects.TileSprite;
  private planktonEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createLevel(config: LevelCreateConfig) {
    this.createBackground(config.backgroundFar, config.background, config.foreground);
    this.createPlanktonEmitter();
    this.createLighting();
  }

  update() {
    this.backgroundFar.tilePositionX = this.scene.cameras.main.scrollX * 0.2;

    if (this.planktonEmitter) {
      this.planktonEmitter.setPosition(
        this.scene.cameras.main.scrollX,
        this.scene.cameras.main.scrollY
      );
    }
  }

  private createBackground(far: string, bg: string, fg: string) {
    this.backgroundFar = this.createBackgroundLayer(far);
    this.backgroundFar.postFX.addBlur(1)

    this.background = this.createBackgroundLayer(bg, true);
    this.foreground = this.createBackgroundLayer(fg, true, true);
  }

  private createBackgroundLayer(texture: string, isStatic = false, isForeground = false) {
    const textureImage = this.scene.textures.get(texture).getSourceImage();
    const textureWidth = textureImage.width;
    const textureHeight = textureImage.height;
    let bg: Phaser.GameObjects.TileSprite;

    if (isStatic) {
      bg = this.scene.add.tileSprite(
        0,
        this.scene.scale.height,
        this.scene.physics.world.bounds.width,
        textureHeight,
        texture
      )
        .setScrollFactor(1)
        .setTileScale(1, 1);
    } else {
      const scaleX = this.scene.scale.width / textureWidth;
      const scaleY = this.scene.scale.height / textureHeight;
      const scale = Math.max(scaleX, scaleY);

      bg = this.scene.add.tileSprite(
        0,
        this.scene.scale.height,
        textureWidth,
        textureHeight,
        texture
      )
        .setScrollFactor(0)
        .setScale(scale);
    }

    bg
      .setPipeline('Light2D')
      .setOrigin(0, 1);

    if (isForeground) {
      bg.setDepth(10);
    }

    return bg;
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
