import GameScene from '../GameScene';
import { Player } from '../../game/Player';
import { config } from '../../config';
import { EnemyKraken } from '../../game/enemies/Kraken';

export default class Level1Scene extends GameScene {
  protected readonly levelBackgroundFar: string = 'level3BgFar';
  protected readonly levelBackground: string = 'level3Bg';
  protected readonly levelForeground: string = 'level3Fg';
  protected kraken: EnemyKraken;

  constructor() {
    super('Level3Scene');
    this.levelConfig = config.levels[3];
    this.nextScene = 'WinScene';
    this.musicKeys = ['gameMusic3'];
  }

  update(time: number, delta: number) {
    super.update(time, delta);

    if (this.kraken && this.player) {
      const playerSprite = this.player.getSprite();
      this.kraken.update(delta, playerSprite.x, playerSprite.y);
    }
  }

  createLevel() {
    this.physics.world.gravity.y = 50;
    this.physics.world.setBounds(0, 0, this.levelConfig.width, this.scale.height);
    this.levelManager.setNeedPlankton(false);
    this.levelManager.createLevel({
      backgroundFar: this.levelBackgroundFar,
      background: this.levelBackground,
      foreground: this.levelForeground,
    });

    this.player = new Player(this);
    this.createCamera();
    this.createColliders();

    this.gameManager.setPlayer(this.player);
    this.startGame();
    this.gameManager.setupCollisions(this.player);

    this.spawnKraken();
  }

  updateUI() {
    this.scoreText.setText('Mollusks: ' + this.gameManager.getScore() + '/' + this.levelConfig.mollusks.count);
    this.hearts.forEach((heart, index) => {
      heart.setVisible(index < this.player.getHealth());
    });
  }

  private spawnKraken() {
    this.kraken = new EnemyKraken(this, -2000, this.scale.height / 2);

    this.physics.add.overlap(
      this.kraken.getMouthCollider(),
      this.player.getSprite(),
      () => {
        if (this.player.isAlive()) {
          this.player.takeDamage(100);
          this.sound.add('eat', { volume: 0.5 }).play();
        }
      }
    );

    this.time.delayedCall(1000, () => {
      this.cameras.main.shake(1000, 0.01);

      this.time.delayedCall(500, () => {
        this.kraken.setIsHunting(true);

        setInterval(() => {
          this.cameras.main.shake(350, 0.003);
        }, 2000);
      });
    });
  }

  private createColliders() {
    this.ground = this.physics.add.staticGroup();

    this.ground.create(this.levelConfig.width / 2, this.scale.height - 35, undefined)
      .setDisplaySize(this.levelConfig.width, 45)
      .setOrigin(0.5)
      .refreshBody()
      .setVisible(false);
  }
}
