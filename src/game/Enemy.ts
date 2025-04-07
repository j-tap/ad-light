import { BubbleEmitter } from './BubbleEmitter';
import { config } from '../config';

enum EnemyState {
  Idle,
  Chase,
}

export class Enemy {
  private scene: Phaser.Scene;
  private readonly distanceVisible: number = config.enemy.anglerFish.distanceVision;
  private readonly lightRadius: number = config.enemy.anglerFish.lightRadius;
  private readonly speed: number = config.enemy.anglerFish.speed;
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private light: Phaser.GameObjects.Light;
  private bubbleEmitter: BubbleEmitter;
  private readonly mouthCollider: Phaser.GameObjects.Rectangle;
  private readonly lightOffsetX = 50;
  private readonly lightOffsetY = -20;
  private randomMovementTimer: Phaser.Time.TimerEvent;
  private state: EnemyState = EnemyState.Idle;
  private canAttack = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = this.createSprite(x, y);
    this.light = this.createLight();
    this.mouthCollider = this.createMouthCollider();
    this.bubbleEmitter = new BubbleEmitter(scene, this.sprite);

    this.createTimers();
    this.setupWorldBoundsBounce();
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
    body.setGravity(0, 0);
    body.onWorldBounds = true;

    sprite.setVelocity(
      Phaser.Math.Between(-40, 40),
      Phaser.Math.Between(-40, 40)
    );

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

  private createTimers() {
    this.scene.time.addEvent({
      delay: Phaser.Math.Between(3000, 9000),
      loop: true,
      callback: () => this.bubbleEmitter.emitBurst(1)
    });

    this.randomMovementTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(5000, 15000),
      loop: true,
      callback: () => {
        if (this.state === EnemyState.Idle) {
          const body = this.sprite.body as Phaser.Physics.Arcade.Body;
          body.setVelocity(
            Phaser.Math.Between(-40, 40),
            Phaser.Math.Between(-40, 40)
          );
        }
      }
    });
  }

  private setupWorldBoundsBounce() {
    this.scene.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body) => {
      if (body.gameObject === this.sprite) {
        if (body.blocked.left || body.blocked.right) {
          body.setVelocityX(-body.velocity.x);
        }
        if (body.blocked.up || body.blocked.down) {
          body.setVelocityY(-body.velocity.y);
        }
      }
    });
  }

  update(playerX?: number, playerY?: number, isPlayerAlive: boolean = true) {
    const mouthOffsetX = this.sprite.flipX ? -40 : 40;
    this.mouthCollider.setPosition(this.sprite.x + mouthOffsetX, this.sprite.y + 30);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    this.updateChase(playerX, playerY, isPlayerAlive);
    this.updateFlipAndOffset();
    this.updateLightPosition();
    this.keepInsideBounds(body);

    if (this.state === EnemyState.Idle && Math.abs(body.velocity.x) < 5 && Math.abs(body.velocity.y) < 5) {
      body.setVelocity(
        Phaser.Math.Between(-40, 40),
        Phaser.Math.Between(-40, 40)
      );
    }
  }

  getSprite() {
    return this.sprite;
  }

  getMouthCollider() {
    return this.mouthCollider;
  }

  onPlayerHit() {
    if (!this.canAttack || (this.sprite.frame as any).name === 3) return;

    this.canAttack = false;
    this.sprite.setFrame(3);

    this.scene.time.delayedCall(250, () => {
      this.sprite.anims.play('enemy-swim');
    });

    this.scene.time.delayedCall(1000, () => {
      this.canAttack = true;
    });
  }

  private updateChase(playerX: number, playerY: number, isPlayerAlive: boolean) {
    if (playerX !== undefined && playerY !== undefined && isPlayerAlive && this.canAttack) {
      this.chasePlayer(playerX, playerY);
    }
  }

  private updateFlipAndOffset() {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const flip = body.velocity.x < 0;
    this.sprite.setFlipX(flip);
  }

  private updateLightPosition() {
    const offsetX = this.sprite.flipX ? -this.lightOffsetX : this.lightOffsetX;
    this.light.setPosition(this.sprite.x + offsetX, this.sprite.y + this.lightOffsetY);
  }

  private keepInsideBounds(body: Phaser.Physics.Arcade.Body) {
    const { left, right, top, bottom } = this.scene.physics.world.bounds;
    const { sprite } = this;

    sprite.x = Phaser.Math.Clamp(sprite.x, left + 10, right - 10);
    sprite.y = Phaser.Math.Clamp(sprite.y, top + 10, bottom - 10);
  }

  private createMouthCollider() {
    const rect = this.scene.add.rectangle(this.sprite.x, this.sprite.y, 40, 40, 0xff0000, 0);
    this.scene.physics.add.existing(rect);

    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setImmovable(true);

    return rect;
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
      if (this.state !== EnemyState.Chase) {
        this.setState(EnemyState.Chase, true);
      }

      const angle = Phaser.Math.Angle.Between(x, y, playerX, playerY);
      body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
      this.facePlayer(playerX);
    } else if (this.state !== EnemyState.Idle) {
      this.setState(EnemyState.Idle, false);
    }
  }

  private setState(state: EnemyState, pauseRandom: boolean) {
    this.state = state;
    if (this.randomMovementTimer) {
      this.randomMovementTimer.paused = pauseRandom;
    }
  }
}
