import GameScene from '../GameScene';
import { Player } from '../../game/Player';
import { config } from '../../config';

export default class Level1Scene extends GameScene {
  protected readonly levelBackgroundFar: string = 'level1BgFar';
  protected readonly levelBackground: string = 'level1Bg';
  protected readonly levelForeground: string = 'level1Fg';

  constructor() {
    super('Level1Scene');
    this.levelConfig = config.levels[1]
    this.nextScene = 'Level2Scene';
    this.musicKeys = ['gameMusic1'];
  }

  createLevel() {
    this.physics.world.gravity.y = 50;
    this.physics.world.setBounds(0, 0, this.levelConfig.width, this.scale.height);

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
  }

  updateUI() {
    this.scoreText.setText('Mollusks: ' + this.gameManager.getScore() + '/' + this.levelConfig.mollusks.count);
    this.hearts.forEach((heart, index) => {
      heart.setVisible(index < this.player.getHealth());
    });
  }

  private createColliders() {
    this.ground = this.physics.add.staticGroup();

    this.ground.create(this.levelConfig.width / 2, this.scale.height - 35, undefined)
      .setDisplaySize(this.levelConfig.width, 45)
      .setOrigin(0.5)
      .refreshBody()
      .setVisible(false);

    // this.ground.create(400, this.scale.height - 120, undefined)
    //   .setDisplaySize(100, 200)
    //   .setOrigin(0.5)
    //   .refreshBody()
    //   .setVisible(false);
  }
}
