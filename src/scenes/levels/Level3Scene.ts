import GameScene from '../GameScene';
import { config } from '../../config';
import { EnemyKraken } from '../../game/enemies/Kraken';
import { KrakenTentacleDirector } from '../../game/KrakenTentacleDirector';
import { RockObstacle } from '../../game/RockObstacle';

const KRAKEN_SPAWN_X = -2000;
const KRAKEN_INTRO_DELAY = 1000;
const KRAKEN_HUNT_DELAY = 500;
const KRAKEN_SHAKE_INTERVAL = 2000;

export default class Level3Scene extends GameScene {
  private kraken!: EnemyKraken;
  private tentacles?: KrakenTentacleDirector;
  private hintShown = false;
  private tentacleHintShown = false;
  private rockHintShown = false;

  constructor() {
    super('Level3Scene', config.levels[3]);
  }

  update(time: number, delta: number) {
    super.update(time, delta);

    if (!this.kraken || !this.player) return;

    const playerSprite = this.player.getSprite();
    this.kraken.update(delta, playerSprite.x, playerSprite.y);
    this.tentacles?.update();
    this.maybeShowHint(playerSprite.x);
  }

  protected createLevel() {
    super.createLevel();
    this.spawnKraken();
  }

  protected onRockHit(_rock: RockObstacle) {
    this.player.stun(config.rock.hitStunDuration);
    this.kraken?.applyCatchUp();

    if (!this.rockHintShown) {
      this.rockHintShown = true;
      this.hud.setHint('Glowing rocks are solid — weave around them');
      this.time.delayedCall(config.tutorial.hintHoldMs, () => this.hud.clearHint());
    }
  }

  private spawnKraken() {
    this.kraken = new EnemyKraken(this, KRAKEN_SPAWN_X, this.scale.height / 2);

    this.physics.add.overlap(this.kraken.getMouthCollider(), this.player.getSprite(), () => {
      if (!this.player.isAlive()) return;

      this.sound.play('eat', { volume: 0.5 });
      this.player.takeDamage(config.player.maxHealth);
    });

    this.time.delayedCall(KRAKEN_INTRO_DELAY, () => {
      this.cameras.main.shake(1000, 0.01);

      this.time.delayedCall(KRAKEN_HUNT_DELAY, () => {
        this.kraken.setIsHunting(true);

        if (this.levelConfig.tentacleAttacks) {
          this.tentacles = new KrakenTentacleDirector(
            this,
            this.player,
            this.kraken,
            this.worldSize().height,
          );
          this.tentacles.start();
        }

        this.time.addEvent({
          delay: KRAKEN_SHAKE_INTERVAL,
          loop: true,
          callback: () => this.cameras.main.shake(350, 0.003),
        });

        this.showHint('Outrun the kraken — reach the end of the tunnel');
      });
    });
  }

  private maybeShowHint(playerX: number) {
    if (this.hintShown || playerX < 1400) return;

    this.showHint('Keep swimming right to escape');
  }

  private showHint(text: string) {
    if (this.hintShown) return;

    this.hintShown = true;
    this.hud.setHint(text);

    if (this.levelConfig.tentacleAttacks && !this.tentacleHintShown) {
      this.tentacleHintShown = true;
      this.time.delayedCall(config.tutorial.hintHoldMs + 400, () => {
        this.hud.setHint('The kraken reaches with its tentacles — dodge away');
        this.time.delayedCall(config.tutorial.hintHoldMs, () => this.hud.clearHint());
      });
      return;
    }

    this.time.delayedCall(config.tutorial.hintHoldMs, () => this.hud.clearHint());
  }
}
