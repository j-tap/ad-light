import Phaser from 'phaser';
import { config } from '../config';
import { EnemyKraken } from './enemies/Kraken';
import { Player } from './Player';
import { KrakenTentacleStrike, TentacleSide } from './KrakenTentacleStrike';

const settings = config.tentacle.strike;
const RETRY_MS = 500;

/** Paces the arm strikes during the chase: one at a time, alternating floor and ceiling. */
export class KrakenTentacleDirector {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly kraken: EnemyKraken;
  private readonly worldHeight: () => number;
  private activeStrike?: KrakenTentacleStrike;
  private timer?: Phaser.Time.TimerEvent;
  private running = false;
  private lastSide: TentacleSide = 'bottom';
  private strikes = 0;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    kraken: EnemyKraken,
    worldHeight: () => number,
  ) {
    this.scene = scene;
    this.player = player;
    this.kraken = kraken;
    this.worldHeight = worldHeight;
  }

  start() {
    if (this.running) return;

    this.running = true;
    this.scheduleNext(settings.initialDelayMs);
  }

  stop() {
    this.running = false;
    this.timer?.remove();
    this.activeStrike?.destroy();
    this.activeStrike = undefined;
  }

  update(delta: number) {
    this.activeStrike?.update(delta);
  }

  private scheduleNext(delayMs: number) {
    this.timer?.remove();
    this.timer = this.scene.time.delayedCall(delayMs, () => this.tryStrike());
  }

  private tryStrike() {
    if (!this.running) return;

    const playerX = this.player.getSprite().x;

    if (playerX >= settings.endWorldX) {
      this.stop();
      return;
    }

    if (this.activeStrike || playerX < settings.startWorldX || !this.player.isAlive()) {
      this.scheduleNext(RETRY_MS);
      return;
    }

    const side: TentacleSide = this.lastSide === 'bottom' ? 'top' : 'bottom';

    this.lastSide = side;
    this.strikes++;

    this.activeStrike = new KrakenTentacleStrike(
      this.scene,
      side,
      this.worldHeight(),
      this.player,
      this.kraken,
      this.strikes <= settings.hintCount,
      () => {
        this.activeStrike = undefined;

        if (this.running) {
          this.scheduleNext(Phaser.Math.Between(settings.intervalMs.min, settings.intervalMs.max));
        }
      },
    );
  }
}
