import Phaser from 'phaser';
import { BubbleEmitter, BubbleEmitterConfig } from '../BubbleEmitter';
import { NoiseField } from '../systems/NoiseField';
import { config } from '../../config';

export interface EnemyContext {
  playerX: number,
  playerY: number,
  isPlayerAlive: boolean,
  playerLightRadius: number,
  noise: NoiseField,
}

export interface EnemySenses {
  hearRadius: number,
  hearingFactor: number,
  sightFactor: number,
}

export interface EnemyLightConfig {
  radius: number,
  color: number,
  intensity: number,
  offsetX?: number,
  offsetY?: number,
}

export interface EnemyHitAreaConfig {
  width: number,
  height: number,
  offsetX?: number,
  offsetY?: number,
}

export interface BaseEnemyConfig {
  texture: string,
  senses: EnemySenses,
  animation?: string,
  /** Set when the artwork looks left, so facing and attachment offsets stay in sync. */
  facesLeft?: boolean,
  /** Self glowing creatures skip the light pipeline so they stay visible in the dark. */
  lit?: boolean,
  drag?: number,
  bounce?: number,
  bodySize?: { width: number, height: number },
  light?: EnemyLightConfig,
  hitArea?: EnemyHitAreaConfig,
  bubbles?: BubbleEmitterConfig,
}

const BOUNDS_PADDING = 10;
const { lightDetectionFactor, alertThreshold } = config.noise;

