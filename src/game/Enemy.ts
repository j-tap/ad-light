import Phaser from 'phaser';
import { BubbleEmitter } from './BubbleEmitter';
import { config } from '../config';

enum EnemyState {
  Idle,
  Chase,
}

const IDLE_SPEED = 40;
const IDLE_SPEED_THRESHOLD = 5;

// TODO: Make as base class
export class Enemy {
  private readonly scene: Phaser.Scene;
  private readonly distanceVisible: number = config.enemy.anglerFish.distanceVision;
  private readonly lightRadius: number = config.enemy.anglerFish.lightRadius;
  private readonly speed: number = config.enemy.anglerFish.speed;
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly light: Phaser.GameObjects.Light;
  private readonly mouthCollider: Phaser.GameObjects.Rectangle;
  private readonly lightOffsetX = 50;
  private readonly lightOffsetY = -20;
  private readonly mouthOffsetX = 40;
  private readonly mouthOffsetY = 30;
  private readonly randomMovementTimer: Phaser.Time.TimerEvent;
  private state: EnemyState = EnemyState.Idle;
  private canAttack = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = this.createSprite(x, y);
    this.light = this.createLight();
    this.mouthCollider = this.createMouthCollider();
    new BubbleEmitter(scene, this.sprite, {
      minDelay: 3000,
      maxDelay: 9000,
      maxCount: 1,
    });

    this.randomMovementTimer = this.createRandomMovementTimer();
  }

  update(playerX: number, playerY: number, isPlayerAlive: boolean) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (isPlayerAlive && this.canAttack) {
      this.chasePlayer(playerX, playerY);
    }

    this.updateFlip(body);
    this.updateAttachments();
    this.keepInsideBounds();

    if (
      this.state === EnemyState.Idle &&
      Math.abs(body.velocity.x) < IDLE_SPEED_THRESHOLD &&
      Math.abs(body.velocity.y) < IDLE_SPEED_THRESHOLD
    ) {
      this.applyIdleVelocity(body);
    }
  }

  getSprite() {
    return this.sprite;
  }

  getMouthCollider() {
    return this.mouthCollider;
  }

  bounceOffBounds(body: Phaser.Physics.Arcade.Body) {
    if (body.blocked.left || body.blocked.right) {
      body.setVelocityX(-body.velocity.x);
    }
    if (body.blocked.up || body.blocked.down) {
      body.setVelocityY(-body.velocity.y);
    }
  }

  onPlayerHit() {
    if (!this.canAttack) return;

    this.canAttack = false;
    this.sprite.setFrame(3);

    this.scene.time.delayedCall(250, () => this.sprite.anims.play('enemy-swim'));
    this.scene.time.delayedCall(1000, () => { this.canAttack = true; });
  }

  private createSprite(x: number, y: number) {
    const sprite = this.scene.physics.add.sprite(x, y, 'enemy1')
      .setCollideWorldBounds(true)
      .setImmovable(false)
      .setBounce(0.5)
      .setDamping(true)
      .setDrag(0.9)
      .setPipeline('Light2D');

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.onWorldBounds = true;

    this.applyIdleVelocity(body);
    sprite.anims.play('enemy-swim');

    return sprite;
  }

  private createLight() {
    return this.scene.lights.addLight(
      this.sprite.x + this.lightOffsetX,
      this.sprite.y + this.lightOffsetY,
      this.lightRadius,
      0xf0ff5e,
      4,
    );
  }

  private createMouthCollider() {
    const rect = this.scene.add.rectangle(this.sprite.x, this.sprite.y, 40, 40);
    this.scene.physics.add.existing(rect);

    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setImmovable(true);

    return rect.setVisible(false);
  }

  private createRandomMovementTimer() {
    return this.scene.time.addEvent({
      delay: Phaser.Math.Between(5000, 15000),
      loop: true,
      callback: () => {
        if (this.state !== EnemyState.Idle) return;
        this.applyIdleVelocity(this.sprite.body as Phaser.Physics.Arcade.Body);
      }
    });
  }

  private applyIdleVelocity(body: Phaser.Physics.Arcade.Body) {
    body.setVelocity(
      Phaser.Math.Between(-IDLE_SPEED, IDLE_SPEED),
      Phaser.Math.Between(-IDLE_SPEED, IDLE_SPEED)
    );
  }

  private updateFlip(body: Phaser.Physics.Arcade.Body) {
    this.sprite.setFlipX(body.velocity.x < 0);
  }

  private updateAttachments() {
    const flipSign = this.sprite.flipX ? -1 : 1;

    this.mouthCollider.setPosition(
      this.sprite.x + this.mouthOffsetX * flipSign,
      this.sprite.y + this.mouthOffsetY
    );

    this.light.setPosition(
      this.sprite.x + this.lightOffsetX * flipSign,
      this.sprite.y + this.lightOffsetY
    );
  }

  private keepInsideBounds() {
    const { left, right, top, bottom } = this.scene.physics.world.bounds;

    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, left + 10, right - 10);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, top + 10, bottom - 10);
  }

  private facePlayer(playerX: number) {
    const distanceX = playerX - this.sprite.x;

    if (Math.abs(distanceX) > 30) {
      this.sprite.setFlipX(distanceX < 0);
    }
  }

  private chasePlayer(playerX: number, playerY: number) {
    const { x, y } = this.sprite;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const distance = Phaser.Math.Distance.Between(x, y, playerX, playerY);

    if (distance < this.distanceVisible) {
      this.setEnemyState(EnemyState.Chase);

      const angle = Phaser.Math.Angle.Between(x, y, playerX, playerY);
      body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
      this.facePlayer(playerX);
    } else {
      this.setEnemyState(EnemyState.Idle);
    }
  }

  private setEnemyState(state: EnemyState) {
    if (this.state === state) return;

    this.state = state;
    this.randomMovementTimer.paused = state === EnemyState.Chase;
  }
}
