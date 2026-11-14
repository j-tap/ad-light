import Phaser from 'phaser';
import { config, RockObstacleDef } from '../config';
import { EnemyKraken } from './enemies/Kraken';
import { Player } from './Player';
import { KrakenTentacleStrike, StrikeOutcome } from './KrakenTentacleStrike';

const settings = config.chase.strikes;

/**
 * Paces the arm strikes during the chase and decides where each one goes. The aim is where the
 * fish ends up if it keeps its lane; the arm comes from the side of the tunnel the fish is
 * nearer to, so the way out is always towards the middle; and no strike is aimed at a rock
 * spike, where there would be no room left to dodge. Strikes come faster the closer the
 * kraken is and deeper into the tunnel arrive in pairs.
 */
export class KrakenTentacleDirector {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly kraken: EnemyKraken;
  private readonly worldHeight: () => number;
  private readonly blocked: Array<{ from: number, to: number }>;
  private readonly onHit: () => void;
  private readonly onDodge: () => void;
  private readonly active = new Set<KrakenTentacleStrike>();
  private timer?: Phaser.Time.TimerEvent;
  private running = false;
  private launched = 0;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    kraken: EnemyKraken,
    worldHeight: () => number,
    rocks: RockObstacleDef[],
    onHit: () => void,
    onDodge: () => void,
  ) {
    const { before, after } = settings.rockClearance;

    this.scene = scene;
    this.player = player;
    this.kraken = kraken;
    this.worldHeight = worldHeight;
    this.blocked = rocks.map(rock => ({ from: rock.x - before, to: rock.x + rock.width + after }));
    this.onHit = onHit;
    this.onDodge = onDodge;
  }

  start() {
    if (this.running) return;

    this.running = true;
    this.scheduleNext(settings.initialDelayMs);
  }

  stop() {
    this.running = false;
    this.timer?.remove();
    this.active.forEach(strike => strike.destroy());
    this.active.clear();
  }

  update(delta: number) {
    this.active.forEach(strike => strike.update(delta));
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

    if (playerX < settings.startWorldX || !this.launch()) {
      this.scheduleNext(settings.retryMs);
      return;
    }

    if (playerX >= settings.pair.fromWorldX && Math.random() < settings.pair.chance) {
      this.scene.time.delayedCall(settings.pair.delayMs, () => {
        if (this.running) this.launch();
      });
    }

    this.scheduleNext(this.nextInterval(playerX));
  }

  /** Returns false when there is no fair strike to make right now. */
  private launch() {
    if (this.active.size >= settings.maxActive || !this.player.isAlive()) return false;

    const sprite = this.player.getSprite();
    const velocityX = (sprite.body as Phaser.Physics.Arcade.Body).velocity.x;
    const worldHeight = this.worldHeight();
    const aim = { x: sprite.x + Math.max(velocityX, 0) * (settings.leadMs / 1000), y: sprite.y };

    if (this.blocked.some(zone => aim.x >= zone.from && aim.x <= zone.to)) return false;

    const outcome: StrikeOutcome = {
      onHit: this.onHit,
      onDone: hit => {
        this.active.delete(strike);

        if (!hit) this.onDodge();
      },
    };
    const strike = new KrakenTentacleStrike(
      this.scene,
      {
        side: sprite.y < worldHeight / 2 ? 'top' : 'bottom',
        aim,
        worldHeight,
        showHint: this.launched < settings.hintCount,
      },
      this.player,
      this.kraken,
      outcome
    );

    this.launched++;
    this.active.add(strike);

    return true;
  }

  private nextInterval(playerX: number) {
    const { near, far } = settings.intervalMs;
    const distance = 1 - this.kraken.getCloseness(playerX);

    return Phaser.Math.Between(
      Phaser.Math.Linear(near.min, far.min, distance),
      Phaser.Math.Linear(near.max, far.max, distance)
    );
  }
}