export abstract class BaseEnemy {
  protected readonly scene: Phaser.Scene;
  protected readonly sprite: Phaser.Physics.Arcade.Sprite;
  protected readonly senses: EnemySenses;
  private readonly facesLeft: boolean;
  /** Where the player was last noticed: enemies commit to this, not to the live position. */
  protected sensedX = 0;
  protected sensedY = 0;
  private damaging = true;
  private readonly light?: Phaser.GameObjects.Light;
  private readonly lightConfig?: EnemyLightConfig;
  private readonly hitArea?: Phaser.GameObjects.Rectangle;
  private readonly hitAreaConfig?: EnemyHitAreaConfig;
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly bubbles?: BubbleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number, config: BaseEnemyConfig) {
    this.scene = scene;
    this.senses = config.senses;
    this.facesLeft = config.facesLeft === true;
    this.sprite = this.createSprite(x, y, config);

    if (config.light) {
      this.lightConfig = config.light;
      this.light = scene.lights.addLight(x, y, config.light.radius, config.light.color, config.light.intensity);
    }

    if (config.hitArea) {
      this.hitAreaConfig = config.hitArea;
      this.hitArea = this.createHitArea(config.hitArea);
    }

    if (config.bubbles) {
      this.bubbles = new BubbleEmitter(scene, this.sprite, config.bubbles);
    }

    this.updateAttachments();
  }

  update(delta: number, context: EnemyContext) {
    this.think(delta, context);
    this.keepInsideBounds();
    this.updateAttachments();
  }

  getSprite() {
    return this.sprite;
  }

  getHitArea() {
    return this.hitArea;
  }

  bounceOffBounds(body: Phaser.Physics.Arcade.Body) {
    if (body.blocked.left || body.blocked.right) {
      body.setVelocityX(-body.velocity.x);
    }
    if (body.blocked.up || body.blocked.down) {
      body.setVelocityY(-body.velocity.y);
    }
  }

  /** Physics groups re-enable bodies on add, so a plain flag decides who can bite. */
  canDamage() {
    return this.damaging;
  }

  /** True while the enemy is committed to an attack, which is what drives the camera. */
  isHunting() {
    return false;
  }

  onPlayerHit() {}

  destroy() {
    this.timers.forEach(timer => timer.remove(false));
    this.timers.length = 0;
    this.bubbles?.stop();

    if (this.light) {
      this.scene.lights.removeLight(this.light);
    }

    this.hitArea?.destroy();
    this.sprite.destroy();
  }

  protected abstract think(delta: number, context: EnemyContext): void;

  protected get body() {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }

  /**
   * How strongly the player stands out right now, 0..1. Hearing reacts to movement noise,
   * sight to the player light, so dimming the light and slowing down both help to hide.
   */
  protected sensePlayer(context: EnemyContext) {
    let level = 0;

    if (this.senses.hearingFactor > 0) {
      const ping = context.noise.getAudiblePing(this.sprite.x, this.sprite.y, this.senses.hearRadius);

      if (ping) {
        level = context.noise.getLoudness(ping) * this.senses.hearingFactor;
        this.sensedX = ping.x;
        this.sensedY = ping.y;
      }
    }

    if (this.senses.sightFactor > 0) {
      const range = context.playerLightRadius * lightDetectionFactor;
      const distance = this.distanceTo(context.playerX, context.playerY);

      if (distance < range) {
        const visibility = (1 - distance / range) * this.senses.sightFactor;

        if (visibility > level) {
          level = visibility;
          this.sensedX = context.playerX;
          this.sensedY = context.playerY;
        }
      }
    }

    return level;
  }

  protected isAlerted(context: EnemyContext) {
    return this.sensePlayer(context) > alertThreshold;
  }

  /** Timers registered here are removed together with the enemy. */
  protected addTimer(config: Phaser.Types.Time.TimerEventConfig) {
    const timer = this.scene.time.addEvent(config);

    this.timers.push(timer);

    return timer;
  }

  protected delay(ms: number, callback: () => void) {
    this.scene.time.delayedCall(ms, () => {
      if (!this.sprite.active) return;
      callback();
    });
  }

  protected setDamaging(damaging: boolean) {
    this.damaging = damaging;
  }

  protected setLightIntensity(intensity: number) {
    if (this.light) {
      this.light.intensity = intensity;
    }
  }

  protected setLightRadius(radius: number) {
    this.light?.setRadius(radius);
  }

  protected faceTowards(x: number, minDistance = 30) {
    const distanceX = x - this.sprite.x;

    if (Math.abs(distanceX) > minDistance) {
      this.setFacing(distanceX);
    }
  }

  protected faceVelocity() {
    if (this.body.velocity.x !== 0) {
      this.setFacing(this.body.velocity.x);
    }
  }

  protected isFacingLeft() {
    return this.facesLeft !== this.sprite.flipX;
  }

  private setFacing(directionX: number) {
    this.sprite.setFlipX(this.facesLeft ? directionX > 0 : directionX < 0);
  }

  protected moveTowards(x: number, y: number, speed: number) {
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, x, y);

    this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  protected distanceTo(x: number, y: number) {
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, x, y);
  }

  private createSprite(x: number, y: number, config: BaseEnemyConfig) {
    const sprite = this.scene.physics.add.sprite(x, y, config.texture)
      .setCollideWorldBounds(true)
      .setImmovable(false)
      .setBounce(config.bounce ?? 0);

    if (config.lit !== false) {
      sprite.setPipeline('Light2D');
    }

    if (config.drag !== undefined) {
      sprite.setDamping(true).setDrag(config.drag);
    }

    if (config.bodySize) {
      sprite.setSize(config.bodySize.width, config.bodySize.height);
    }

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.onWorldBounds = true;

    if (config.animation) {
      sprite.anims.play(config.animation);
    }

    return sprite;
  }

  private createHitArea(config: EnemyHitAreaConfig) {
    const rect = this.scene.add.rectangle(this.sprite.x, this.sprite.y, config.width, config.height);

    this.scene.physics.add.existing(rect);

    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setImmovable(true);

    return rect.setVisible(false);
  }

  private updateAttachments() {
    const flipSign = this.isFacingLeft() ? -1 : 1;

    if (this.hitArea && this.hitAreaConfig) {
      this.hitArea.setPosition(
        this.sprite.x + (this.hitAreaConfig.offsetX ?? 0) * flipSign,
        this.sprite.y + (this.hitAreaConfig.offsetY ?? 0)
      );
    }

    if (this.light && this.lightConfig) {
      this.light.setPosition(
        this.sprite.x + (this.lightConfig.offsetX ?? 0) * flipSign,
        this.sprite.y + (this.lightConfig.offsetY ?? 0)
      );
    }
  }

  private keepInsideBounds() {
    const { left, right, top, bottom } = this.scene.physics.world.bounds;

    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, left + BOUNDS_PADDING, right - BOUNDS_PADDING);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, top + BOUNDS_PADDING, bottom - BOUNDS_PADDING);
  }
}
