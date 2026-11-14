import Phaser from 'phaser';
import { config } from '../../config';

const REFERENCE_FRAME_MS = 1000 / 30;

export class EnemyKraken {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.Physics.Arcade.Image;
  private readonly mouthCollider: Phaser.GameObjects.Rectangle;
  private readonly glowLight: Phaser.GameObjects.Light;
  private readonly mouthOffsetX = 200;
  private readonly mouthOffsetY = 150;
  private readonly followFactorX = 0.017;
  private readonly followFactorY = 0.34;
  private readonly wobbleSpeed = 0.005;
  private readonly wobbleAmount = 5;
  private wobbleTime = 0;
  private isHunting = false;
  private catchUpMultiplier = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = this.createSprite(x, y);
    this.mouthCollider = this.createMouthCollider();
    this.glowLight = scene.lights.addLight(x, y, 420, 0x88aacc, 1.35);
  }

  update(delta: number, playerX: number, playerY: number) {
    this.facePlayer(playerX);

    if (this.isHunting) {
      this.follow(delta, playerX, playerY);
    }

    this.updateMouthCollider();
    this.applyWobble(delta);
    this.glowLight.setPosition(this.sprite.x, this.sprite.y);
  }

  getSprite() {
    return this.sprite;
  }

  getMouthCollider() {
    return this.mouthCollider;
  }

  /** Where tentacles appear to emerge from the kraken body. */
  getTentacleAnchor() {
    const forward = this.sprite.flipX ? -1 : 1;

    return {
      x: this.sprite.x + forward * this.sprite.displayWidth * 0.2,
      y: this.sprite.y + this.sprite.displayHeight * 0.12,
    };
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
    const rect = this.scene.add.rectangle(this.sprite.x, this.sprite.y, 300, 200)
      .setVisible(false);

    this.scene.physics.add.existing(rect);

    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setImmovable(true);

    return rect;
  }

  /** Frame-rate independent easing towards the player. */
  private follow(delta: number, playerX: number, playerY: number) {
    const step = delta / REFERENCE_FRAME_MS;
    const mouthX = this.sprite.x + this.getMouthOffsetX();
    const mouthY = this.sprite.y + this.mouthOffsetY;

    this.sprite.x += (playerX - mouthX) * this.followFactorX * step * this.catchUpMultiplier;
    this.sprite.y += (playerY - mouthY) * this.followFactorY * step * this.catchUpMultiplier;
  }

  private getMouthOffsetX() {
    return this.sprite.flipX ? -this.mouthOffsetX : this.mouthOffsetX;
  }

  private updateMouthCollider() {
    this.mouthCollider.setPosition(
      this.sprite.x + this.getMouthOffsetX(),
      this.sprite.y + this.mouthOffsetY
    );
  }

  private facePlayer(playerX: number) {
    const distanceX = playerX - this.sprite.x;

    if (Math.abs(distanceX) > 30) {
      this.sprite.setFlipX(distanceX < 0);
    }
  }

  private applyWobble(delta: number) {
    this.wobbleTime += delta;
    this.sprite.setAngle(Math.sin(this.wobbleTime * this.wobbleSpeed) * this.wobbleAmount);
  }
}
