import Phaser from 'phaser';
import type { CurrentZone, LevelTextures } from '../config';
import { DEPTH_GRADIENT, EMPTY_TEXTURE, ensureDepthGradient, ensureEmptyTexture } from './textures';

interface LevelCreateConfig {
  textures: LevelTextures,
  plankton: boolean,
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

const FOREGROUND_DEPTH = 10;

export class LevelManager {
  private readonly scene: Phaser.Scene;
  private readonly layers: LevelLayer[] = [];
  private vertical = false;
  private planktonEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private planktonZone?: Phaser.Geom.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createLevel({ textures, plankton, vertical = false, currentZones = [] }: LevelCreateConfig) {
    this.vertical = vertical;

    if (textures.background === DEPTH_GRADIENT || textures.backgroundFar === DEPTH_GRADIENT) {
      ensureDepthGradient(this.scene);
    }

    [textures.foreground, textures.background, textures.backgroundFar].forEach(key => {
      if (key === EMPTY_TEXTURE) ensureEmptyTexture(this.scene);
    });

    this.createLayer(textures.backgroundFar, 0.2, true).sprite.postFX.addBlur(1);
    this.createLayer(textures.background, 1, false);
    this.createLayer(textures.foreground, 3, true).sprite.setDepth(FOREGROUND_DEPTH);

    if (plankton) {
      this.createPlanktonEmitter();
    }

    currentZones.forEach(zone => this.createCurrentEmitter(zone));
  }

  update() {
    const { scrollX, scrollY } = this.scene.cameras.main;

    this.layers.forEach(layer => {
      if (this.vertical) {
        layer.sprite.tilePositionY = scrollY * layer.parallax;
      } else {
        layer.sprite.tilePositionX = scrollX * layer.parallax;
      }
    });

    this.planktonEmitter?.setPosition(scrollX, scrollY);
  }

  resize() {
    this.layers.forEach(layer => this.layoutLayer(layer));
    this.planktonZone?.setSize(this.scene.scale.width, this.scene.scale.height);
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

  /** Currents live in world space so they stay put as the camera dives. */
  private createCurrentEmitter(zone: CurrentZone) {
    const width = this.scene.physics.world.bounds.width;
    const speed = Math.sign(zone.forceX) * Math.max(Math.abs(zone.forceX) * 0.45, 24);

    const emitter = this.scene.add.particles(0, zone.y, 'planktonParticle', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, width, zone.height) },
      lifespan: 3200,
      speedX: { min: speed * 0.6, max: speed * 1.4 },
      speedY: { min: -12, max: 12 },
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.55, end: 0 },
      quantity: 2,
      frequency: 180,
      gravityY: 0,
      blendMode: Phaser.BlendModes.ADD,
    });

    emitter.setPipeline('Light2D');
  }
}
