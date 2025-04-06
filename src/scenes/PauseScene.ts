import BaseScene from './BaseScene';
import { GUI } from '../ui/Gui';

export default class PauseScene extends BaseScene {
  private targetScene!: string;
  private gui!: GUI;

  constructor() {
    super('PauseScene');
  }

  init(data: { target: string }) {
    this.targetScene = data.target;
  }

  create() {
    this.gui = new GUI(this);

    this.input.keyboard.on('keydown-ESC', () => {
      this.resume();
    });

    this.createUI();

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  createUI() {
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7)
      .setOrigin(0);

    this.add.text(this.centerX, this.centerY - 150, 'PAUSED', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const btn1 = this.gui.createButton(this.centerX, this.centerY - 50, 'Resume', () => {
      this.resume();
    });

    this.gui.createButton(this.centerX, btn1.y + btn1.height + 15, 'Exit to Menu', () => {
      this.scene.stop(this.targetScene);
      this.scene.start('StartScene');
    });
  }

  resume() {
    this.scene.stop();
    this.scene.resume(this.targetScene);
    this.scene.get(this.targetScene).events.emit('resume-game');
  }
}
