import { BubbleEmitter } from './BubbleEmitter';

const DISTANCE_TO_PLAYER = 300;

enum EnemyState {
  Idle,
  Chase,
}

export class Enemy {
  private scene: Phaser.Scene;
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private light: Phaser.GameObjects.Light;
  private bubbleEmitter: BubbleEmitter;
  private readonly mouthCollider: Phaser.GameObjects.Rectangle;
  private readonly lightOffsetX = 50;
  private readonly lightOffsetY = -20;
  private randomMovementTimer: Phaser.Time.TimerEvent;
  private state: EnemyState = EnemyState.Idle;

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
      32,
      0xf0ff5e,
      10
    );
  }

  private createTimers() {
    this.scene.time.addEvent({
      delay: Phaser.Math.Between(3000, 9000),
      loop: true,
      callback: () => this.bubbleEmitter.emitBurst(1)
    });

    this.randomMovementTimer = this.scene.time.addEvent({
      delay: 2000,
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

  update(playerX?: number, playerY?: number) {
    const mouthOffsetX = this.sprite.flipX ? -40 : 40;
    this.mouthCollider.setPosition(this.sprite.x + mouthOffsetX, this.sprite.y + 30);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (playerX !== undefined && playerY !== undefined) {
      this.chasePlayer(playerX, playerY);
    }

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
    const bounds = this.scene.physics.world.bounds;

    if (this.sprite.x < bounds.left) {
      this.sprite.x = bounds.left + 10;
    } else if (this.sprite.x > bounds.right) {
      this.sprite.x = bounds.right - 10;
    }

    if (this.sprite.y < bounds.top) {
      this.sprite.y = bounds.top + 10;
    } else if (this.sprite.y > bounds.bottom) {
      this.sprite.y = bounds.bottom - 10;
    }
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
    if (playerX < this.sprite.x) {
      this.sprite.setFlipX(true);
    } else {
      this.sprite.setFlipX(false);
    }
  }

  private chasePlayer(playerX: number, playerY: number) {
    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerX, playerY);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (distance < DISTANCE_TO_PLAYER) {
      if (this.state !== EnemyState.Chase) {
        this.state = EnemyState.Chase;
        if (this.randomMovementTimer) {
          this.randomMovementTimer.paused = true;
        }
      }

      const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, playerX, playerY);
      const speed = 80;
      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;

      body.setVelocity(velocityX, velocityY);
      this.facePlayer(playerX);

    } else {
      if (this.state !== EnemyState.Idle) {
        this.state = EnemyState.Idle;
        if (this.randomMovementTimer) {
          this.randomMovementTimer.paused = false;
        }
      }
    }
  }
}
