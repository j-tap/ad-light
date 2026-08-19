import Phaser from 'phaser';
import { BaseEnemy, EnemyContext } from './BaseEnemy';
import { config } from '../../config';

enum AnglerState {
  Idle,
  Chase,
}

const settings = config.enemy.anglerFish;

export class AnglerFish extends BaseEnemy {
  private readonly idleTimer: Phaser.Time.TimerEvent;
  private state = AnglerState.Idle;
  private canAttack = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      texture: 'enemy1',
      animation: 'enemy-swim',
      drag: 0.9,
      bounce: 0.5,
      light: settings.light,
      hitArea: settings.hitArea,
      bubbles: settings.bubbles,
    });

    this.applyIdleVelocity();

    this.idleTimer = this.addTimer({
      delay: Phaser.Math.Between(settings.idleChangeMs.min, settings.idleChangeMs.max),
      loop: true,
      callback: () => {
        if (this.state !== AnglerState.Idle) return;
        this.applyIdleVelocity();
      },
    });
  }

  onPlayerHit() {
    if (!this.canAttack) return;

    this.canAttack = false;
    this.sprite.setFrame(settings.biteFrame);

    this.delay(settings.biteFrameMs, () => this.sprite.anims.play('enemy-swim'));
    this.delay(settings.attackCooldownMs, () => { this.canAttack = true; });
  }

  protected think(_delta: number, context: EnemyContext) {
    if (context.isPlayerAlive && this.canAttack) {
      this.chasePlayer(context.playerX, context.playerY);
    }

    this.sprite.setFlipX(this.body.velocity.x < 0);

    if (this.state === AnglerState.Idle && this.isNearlyStill()) {
      this.applyIdleVelocity();
    }
  }

  private chasePlayer(playerX: number, playerY: number) {
    if (this.distanceTo(playerX, playerY) >= settings.distanceVision) {
      this.setState(AnglerState.Idle);
      return;
    }

    this.setState(AnglerState.Chase);
    this.moveTowards(playerX, playerY, settings.speed);
    this.faceTowards(playerX);
  }

  private setState(state: AnglerState) {
    if (this.state === state) return;

    this.state = state;
    this.idleTimer.paused = state === AnglerState.Chase;
  }

  private isNearlyStill() {
    const { velocity } = this.body;
    const threshold = settings.idleSpeedThreshold;

    return Math.abs(velocity.x) < threshold && Math.abs(velocity.y) < threshold;
  }

  private applyIdleVelocity() {
    const { idleSpeed } = settings;

    this.body.setVelocity(
      Phaser.Math.Between(-idleSpeed, idleSpeed),
      Phaser.Math.Between(-idleSpeed, idleSpeed)
    );
  }
}
