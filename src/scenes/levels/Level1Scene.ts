import GameScene from '../GameScene';
import { Player } from '../../game/Player';
import { config } from '../../config';

export default class Level1Scene extends GameScene {
  protected readonly levelBackground: string = 'level1Bg';
  protected readonly levelForeground: string = 'level1Fg';
  readonly nextScene = 'Level2Scene';

  constructor() {
    super('Level1Scene');
    this.levelWidth = config.levels[1].width
    this.enemyCount = config.levels[1].enemyCount
    this.molluskCount = config.levels[1].molluskCount
    this.musicKeys = ['gameMusic1'];
  }

  createLevel() {
    this.physics.world.gravity.y = 50;
    this.physics.world.setBounds(0, 0, this.levelWidth, this.scale.height);

    this.levelManager.createLevel({
      backgroundFar: this.levelBackground,
      backgroundNear: this.levelForeground,
    });

    this.player = new Player(this);
    this.createCamera();

    this.gameManager.setPlayer(this.player);
    this.startGame();
    this.gameManager.setupCollisions(this.player);
  }

  updateUI() {
    this.scoreText.setText('Mollusks: ' + this.gameManager.getScore() + '/' + this.molluskCount);
    this.hearts.forEach((heart, index) => {
      heart.setVisible(index < this.player.getHealth());
    });
  }
}
