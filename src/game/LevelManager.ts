import Phaser from 'phaser';
import type { CurrentZone, LevelTextures } from '../config';
import { config } from '../config';
import { ensureTrenchBackdrop, TRENCH_BACKDROP } from './art/backdrop';

interface LevelCreateConfig {
  textures: LevelTextures,
  vertical?: boolean,
  currentZones?: CurrentZone[],
}

interface LevelLayer {
  sprite: Phaser.GameObjects.TileSprite,
  /** Camera scroll multiplier applied to the tile offset. */
  parallax: number,
  /** Scale the layer up so it always covers the viewport instead of using the native texture height. */
  cover: boolean,
  textureHeight: number,
}

const FOREGROUND_DEPTH = config.render.foreground;
const FOREGROUND_PARALLAX = 3;
const FAR_PARALLAX = 0.2;

export class LevelManager {
  private readonly scene: Phaser.Scene;
  private readonly layers: LevelLayer[] = [];
  private vertical = false;
  private planktonEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private planktonZone?: Phaser.Geom.Rectangle;
  private sparkleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createLevel({ textures, vertical = false, currentZones = [] }: LevelCreateConfig) {
    this.vertical = vertical;

    this.createFarLayer(textures.backgroundFar);

    if (textures.background) {
      this.createLayer(textures.background, 1, false);
    }

    if (textures.foreground) {
      this.createLayer(textures.foreground, FOREGROUND_PARALLAX, true).sprite.setDepth(FOREGROUND_DEPTH);
    }

    this.createPlanktonEmitter();
    currentZones.forEach(zone => this.createCurrentEmitter(zone));
  }

  update() {
    const { scrollX, scrollY } = this.scene.cameras.main;

    this.layers.forEach(layer => {
      layer.sprite.tilePositionX = scrollX * layer.parallax;

      if (this.vertical) {
        layer.sprite.tilePositionY = scrollY * layer.parallax;
      }
    });

    this.planktonEmitter?.setPosition(scrollX, scrollY);
  }

  /** A short burst of light where a mollusk was eaten. */
  sparkle(x: number, y: number) {
    const { count } = config.mollusk.sparkle;

    this.sparkleEmitter ??= this.createSparkleEmitter();
    this.sparkleEmitter.explode(count, x, y);
  }

  resize() {
    this.layers.forEach(layer => this.layoutLayer(layer));
    this.planktonZone?.setSize(this.scene.scale.width, this.scene.scale.height);
  }

  /**
   * Painted backdrops are softened with a blur pass. The generated trench backdrop is drawn
   * small and stretched instead, which gives the same softness without a per-frame filter.
   */
  private createFarLayer(texture: string) {
    if (texture !== TRENCH_BACKDROP) {
      this.createLayer(texture, FAR_PARALLAX, true).sprite.postFX.addBlur(1);
      return;
    }

    this.createLayer(ensureTrenchBackdrop(this.scene), FAR_PARALLAX, true).sprite
      .setTileScale(config.trench.backdrop.tileScale);
  }

  /**
   * Every layer is viewport sized and scrolled through its tile offset: a layer as wide as the
   * level would allocate a texture far beyond the GPU limits on long levels.
   */
  private createLayer(texture: string, parallax: number, cover: boolean) {
    const source = this.scene.textures.get(texture).getSourceImage();

    const layer: LevelLayer = {
      sprite: this.scene.add.tileSprite(0, 0, source.width, source.height, texture)
        .setOrigin(0, 1)
        .setScrollFactor(0)
        .setPipeline('Light2D'),
      textureHeight: source.height,
      parallax,
      cover,
    };

    this.layoutLayer(layer);
    this.layers.push(layer);

    return layer;
  }

  private layoutLayer({ sprite, cover, textureHeight }: LevelLayer) {
    const { width, height } = this.scene.scale;

    sprite.setScale(1);

    if (this.vertical) {
      sprite.setSize(width, height);
    } else if (cover) {
      sprite.setScale(Math.max(width / sprite.width, height / sprite.height));
    } else {
      sprite.setSize(width, textureHeight);
    }

    sprite.setPosition(0, height);
  }

  private createPlanktonEmitter() {
    this.planktonZone = new Phaser.Geom.Rectangle(0, 0, this.scene.scale.width, this.scene.scale.height);

    this.planktonEmitter = this.scene.add.particles(0, 0, 'planktonParticle', {
      emitZone: { type: 'random', source: this.planktonZone },
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

  private createSparkleEmitter() {
    const { speed, lifespanMs, tint, scale } = config.mollusk.sparkle;

    return this.scene.add.particles(0, 0, 'planktonParticle', {
      lifespan: lifespanMs,
      speed: { min: speed * 0.3, max: speed },
      scale: { start: scale, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint,
      gravityY: 0,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(config.render.player + 1);
  }

  /** Currents live in world space so they stay put as the camera moves through them. */
  private createCurrentEmitter(zone: CurrentZone) {
    const { particleSpeed, particleSpread, particleLifeMs, particleEveryMs } = config.current;
    const width = this.scene.physics.world.bounds.width;
    const speedX = (zone.forceX ?? 0) * particleSpeed;
    const speedY = (zone.forceY ?? 0) * particleSpeed;

    const emitter = this.scene.add.particles(0, zone.y, 'planktonParticle', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, width, zone.height) },
      lifespan: particleLifeMs,
      speedX: { min: speedX * 0.6 - particleSpread, max: speedX * 1.4 + particleSpread },
      speedY: { min: speedY * 0.6 - particleSpread, max: speedY * 1.4 + particleSpread },
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.55, end: 0 },
      quantity: 2,
      frequency: particleEveryMs,
      gravityY: 0,
      blendMode: Phaser.BlendModes.ADD,
    });

    emitter.setPipeline('Light2D');
  }
}
