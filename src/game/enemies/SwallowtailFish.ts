import Phaser from 'phaser';
import { BaseEnemy, EnemyContext } from './BaseEnemy';
import { config } from '../../config';

enum SwallowtailState {
  Patrol,
  Telegraph,
  Dash,
  Recover,
}

const settings = config.enemy.swallowtail;
const TAU = Math.PI * 2;

/**
 * Blind but sharp eared: it ignores the player light entirely and strikes at the spot
 * where it heard a noise, so swimming slowly is the only way past it.
 */
export class SwallowtailFish extends BaseEnemy {
  private state = SwallowtailState.Patrol;
  private stateTime = 0;
  private patrolTime = 0;
  private patrolDelay = 0;
  private patrolDirection = 1;
  private wobble = 0;
  private shakeTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      texture: 'swallowtail',
      facesLeft: true,
      drag: 0.85,
      bounce: 0.4,
      bodySize: settings.bodySize,
      senses: settings.senses,
      hitArea: settings.hitArea,
      bubbles: settings.bubbles,
    });

    this.patrolDelay = this.nextPatrolDelay();
    this.patrolDirection = Math.random() < 0.5 ? -1 : 1;

    this.setDamaging(false);
  }

  isHunting() {
    return this.state === SwallowtailState.Telegraph || this.state === SwallowtailState.Dash;
  }

  onPlayerHit() {
    if (this.state !== SwallowtailState.Dash) return;

    this.enter(SwallowtailState.Recover);
  }

  protected think(delta: number, context: EnemyContext) {
    this.stateTime += delta;

    switch (this.state) {
      case SwallowtailState.Patrol:
        this.patrol(delta, context);
        break;
      case SwallowtailState.Telegraph:
        this.telegraph();
        break;
      case SwallowtailState.Dash:
        this.dash();
        break;
      case SwallowtailState.Recover:
        this.recover();
        break;
    }
  }

  private patrol(delta: number, context: EnemyContext) {
    this.patrolTime += delta;
    this.wobble += (delta / settings.patrolWobbleMs) * TAU;

    if (this.patrolTime >= this.patrolDelay) {
      this.patrolTime = 0;
      this.patrolDelay = this.nextPatrolDelay();
      this.patrolDirection *= -1;
    }

    this.body.setVelocity(
      this.patrolDirection * settings.patrolSpeed,
      Math.sin(this.wobble) * settings.patrolWobble
    );
    this.faceVelocity();

    if (context.isPlayerAlive && this.isAlerted(context)) {
      this.enter(SwallowtailState.Telegraph);
    }
  }

  private telegraph() {
    this.body.setVelocity(0, 0);
    this.faceTowards(this.sensedX, 0);

    if (this.stateTime >= settings.telegraphMs) {
      this.enter(SwallowtailState.Dash);
      this.moveTowards(this.sensedX, this.sensedY, settings.dashSpeed);
      this.scene.sound.play('fishBubble', { volume: 0.25, detune: -600 });
    }
  }

  private dash() {
    if (this.stateTime >= settings.dashDurationMs) {
      this.enter(SwallowtailState.Recover);
    }
  }

  private recover() {
    if (this.stateTime >= settings.cooldownMs) {
      this.enter(SwallowtailState.Patrol);
    }
  }

  private enter(state: SwallowtailState) {
    this.state = state;
    this.stateTime = 0;
    this.setDamaging(state === SwallowtailState.Dash);
    this.toggleShake(state === SwallowtailState.Telegraph);

    if (state === SwallowtailState.Recover) {
      this.body.setVelocity(0, 0);
    }
  }

  /** The wind-up shake is the only warning the player gets before a dash. */
  private toggleShake(active: boolean) {
    if (!active) {
      this.shakeTween?.stop();
      this.shakeTween = undefined;
      this.sprite.setScale(1);
      return;
    }

    this.shakeTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleX: { from: 1, to: 1.12 },
      scaleY: { from: 1, to: 0.9 },
      duration: settings.shakeMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private nextPatrolDelay() {
    return Phaser.Math.Between(settings.patrolTurnMs.min, settings.patrolTurnMs.max);
  }
}
