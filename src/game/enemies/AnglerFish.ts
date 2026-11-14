import Phaser from 'phaser';
import { BaseEnemy, EnemyContext } from './BaseEnemy';
import { config, TAU } from '../../config';

enum AnglerState {
  Lure,
  Alert,
  Lunge,
  Recover,
}

const settings = config.enemy.anglerFish;

/**
 * An ambush predator: it holds its post and uses the glowing lure to make the player
 * come close, then strikes once. Its mouth only hurts during the strike, so the light
 * itself is bait rather than a threat.
 */
export class AnglerFish extends BaseEnemy {
  private readonly postX: number;
  private readonly postY: number;
  private state = AnglerState.Lure;
  private stateTime = 0;
  private driftTime = 0;
  private driftDelay = 0;
  private lurePulse = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      texture: 'enemy1',
      terrainRadius: config.terrain.enemyRadius.anglerFish,
      animation: 'enemy-swim',
      drag: 0.9,
      bounce: 0.5,
      senses: settings.senses,
      light: settings.light,
      hitArea: settings.hitArea,
      bubbles: settings.bubbles,
    });

    this.postX = x;
    this.postY = y;
    this.driftDelay = this.nextDriftDelay();

    this.setDamaging(false);
  }

  isHunting() {
    return this.state === AnglerState.Alert || this.state === AnglerState.Lunge;
  }

  onPlayerHit() {
    if (this.state !== AnglerState.Lunge) return;

    this.sprite.setFrame(settings.biteFrame);
    this.delay(settings.biteFrameMs, () => this.sprite.anims.play('enemy-swim'));
    this.enter(AnglerState.Recover);
  }

  protected onTerrainContact() {
    if (this.state === AnglerState.Lunge) {
      this.enter(AnglerState.Recover);
    }
  }

  protected think(delta: number, context: EnemyContext) {
    this.stateTime += delta;

    switch (this.state) {
      case AnglerState.Lure:
        this.lure(delta, context);
        break;
      case AnglerState.Alert:
        this.alert(context);
        break;
      case AnglerState.Lunge:
        this.lunge();
        break;
      case AnglerState.Recover:
        this.recover();
        break;
    }
  }

  private lure(delta: number, context: EnemyContext) {
    this.lurePulse += (delta / settings.lureIntervalMs) * TAU;
    this.setLightIntensity(Phaser.Math.Linear(
      settings.lureIntensityMin,
      settings.lureIntensityMax,
      (Math.sin(this.lurePulse) + 1) / 2
    ));

    this.driftAroundPost(delta);
    this.faceVelocity();

    if (context.isPlayerAlive && this.isAlerted(context)) {
      this.enter(AnglerState.Alert);
    }
  }

  private alert(context: EnemyContext) {
    this.body.setVelocity(0, 0);
    this.setLightIntensity(settings.alertIntensity);
    this.faceTowards(this.sensedX, 0);

    if (this.stateTime < settings.telegraphMs) return;

    const inRange = this.distanceTo(context.playerX, context.playerY) <= settings.lungeRange;

    this.enter(inRange ? AnglerState.Lunge : AnglerState.Recover);

    if (inRange) {
      this.sensedX = context.playerX;
      this.sensedY = context.playerY;
      this.moveTowards(this.sensedX, this.sensedY, settings.lungeSpeed);
      this.faceTowards(this.sensedX, 0);
    }
  }

  private lunge() {
    if (this.stateTime >= settings.lungeDurationMs) {
      this.enter(AnglerState.Recover);
    }
  }

  private recover() {
    this.setLightIntensity(settings.recoverIntensity);

    if (this.distanceTo(this.postX, this.postY) > settings.postDriftRadius) {
      this.moveTowards(this.postX, this.postY, settings.returnSpeed);
      this.faceVelocity();
    }

    if (this.stateTime >= settings.lungeCooldownMs) {
      this.enter(AnglerState.Lure);
    }
  }

  private driftAroundPost(delta: number) {
    if (this.distanceTo(this.postX, this.postY) > settings.postDriftRadius) {
      this.moveTowards(this.postX, this.postY, settings.driftSpeed);
      return;
    }

    this.driftTime += delta;

    if (this.driftTime < this.driftDelay) return;

    this.driftTime = 0;
    this.driftDelay = this.nextDriftDelay();
    this.body.setVelocity(
      Phaser.Math.Between(-settings.driftSpeed, settings.driftSpeed),
      Phaser.Math.Between(-settings.driftSpeed, settings.driftSpeed)
    );
  }

  private enter(state: AnglerState) {
    this.state = state;
    this.stateTime = 0;
    this.setDamaging(state === AnglerState.Lunge);

    if (state !== AnglerState.Lunge) {
      this.body.setVelocity(0, 0);
    }
  }

  private nextDriftDelay() {
    return Phaser.Math.Between(settings.driftIntervalMs.min, settings.driftIntervalMs.max);
  }
}
