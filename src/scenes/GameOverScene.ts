import Phaser from 'phaser';
import Label from 'phaser3-rex-plugins/templates/ui/label/Label';
import BaseScene from './BaseScene';
import { GUI } from '../ui/Gui';
import { BubbleEmitter } from '../game/BubbleEmitter';

export default class GameOverScene extends BaseScene {
  private gui!: GUI;
  private background!: Phaser.GameObjects.Image;
  private title!: Phaser.GameObjects.Text;
  private buttons: Label[] = [];
  private music?: Phaser.Sound.BaseSound;
  private lastLevel!: string;

  constructor() {
    super('GameOverScene');
  }

  init(data: { level: string }) {
    this.lastLevel = data.level;
  }

  create() {
    super.create();

    this.gui = new GUI(this);

    this.music = this.sound.add('depth', { volume: 0.4 });
    this.music.play();

    this.createBackground();
    this.createUI();
    this.layout();

    this.onResize(() => this.layout());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.music?.destroy();
      this.music = undefined;
    });
  }

  private createBackground() {
    this.background = this.gui.createFullscreenBackground('deadBg', 'bottom');

    new BubbleEmitter(this, undefined, { minDelay: 1000, maxDelay: 1000 });
  }

  private createUI() {
    this.title = this.add.text(0, 0, 'You Died', {
      fontSize: '44px',
      color: '#dcdcdc',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.buttons = [
      this.gui.createButton(0, 0, 'Again', () => this.fadeToScene(this.lastLevel)),
      this.gui.createButton(0, 0, 'Exit to Menu', () => this.fadeToScene('StartScene')),
    ];

    this.tweens.add({
      targets: this.title,
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Sine.easeInOut'
    });
  }

  private layout() {
    this.gui.resizeFullscreenBackground(this.background);

    this.title.setPosition(this.centerX, this.centerY / 2);

    let y = this.title.y + this.title.height + 60;

    this.buttons.forEach(button => {
      button.setPosition(this.centerX, y).layout();
      y += button.height + 15;
    });
  }
}
