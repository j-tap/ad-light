import Phaser from 'phaser';
import Label from 'phaser3-rex-plugins/templates/ui/label/Label';
import BaseScene from './BaseScene';
import { BubbleEmitter } from '../game/BubbleEmitter';
import { GUI } from '../ui/Gui';
import { VERSION } from '../config';
import { progressStore } from '../game/ProgressStore';

export default class StartScene extends BaseScene {
  private gui!: GUI;
  private background!: Phaser.GameObjects.Image;
  private startButton!: Label;
  private logo!: Phaser.GameObjects.Image;
  private versionText!: Phaser.GameObjects.Text;
  private music?: Phaser.Sound.BaseSound;

  constructor() {
    super('StartScene');
  }

  create() {
    super.create();

    this.gui = new GUI(this);

    this.music = this.sound.add('menuMusic', { loop: true, volume: 0.5 });
    this.music.play();

    this.createBackground();
    this.createUI();
    this.layout();

    this.onResize(() => this.layout());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.music?.destroy();
      this.music = undefined;
    });

    this.input.keyboard?.on('keydown-ENTER', () => this.playGame());
  }

  private createBackground() {
    this.background = this.gui.createFullscreenBackground('menuBg', 'bottom');

    new BubbleEmitter(this, undefined, { minDelay: 1000, maxDelay: 1000 });
  }

  private createUI() {
    this.startButton = this.gui.createButton(0, 0, 'Start', () => this.playGame());
    this.logo = this.add.image(0, 0, 'logo');

    this.versionText = this.add.text(0, 0, `v${VERSION}`, {
      fontSize: '14px',
      color: '#dcdcdc',
      fontFamily: 'Arial',
    })
      .setOrigin(1, 1);
  }

  private layout() {
    this.gui.resizeFullscreenBackground(this.background);

    this.startButton.setPosition(this.centerX, this.centerY / 2).layout();
    this.logo.setPosition(this.centerX, this.scale.height - this.logo.displayHeight / 2 - 30);
    this.versionText.setPosition(this.scale.width - 15, this.scale.height - 15);
  }

  private playGame() {
    progressStore.beginRun();
    this.fadeToScene('Level1Scene');
  }
}
