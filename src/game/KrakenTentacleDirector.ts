import Phaser from 'phaser';
import { config } from '../config';
import { EnemyKraken } from './enemies/Kraken';
import { Player } from './Player';
import { KrakenTentacleStrike, TentacleSide } from './KrakenTentacleStrike';

export class KrakenTentacleDirector {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly kraken: EnemyKraken;
  private readonly worldHeight: number;
  private activeStrike?: KrakenTentacleStrike;
  private timer?: Phaser.Time.TimerEvent;
  private running = false;
  private lastSide: TentacleSide = 'bottom';

  constructor(
    scene: Phaser.Scene,
    player: Player,
    kraken: EnemyKraken,
    worldHeight: number,
  ) {
    this.scene = scene;
    this.player = player;
    this.kraken = kraken;
    this.worldHeight = worldHeight;
  }

  start() {
    if (this.running) return;

    this.running = true;
    this.scheduleNext(config.tentacle.initialDelayMs);
  }

  stop() {
    this.running = false;
    this.timer?.remove();
    this.activeStrike?.destroy();
    this.activeStrike = undefined;
  }

  update() {
    this.activeStrike?.update(this.scene.time.now);
  }

  private scheduleNext(delayMs: number) {
    this.timer?.remove();
    this.timer = this.scene.time.delayedCall(delayMs, () => this.tryStrike());
  }

  private tryStrike() {
    if (!this.running) return;

    if (this.activeStrike) {
      this.scheduleNext(400);
      return;
    }

    const { targetOffsetX, intervalMs, startWorldX, endWorldX } = config.tentacle;
    const playerX = this.player.getSprite().x;

    if (playerX < startWorldX) {
      this.scheduleNext(600);
      return;
    }

    if (playerX >= endWorldX) {
      this.stop();
      return;
    }

    const side: TentacleSide = this.lastSide === 'bottom' ? 'top' : 'bottom';
    this.lastSide = side;

    const offsetX = Phaser.Math.Between(targetOffsetX.min, targetOffsetX.max);

    this.activeStrike = new KrakenTentacleStrike(
      this.scene,
      side,
      this.worldHeight,
      this.player,
      this.kraken,
      offsetX,
      () => {
        this.activeStrike = undefined;
        if (!this.running) return;

        this.scheduleNext(Phaser.Math.Between(intervalMs.min, intervalMs.max));
      },
    );
  }
}
