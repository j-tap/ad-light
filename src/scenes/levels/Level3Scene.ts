import GameScene from '../GameScene';
import { config } from '../../config';
import { EnemyKraken } from '../../game/enemies/Kraken';
import { KrakenTentacleDirector } from '../../game/KrakenTentacleDirector';

const settings = config.chase;

export default class Level3Scene extends GameScene {
  private kraken!: EnemyKraken;
  private tentacles?: KrakenTentacleDirector;
  private rockHintShown = false;

  constructor() {
    super('Level3Scene', config.levels[3]);
  }

  create() {
    this.tentacles = undefined;
    this.rockHintShown = false;

    super.create();
  }

  update(time: number, delta: number) {
    super.update(time, delta);

    if (!this.kraken || !this.player) return;

    const playerSprite = this.player.getSprite();

    this.kraken.update(delta, playerSprite.x, playerSprite.y);

    if (this.gameManager.isPlaying()) {
      this.tentacles?.update(delta);
    }
  }

  protected createLevel() {
    super.createLevel();
    this.spawnKraken();
  }

  protected goalLabel() {
    return 'Escape the kraken →';
  }

  protected onRockHit() {
    this.player.stun(config.rock.hitStunDuration);
    this.kraken?.applyCatchUp();

    if (!this.rockHintShown) {
      this.rockHintShown = true;
      this.showHint('The rocks are solid: weave around them');
    }
  }

  protected completeLevel() {
    this.tentacles?.stop();
    this.kraken.setIsHunting(false);
    super.completeLevel();
  }

  private spawnKraken() {
    this.kraken = new EnemyKraken(this, settings.krakenSpawnX, this.scale.height / 2);

    this.physics.add.overlap(this.kraken.getMouthCollider(), this.player.getSprite(), () => {
      if (!this.player.isAlive()) return;

      this.sound.play('eat', { volume: 0.5 });
      this.player.takeDamage(config.player.maxHealth);
    });

    this.time.delayedCall(settings.introDelayMs, () => {
      this.cameras.main.shake(settings.introShakeMs, settings.introShakeIntensity);
      this.time.delayedCall(settings.huntDelayMs, () => this.startHunt());
    });
  }

  private startHunt() {
    this.kraken.setIsHunting(true);

    this.time.addEvent({
      delay: settings.rumbleEveryMs,
      loop: true,
      callback: () => {
        if (this.gameManager.isPlaying()) {
          this.cameras.main.shake(settings.rumbleMs, settings.rumbleIntensity);
        }
      },
    });

    this.showHint('Outrun the kraken: reach the end of the tunnel');

    if (!this.levelConfig.tentacleAttacks) return;

    this.tentacles = new KrakenTentacleDirector(this, this.player, this.kraken, () => this.worldSize().height);
    this.tentacles.start();

    this.time.delayedCall(config.tutorial.hintHoldMs + config.tutorial.fadeMs, () => {
      this.showHint('Its arms lash out where the ring closes: get out of the way');
    });
  }

  private showHint(text: string) {
    if (!this.gameManager.isPlaying()) return;

    this.hud.setHint(text);
    this.time.delayedCall(config.tutorial.hintHoldMs, () => this.hud.clearHintIf(text));
  }
}
