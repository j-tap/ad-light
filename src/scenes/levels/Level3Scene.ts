import Phaser from 'phaser';
import GameScene from '../GameScene';
import { config } from '../../config';
import { EnemyKraken } from '../../game/enemies/Kraken';
import { KrakenTentacleDirector } from '../../game/KrakenTentacleDirector';
import { RockRefuge } from '../../game/RockRefuge';
import { Terrain } from '../../game/systems/Terrain';

const settings = config.chase;
const { refuge: refugeSettings, gap: gapSettings, hints } = settings;

/**
 * The kraken chase. This scene owns the score of the chase, the gap between the jaws and the
 * fish: every way the kraken gains or loses ground is decided here and nowhere else.
 */
export default class Level3Scene extends GameScene {
  private kraken!: EnemyKraken;
  private tentacles!: KrakenTentacleDirector;
  private refuge!: RockRefuge;

  constructor() {
    super('Level3Scene', config.levels[3]);
  }

  update(time: number, delta: number) {
    super.update(time, delta);

    const { x, y } = this.player.getSprite();

    this.kraken.setBaseGap(gapSettings.byLives[this.player.getHealth()] ?? gapSettings.danger);
    this.kraken.update(delta, x, y);

    if (!this.gameManager.isPlaying()) return;

    this.tentacles.update(delta);

    if (x >= refugeSettings.hintFromX) {
      this.showHintOnce(hints.refuge);
    }
  }

  protected createScenery() {
    this.refuge = new RockRefuge(this);
  }

  protected buildTerrain(terrain: Terrain, worldHeight: number) {
    this.refuge.layout(worldHeight);
    this.refuge.getColliders().forEach(collider => terrain.addPolygon(collider));
  }

  protected createLevel() {
    super.createLevel();
    this.spawnKraken();
  }

  protected goalLabel() {
    return 'Escape the kraken →';
  }

  /** The closer the jaws, the tighter the camera. */
  protected threatLevel() {
    return this.kraken.getCloseness(this.player.getSprite().x);
  }

  protected onRockHit() {
    this.kraken.closeIn(gapSettings.rockPenalty);
    this.showHintOnce(hints.rock);
  }

  protected exitDelayMs() {
    return refugeSettings.exitDelayMs;
  }

  /** The fish is in the crack: the level lingers until the kraken has hit the rock behind it. */
  protected completeLevel() {
    this.tentacles.stop();
    this.hud.clearHint();
    this.player.getSprite().setVelocity(config.player.speed * refugeSettings.coastSpeedFactor, 0);
    super.completeLevel();
  }

  private spawnKraken() {
    this.kraken = new EnemyKraken(this, settings.krakenSpawnX, this.scale.height / 2);
    this.kraken.setBarrier(refugeSettings.wallX - refugeSettings.krakenMargin, () => {
      this.sound.play('depth', { volume: refugeSettings.ramVolume });
      this.cameras.main.shake(refugeSettings.ramShakeMs, refugeSettings.ramShakeIntensity);
    });

    this.tentacles = new KrakenTentacleDirector(
      this,
      this.player,
      this.kraken,
      () => this.worldSize().height,
      this.levelConfig.rocks ?? [],
      () => this.kraken.closeIn(gapSettings.hitPenalty),
      () => this.kraken.fallBack(gapSettings.dodgeReward)
    );

    this.physics.add.overlap(this.kraken.getMouthCollider(), this.player.getSprite(), () => {
      if (!this.player.isAlive()) return;

      this.sound.play('eat', { volume: settings.biteVolume });
      this.player.takeDamage(config.player.maxHealth);
    });

    this.time.delayedCall(settings.introDelayMs, () => {
      this.cameras.main.shake(settings.introShakeMs, settings.introShakeIntensity);
      this.time.delayedCall(settings.huntDelayMs, () => this.startHunt());
    });
  }

  private startHunt() {
    this.kraken.startHunt();
    this.tentacles.start();
    this.scheduleSurge();
    this.showHint(hints.hunt);

    this.time.addEvent({
      delay: settings.rumbleEveryMs,
      loop: true,
      callback: () => {
        if (this.gameManager.isPlaying()) {
          this.cameras.main.shake(settings.rumbleMs, settings.rumbleIntensity);
        }
      },
    });
  }

  private scheduleSurge() {
    const { everyMs, distance, shakeMs, shakeIntensity, volume, rate } = settings.surge;

    this.time.delayedCall(Phaser.Math.Between(everyMs.min, everyMs.max), () => {
      if (!this.gameManager.isPlaying()) return;

      this.kraken.closeIn(distance);
      this.sound.play('depth', { volume, rate });
      this.cameras.main.shake(shakeMs, shakeIntensity);
      this.scheduleSurge();
    });
  }
}
