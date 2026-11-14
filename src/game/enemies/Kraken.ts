import Phaser from 'phaser';
import { config } from '../../config';
import { KrakenArm } from '../KrakenArm';
import { ensureCanvasTexture, ensureSoftGlow } from '../textures';
import type { TentacleSide } from '../KrakenTentacleStrike';

const REFERENCE_FRAME_MS = 1000 / 30;
const TAU = Math.PI * 2;

const settings = config.kraken;
const MAW_TEXTURE = 'krakenMaw';
const armSettings = config.tentacle.idle;

export class EnemyKraken {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.Physics.Arcade.Image;
  private readonly mouthCollider: Phaser.GameObjects.Rectangle;
  private readonly glowLight: Phaser.GameObjects.Light;
  private readonly eye: Phaser.GameObjects.Image;
  private readonly maw: Phaser.GameObjects.Image;
  private readonly arms: KrakenArm[];
  private readonly anchor = new Phaser.Math.Vector2();
  private time = 0;
  private isHunting = false;
  private catchUpMultiplier = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.arms = armSettings.map(arm => new KrakenArm(scene, arm.width, config.render.krakenArm));
    this.maw = this.createMaw();
    this.sprite = this.createSprite(x, y);
    this.mouthCollider = this.createMouthCollider();
    this.glowLight = scene.lights.addLight(x, y, settings.glow.radius, settings.glow.color, settings.glow.intensity);
    this.eye = this.createEye();
  }

  update(delta: number, playerX: number, playerY: number) {
    this.time += delta;
    this.facePlayer(playerX);

    if (this.isHunting) {
      this.follow(delta, playerX, playerY);
    }

    this.animateBody();
    this.updateMouthCollider();
    this.updateArms();
    this.updateEye();
    this.updateMaw();
    this.glowLight.setPosition(this.sprite.x, this.sprite.y);
  }

  getSprite() {
    return this.sprite;
  }

  getMouthCollider() {
    return this.mouthCollider;
  }

  /** Where the striking arm leaves the body. */
  getStrikeAnchor(side: TentacleSide, out: Phaser.Math.Vector2) {
    const { offsetX, offsetY } = settings.strikeAnchor[side];

    return this.toWorld(offsetX, offsetY, out);
  }

  setIsHunting(isHunting: boolean) {
    this.isHunting = isHunting;
  }

  applyCatchUp() {
    if (!this.isHunting) return;

    const { krakenCatchUpMultiplier, krakenCatchUpDuration, krakenSurgeDistance } = config.rock;

    this.catchUpMultiplier = krakenCatchUpMultiplier;
    this.sprite.x += krakenSurgeDistance;

    this.scene.time.delayedCall(krakenCatchUpDuration, () => {
      this.catchUpMultiplier = 1;
    });
  }

  private createSprite(x: number, y: number) {
    const sprite = this.scene.physics.add.image(x, y, 'kraken')
      .setOrigin(0.5)
      .setImmovable(true)
      .setDepth(config.render.kraken)
      .setPipeline('Light2D');

    (sprite.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    sprite.setSize(sprite.width / 2, sprite.height / 2);

    return sprite;
  }

  private createMouthCollider() {
    const { width, height } = settings.mouthSize;
    const rect = this.scene.add.rectangle(this.sprite.x, this.sprite.y, width, height)
      .setVisible(false);

    this.scene.physics.add.existing(rect);

    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setImmovable(true);

    return rect;
  }

  /** The artwork is lit like everything else, so the eye gets its own glow to stare out of the dark. */
  private createEye() {
    return this.scene.add.image(this.sprite.x, this.sprite.y, ensureSoftGlow(this.scene))
      .setTint(settings.eye.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(config.render.kraken + 0.5);
  }

  private createMaw() {
    const { width, height, inner, outer } = settings.maw;

    ensureCanvasTexture(this.scene, MAW_TEXTURE, width, height, context => {
      const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);

      gradient.addColorStop(0, inner);
      gradient.addColorStop(0.7, outer);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      context.scale(1, height / width);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, width);
    });

    return this.scene.add.image(0, 0, MAW_TEXTURE).setDepth(config.render.kraken - 0.5);
  }

  private updateMaw() {
    const { offsetX, offsetY, angle } = settings.maw;
    const facing = this.sprite.flipX ? -1 : 1;

    this.toWorld(offsetX, offsetY, this.anchor);
    this.maw
      .setPosition(this.anchor.x, this.anchor.y)
      .setAngle(this.sprite.angle + angle * facing);
  }

  /** Offsets are given on the unflipped artwork and follow the flip and the wobble. */
  private toWorld(offsetX: number, offsetY: number, out: Phaser.Math.Vector2) {
    return out
      .set(this.sprite.flipX ? -offsetX : offsetX, offsetY)
      .rotate(this.sprite.rotation)
      .add(this.sprite);
  }

  /** Frame-rate independent easing towards the player. */
  private follow(delta: number, playerX: number, playerY: number) {
    const step = delta / REFERENCE_FRAME_MS;
    const mouthX = this.sprite.x + this.getMouthOffsetX();
    const mouthY = this.sprite.y + settings.mouthOffsetY;

    this.sprite.x += (playerX - mouthX) * settings.followFactorX * step * this.catchUpMultiplier;
    this.sprite.y += (playerY - mouthY) * settings.followFactorY * step * this.catchUpMultiplier;
  }

  private getMouthOffsetX() {
    return this.sprite.flipX ? -settings.mouthOffsetX : settings.mouthOffsetX;
  }

  private updateMouthCollider() {
    this.mouthCollider.setPosition(
      this.sprite.x + this.getMouthOffsetX(),
      this.sprite.y + settings.mouthOffsetY
    );
  }

  private facePlayer(playerX: number) {
    const distanceX = playerX - this.sprite.x;

    if (Math.abs(distanceX) > 30) {
      this.sprite.setFlipX(distanceX < 0);
    }
  }

  private animateBody() {
    const breath = Math.sin((this.time / settings.breathMs) * TAU) * settings.breathAmount;

    this.sprite.setAngle(Math.sin(this.time * settings.wobbleSpeed) * settings.wobbleAmount);
    this.sprite.setScale(1 + breath, 1 - breath);
  }

  private updateEye() {
    const { eye } = settings;
    const pulse = Math.sin((this.time / eye.pulseMs) * TAU) * eye.pulse;

    this.toWorld(eye.offsetX, eye.offsetY, this.anchor);
    this.eye
      .setPosition(this.anchor.x, this.anchor.y)
      .setScale(eye.scale * (1 + pulse))
      .setAlpha(eye.alpha * (1 + pulse));
  }

  private updateArms() {
    const facing = this.sprite.flipX ? -1 : 1;

    this.arms.forEach((arm, index) => {
      const shape = armSettings[index];
      const angle = Phaser.Math.DegToRad(this.sprite.flipX ? 180 - shape.angle : shape.angle) + this.sprite.rotation;
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      const wave = (this.time / shape.swayMs) * TAU + shape.phase;

      this.toWorld(shape.offsetX, shape.offsetY, this.anchor);

      const { x: anchorX, y: anchorY } = this.anchor;

      arm.setFlipY(facing < 0);
      arm.shape((t, out) => {
        const along = t * shape.length;
        const sway = facing * (
          Math.sin(wave - t * config.tentacle.idleCurl * TAU) * shape.sway * Math.pow(t, 1.4)
          + shape.bend * t * t
        );

        out.set(
          anchorX + directionX * along - directionY * sway,
          anchorY + directionY * along + directionX * sway
        );
      });
    });
  }
}
