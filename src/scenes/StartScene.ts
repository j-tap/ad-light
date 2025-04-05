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

    const buttonBg = this.add.graphics()
      .fillStyle(0x3498db, 1)
      .fillRoundedRect(-75, -25, 150, 50, 12) // (x, y, width, height, радиус углов)
      .lineStyle(2, 0xffffff)
      .strokeRoundedRect(-75, -25, 150, 50, 12)
      .setInteractive(new Phaser.Geom.Rectangle(-75, -25, 150, 50), Phaser.Geom.Rectangle.Contains);

    this.startButton = this.rexUI.add.label({
      x: this.centerX,
      y: this.centerY,
      width: 150,
      height: 50,
      align: 'center',
      background: buttonBg,
      text: this.add.text(0, 0, 'Start', { fontSize: '24px', color: '#ffffff', fontFamily: 'Arial' }),
      space: { left: 10, right: 10, top: 10, bottom: 10 }
    })
      .layout()
      .setInteractive()
      .on('pointerover', () => {
        buttonBg.clear();
        buttonBg.fillStyle(0x5dade2, 1);
        buttonBg.fillRoundedRect(-75, -25, 150, 50, 12);
        buttonBg.lineStyle(2, 0xffffff);
        buttonBg.strokeRoundedRect(-75, -25, 150, 50, 12);
      })
      .on('pointerout', () => {
        buttonBg.clear();
        buttonBg.fillStyle(0x3498db, 1);
        buttonBg.fillRoundedRect(-75, -25, 150, 50, 12);
        buttonBg.lineStyle(2, 0xffffff);
        buttonBg.strokeRoundedRect(-75, -25, 150, 50, 12);
      })
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
