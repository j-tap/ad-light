import GameScene from '../GameScene';
import { config } from '../../config';
import { EnemyKraken } from '../../game/enemies/Kraken';

const KRAKEN_SPAWN_X = -2000;
const KRAKEN_INTRO_DELAY = 1000;
const KRAKEN_HUNT_DELAY = 500;
const KRAKEN_SHAKE_INTERVAL = 2000;

export default class Level3Scene extends GameScene {
  private kraken!: EnemyKraken;

  constructor() {
    super('Level3Scene', config.levels[3]);
  }

  update(time: number, delta: number) {
    super.update(time, delta);

    if (!this.kraken || !this.player) return;

    const playerSprite = this.player.getSprite();
    this.kraken.update(delta, playerSprite.x, playerSprite.y);
  }

  protected createLevel() {
    super.createLevel();
    this.spawnKraken();
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

        this.time.addEvent({
          delay: KRAKEN_SHAKE_INTERVAL,
          loop: true,
          callback: () => this.cameras.main.shake(350, 0.003),
        });
      });
    });
  }
}
