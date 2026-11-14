import Phaser from 'phaser';
import { config, TAU, REFERENCE_FRAME_MS, TunnelSide } from '../../config';
import { KrakenArm } from '../KrakenArm';
import { addSoftGlow, ensureCanvasTexture } from '../textures';


const settings = config.kraken;
const gapSettings = config.chase.gap;
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
  private hunting = false;
  private baseGap = gapSettings.byLives[gapSettings.byLives.length - 1];
  /** A passing shove from a mistake, a dodge or a surge; it wears off back to zero. */
  private shove = 0;
  private barrierX?: number;
  private onBarrier?: () => void;

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

    if (this.hunting) {
      this.chase(delta, playerX, playerY);
    }

    this.animateBody();
    this.updateMouthCollider();
    this.updateArms();
    this.updateEye();
    this.updateMaw();
    this.glowLight.setPosition(this.sprite.x, this.sprite.y);
  }

  getMouthCollider() {
    return this.mouthCollider;
  }

  /** Where an arm striking from that side leaves the body. */
  getStrikeRoot(side: TunnelSide, out: Phaser.Math.Vector2) {
    const { offsetX, offsetY } = armSettings[config.tentacle.strikeRoot[side]];

    return this.toWorld(offsetX, offsetY, out);
  }

  startHunt() {
    this.hunting = true;
  }

  /** The distance the kraken hangs back at when nothing is happening; set from the fish's lives. */
  setBaseGap(gap: number) {
    this.baseGap = gap;
  }

  /** A mistake by the fish or a surge: the kraken lunges closer for a while. */
  closeIn(distance: number) {
    this.shove = Math.max(this.shove - distance, -gapSettings.maxShove);
  }

  /** A clean dodge: the kraken loses ground for a while. */
  fallBack(distance: number) {
    this.shove = Math.min(this.shove + distance, gapSettings.maxShove);
  }

  /** 0 with the kraken as far behind as it ever gets (or not hunting yet), 1 with the jaws on the fish. */
  getCloseness(playerX: number) {
    return this.hunting ? 1 - Phaser.Math.Clamp(this.measureGap(playerX) / gapSettings.max, 0, 1) : 0;
  }

  /** The jaws cannot pass this x; `onReached` fires once, when they first slam into it. */
  setBarrier(x: number, onReached: () => void) {
    this.barrierX = x;
    this.onBarrier = onReached;
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
    return addSoftGlow(this.scene, this.sprite.x, this.sprite.y, settings.eye.color)
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

  /** Free water between the jaws and the fish. */
  private measureGap(playerX: number) {
    return playerX - (this.sprite.x + this.getMouthOffsetX()) - settings.biteReach;
  }

  /**
   * The kraken cruises at the speed of the fish and corrects towards the gap it wants, so a
   * fish that keeps swimming holds the distance and one that stops is run down.
   */
  private chase(delta: number, playerX: number, playerY: number) {
    const seconds = delta / 1000;
    const mouthY = this.sprite.y + settings.mouthOffsetY;

    const shoveDecay = gapSettings.recoverPerSecond * seconds;

    this.shove = this.shove > 0 ? Math.max(this.shove - shoveDecay, 0) : Math.min(this.shove + shoveDecay, 0);

    const correction = Phaser.Math.Clamp(
      (this.measureGap(playerX) - this.wantedGap()) * gapSettings.gain,
      -gapSettings.maxFallBack,
      gapSettings.maxClosing
    );

    this.sprite.x += (config.player.speed + correction) * seconds;
    this.sprite.y += (playerY - mouthY) * settings.followFactorY * (delta / REFERENCE_FRAME_MS);
    this.stopAtBarrier();
  }

  /** Base distance plus the slow drift and whatever shove is still wearing off. */
  private wantedGap() {
    const { amount, periodMs, secondAmount, secondPeriodMs } = gapSettings.drift;
    const drift = Math.sin((this.time / periodMs) * TAU) * amount
      + Math.sin((this.time / secondPeriodMs) * TAU + 1.3) * secondAmount;

    return Phaser.Math.Clamp(this.baseGap + drift + this.shove, gapSettings.danger, gapSettings.max);
  }

  private stopAtBarrier() {
    if (this.barrierX === undefined) return;

    const limit = this.barrierX - this.getMouthOffsetX() - settings.mouthSize.width / 2;

    if (this.sprite.x < limit) return;

    this.sprite.x = limit;
    this.onBarrier?.();
    this.onBarrier = undefined;
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
