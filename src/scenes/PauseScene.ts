import BaseScene from './BaseScene';

export default class PauseScene extends BaseScene {
  constructor() {
    super('PauseScene');
  }

  create() {
    this.input.keyboard.on('keydown-ESC', () => {
      this.resume()
    });

    this.createUI()

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  createUI() {
    const btnWidth = 220;
    const btnHeight = 80;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7)
      .setOrigin(0);

    const backgroundResume = this.add.image(0, 0, 'btn')
      .setDisplaySize(btnWidth, btnHeight)
      .setInteractive()
      .setOrigin(0.5)
      .setPosition(this.centerX, this.centerY);

    const backgroundExit = this.add.image(0, 0, 'btn')
      .setDisplaySize(btnWidth, btnHeight)
      .setInteractive()
      .setOrigin(0.5)
      .setPosition(this.centerX, this.centerY + 80);

    this.add.text(this.centerX, this.centerY - 100, 'PAUSED', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.rexUI.add.label({
      x: this.centerX,
      y: this.centerY,
      width: btnWidth,
      height: btnHeight,
      align: 'center',
      background: backgroundResume,
      text: this.add.text(0, 0, 'Resume', { fontSize: '24px', color: '#dcdcdc' }),
      space: { left: 10, right: 10, top: 10, bottom: 10 }
    })
      .layout()
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.resume()
      })
      .on('pointerover', () => {
        backgroundResume.setTint(0xcccccc);
      })
      .on('pointerout', () => {
        backgroundResume.clearTint();
      });

    this.rexUI.add.label({
      x: this.centerX,
      y: this.centerY + 80,
      width: btnWidth,
      height: btnHeight,
      align: 'center',
      background: backgroundExit,
      text: this.add.text(0, 0, 'Exit to Menu', { fontSize: '24px', color: '#dcdcdc' }),
      space: { left: 10, right: 10, top: 10, bottom: 10 }
    })
      .layout()
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.stop('GameScene');
        this.scene.start('StartScene');
      })
      .on('pointerover', () => {
        backgroundExit.setTint(0xcccccc);
      })
      .on('pointerout', () => {
        backgroundExit.clearTint();
      });
  }

  resume() {
    this.scene.stop();
    this.scene.resume('GameScene');
    this.scene.get('GameScene').events.emit('resume-game');
  }
}
