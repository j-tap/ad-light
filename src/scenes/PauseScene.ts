import Phaser from 'phaser';
import Label from 'phaser3-rex-plugins/templates/ui/label/Label';
import BaseScene from './BaseScene';
import { GUI } from '../ui/Gui';

export default class PauseScene extends BaseScene {
  private gui!: GUI;
  private overlay!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private buttons: Label[] = [];
  private targetScene!: string;

  constructor() {
    super('PauseScene');
  }

  init(data: { target: string }) {
    this.targetScene = data.target;
  }

  create() {
    super.create();

    this.gui = new GUI(this);

    this.createUI();
    this.layout();

    this.onResize(() => this.layout());

    this.input.keyboard?.on('keydown-ESC', () => this.resume());
  }

  private createUI() {
    this.overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7)
      .setOrigin(0);

    this.title = this.add.text(0, 0, 'PAUSED', {
      fontSize: '48px',
      color: '#ffffff'
    })
      .setOrigin(0.5);

    this.buttons = [
      this.gui.createButton(0, 0, 'Resume', () => this.resume()),
      this.gui.createButton(0, 0, 'Exit to Menu', () => {
        this.scene.stop(this.targetScene);
        this.fadeToScene('StartScene');
      }),
    ];
  }

  private layout() {
    this.overlay.setSize(this.scale.width, this.scale.height);
    this.title.setPosition(this.centerX, this.centerY - 150);

    let y = this.centerY - 50;

    this.buttons.forEach(button => {
      button.setPosition(this.centerX, y).layout();
      y += button.height + 15;
    });
  }

  private resume() {
    this.scene.stop();
    this.scene.resume(this.targetScene);
    this.scene.get(this.targetScene).events.emit('resume-game');
  }
}
