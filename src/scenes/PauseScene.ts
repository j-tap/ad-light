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
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.9)
      .setOrigin(0);

    this.add.text(this.centerX, this.centerY - 100, 'PAUSED', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.rexUI.add.label({
      x: this.centerX,
      y: this.centerY,
      width: 200,
      height: 60,
      align: 'center',
      background: this.add.rectangle(0, 0, 200, 60, 0x3498db).setInteractive(),
      text: this.add.text(0, 0, 'Resume', { fontSize: '24px', color: '#ffffff' }),
      space: { left: 10, right: 10, top: 10, bottom: 10 }
    }).layout().setInteractive()
      .on('pointerdown', () => {
        this.resume()
      });

    this.rexUI.add.label({
      x: this.centerX,
      y: this.centerY + 80,
      width: 200,
      height: 60,
      align: 'center',
      background: this.add.rectangle(0, 0, 200, 60, 0xe74c3c).setInteractive(),
      text: this.add.text(0, 0, 'Exit to Menu', { fontSize: '24px', color: '#ffffff' }),
      space: { left: 10, right: 10, top: 10, bottom: 10 }
    }).layout().setInteractive()
      .on('pointerdown', () => {
        this.scene.stop('GameScene');
        this.scene.start('StartScene');
      });
  }

  resume() {
    this.scene.stop();
    this.scene.resume('GameScene');
    this.scene.get('GameScene').events.emit('resume-game');
  }
}
