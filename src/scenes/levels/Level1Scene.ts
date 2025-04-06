import GameScene from '../GameScene';
import { Player } from '../../game/Player';
import { config } from '../../config';

export default class Level1Scene extends GameScene {
  protected readonly cameraBackgroundColor = '#000000';
  protected readonly levelBackground: string = 'level1Bg';
  readonly nextScene = 'Level2Scene';

  constructor() {
    super('Level1Scene');
    this.levelWidth = config.levels[1].width
    this.enemyCount = config.levels[1].enemyCount
    this.molluskCount = config.levels[1].molluskCount
  }

  createLevel() {
    this.physics.world.gravity.y = 50;
    this.physics.world.setBounds(0, 0, this.levelWidth, this.scale.height);

    this.levelManager.createLevel({
      backgroundFar: this.levelBackground,
      backgroundNear: 'backgroundNear',
    });

    this.player = new Player(this);
    this.createCamera();

    this.gameManager.setPlayer(this.player);
    this.startGame();
    this.gameManager.setupCollisions(this.player);
  }

  createCamera() {
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.scale.height);
    this.cameras.main.startFollow(this.player.getSprite(), true, 0.08, 0.08);
    this.cameras.main.setDeadzone(0, 100);
    this.cameras.main.setBackgroundColor(this.cameraBackgroundColor);
  }

  updateUI() {
    this.scoreText.setText('Mollusks: ' + this.gameManager.getScore() + '/' + this.molluskCount);
    this.hearts.forEach((heart, index) => {
      heart.setVisible(index < this.player.getHealth());
    });
  }
}
