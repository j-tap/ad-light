import BaseScene from './BaseScene';

export default class StartScene extends BaseScene {
  menuMusic!: Phaser.Sound.BaseSound;
  private startButton!: Phaser.GameObjects.GameObject;

  constructor() {
    super('StartScene');
  }

  create() {
    this.menuMusic = this.sound.add('menuMusic', { loop: true, volume: 0.3 });
    this.menuMusic.play();

    this.scale.on('resize', this.resize, this);
    this.createUI();

    this.events.on('shutdown', () => {
      if (this.menuMusic && this.menuMusic.isPlaying) {
        this.menuMusic.stop();
      }
    });

    this.input.keyboard.on('keydown-ENTER', () => {
      this.startGame();
    })
  }

  createUI() {
    this.add.image(this.centerX, this.centerY - 150, 'logo')
      .setOrigin(0.5)
      .setScale(0.5);

    this.startButton = this.rexUI.add.label({
      x: this.centerX,
      y: this.centerY,
      align: 'center',
      width: 150,
      height: 50,
      background: this.add.rectangle(0, 0, 150, 50, 0x3498db).setInteractive(),
      text: this.add.text(0, 0, 'Start', { fontSize: '24px', color: '#ffffff' }),
      space: { left: 10, right: 10, top: 10, bottom: 10 }
    }).layout().setInteractive()
      .on('pointerdown', () => {
        this.startGame();
      });
  }

  resize() {
    if (this.startButton) {
      this.startButton.setPosition(this.centerX, this.centerY);
    }
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
