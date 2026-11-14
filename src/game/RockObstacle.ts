import Phaser from 'phaser';
import { config, RockObstacleDef, type RockSide } from '../config';
import { ROCK_OVERHANG_SHADOW } from './textures';

const COLLIDER_INSET = 0.15;

interface RockLayout {
  x: number,
  y: number,
  originX: number,
  originY: number,
  flipX: boolean,
  shadowDown: boolean,
}

export class RockObstacle {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly side: RockSide;
  private readonly overhangShadow?: Phaser.GameObjects.Image;
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly shakeTargets: Phaser.GameObjects.GameObject[];
  private readonly anchorX: number;
  private readonly anchorY: number;
  private readonly hangsFromTop: boolean;
  private lastHitTime = 0;

  constructor(
    scene: Phaser.Scene,
    def: RockObstacleDef,
    worldWidth: number,
    worldHeight: number,
    markHazard = false,
  ) {
    this.scene = scene;
    this.side = def.side;
    this.hangsFromTop = def.side === 'top';

    const { rock, render } = config;
    const textureKey = this.pickTexture(def.side);
    const layout = this.resolveLayout(def, worldHeight, worldWidth);
    const depth = render.rockObstacle;

    this.anchorX = layout.x;
    this.anchorY = layout.y;

    const displaySize = this.resolveDisplaySize(def, textureKey);

    this.sprite = scene.add.sprite(layout.x, layout.y, textureKey)
      .setDisplaySize(displaySize.width, displaySize.height)
      .setFlipX(layout.flipX)
      .setOrigin(layout.originX, layout.originY)
      .setPipeline('Light2D')
      .setDepth(depth);

    this.overhangShadow = this.createOverhangShadow(
      def,
      layout,
      depth - 1,
      rock,
      displaySize.height,
    );

    if (markHazard) {
      const { hazardGlowColor, hazardGlowStrength, hazardGlowDistance } = rock;
      this.sprite.postFX.addGlow(
        hazardGlowColor,
        hazardGlowStrength,
        0,
        false,
        0.012,
        hazardGlowDistance,
      );
    }

    this.shakeTargets = [
      this.sprite,
      ...(this.overhangShadow ? [this.overhangShadow] : []),
    ];

    this.emitter = scene.add.particles(layout.x, layout.y, 'planktonParticle', {
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(
          -def.width / 2 - 10, -def.height / 2 - 10,
          def.width + 20, def.height + 20,
        ),
      },
      lifespan: 3000,
      speedX: { min: -5, max: 5 },
      speedY: { min: -5, max: 5 },
      scale: { start: 0.1, end: 0 },
      alpha: { start: 0.3, end: 0 },
      tint: rock.particleColor,
      quantity: 1,
      frequency: Math.max(280, 3200 / rock.particleCount),
      gravityY: 0,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.emitter.setPipeline('Light2D');
    this.emitter.setDepth(depth + 1);
  }

  getSprite() {
    return this.sprite;
  }

  overlapsPlayer(playerBounds: Phaser.Geom.Rectangle) {
    return Phaser.Geom.Rectangle.Overlaps(this.getColliderBounds(), playerBounds);
  }

  onPlayerCollision(): boolean {
    const now = this.scene.time.now;

    if (now - this.lastHitTime < config.rock.hitCooldownMs) {
      return false;
    }

    this.lastHitTime = now;

    const { hitShakeDuration, hitShakeIntensity } = config.rock;

    this.scene.tweens.add({
      targets: this.shakeTargets,
      x: { value: this.anchorX + hitShakeIntensity, yoyo: true, repeat: 3, duration: hitShakeDuration / 6 },
      y: { value: this.anchorY + hitShakeIntensity * 0.5, yoyo: true, repeat: 3, duration: hitShakeDuration / 6 },
      onComplete: () => this.resetShakePositions(),
    });

    return true;
  }

  getDeadZone(): Phaser.Geom.Rectangle {
    const pad = config.rock.molluskDeadZone;
    const bounds = this.sprite.getBounds();
    return new Phaser.Geom.Rectangle(
      bounds.centerX - bounds.width / 2 - pad,
      bounds.centerY - bounds.height / 2 - pad,
      bounds.width + pad * 2,
      bounds.height + pad * 2,
    );
  }

  private getColliderBounds() {
    const insW = this.sprite.displayWidth * COLLIDER_INSET;
    const insH = this.sprite.displayHeight * COLLIDER_INSET;
    const bounds = this.sprite.getBounds();

    let x = bounds.left;
    let y = bounds.top;
    let w = bounds.width;
    let h = bounds.height;

    switch (this.side) {
      case 'top':
        h -= insH;
        x += insW; w -= insW * 2;
        break;
      case 'bottom':
        y += insH; h -= insH;
        x += insW; w -= insW * 2;
        break;
      case 'left':
        w -= insW;
        y += insH; h -= insH * 2;
        break;
      case 'right':
        x += insW; w -= insW;
        y += insH; h -= insH * 2;
        break;
    }

    return new Phaser.Geom.Rectangle(x, y, Math.max(w, 8), Math.max(h, 8));
  }

  private resetShakePositions() {
    this.sprite.setPosition(this.anchorX, this.anchorY);

    if (!this.overhangShadow) return;

    const shadowY = this.overhangShadowY(this.anchorY, this.sprite.displayHeight);
    this.overhangShadow.setPosition(this.anchorX, shadowY);
  }

  /** Keep PNG silhouette — squashing to def.height looked like flat squares. */
  private resolveDisplaySize(def: RockObstacleDef, textureKey: string) {
    const source = this.scene.textures.get(textureKey).getSourceImage() as HTMLImageElement;
    const aspect = source.height / source.width;

    if (def.side === 'top' || def.side === 'bottom') {
      const width = def.width;
      return { width, height: width * aspect };
    }

    return { width: def.width, height: def.height };
  }

  /** Soft shadow under overhangs — reads as depth, not a cut-out sprite on void. */
  private createOverhangShadow(
    def: RockObstacleDef,
    layout: RockLayout,
    depth: number,
    rock: typeof config.rock,
    rockHeight: number,
  ): Phaser.GameObjects.Image | undefined {
    if (def.side !== 'top' && def.side !== 'bottom') {
      return undefined;
    }

    const shadowH = rock.overhangShadowHeight;
    const y = this.overhangShadowY(layout.y, rockHeight);

    return this.scene.add.image(layout.x, y, ROCK_OVERHANG_SHADOW)
      .setDisplaySize(def.width * 0.88, shadowH)
      .setOrigin(0.5, layout.shadowDown ? 0 : 1)
      .setFlipY(!layout.shadowDown)
      .setAlpha(rock.overhangShadowAlpha)
      .setDepth(depth)
      .setPipeline('Light2D');
  }

  private overhangShadowY(anchorY: number, rockHeight: number) {
    return this.hangsFromTop ? anchorY + rockHeight : anchorY - rockHeight;
  }

  private pickTexture(side: RockSide): string {
    const pool = config.rock.textures[side === 'right' ? 'left' : side];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private resolveLayout(def: RockObstacleDef, worldHeight: number, worldWidth: number): RockLayout {
    switch (def.side) {
      case 'top':
        return {
          x: def.x + def.width / 2,
          y: 0,
          originX: 0.5,
          originY: 0,
          flipX: false,
          shadowDown: true,
        };
      case 'bottom':
        return {
          x: def.x + def.width / 2,
          y: worldHeight,
          originX: 0.5,
          originY: 1,
          flipX: false,
          shadowDown: false,
        };
      case 'left':
        return {
          x: def.width / 2,
          y: def.y + def.height / 2,
          originX: 0.5,
          originY: 0.5,
          flipX: false,
          shadowDown: false,
        };
      case 'right':
        return {
          x: worldWidth - def.width / 2,
          y: def.y + def.height / 2,
          originX: 0.5,
          originY: 0.5,
          flipX: true,
          shadowDown: false,
        };
    }
  }
}
