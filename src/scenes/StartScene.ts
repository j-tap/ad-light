import Phaser from 'phaser';
import Label from 'phaser3-rex-plugins/templates/ui/label/Label';
import BaseScene from './BaseScene';
import { BubbleEmitter } from '../game/BubbleEmitter';
import { GUI } from '../ui/Gui';
import { VERSION, levelOrder } from '../config';
import { progressStore } from '../game/ProgressStore';

export default class StartScene extends BaseScene {
  private gui!: GUI;
  private background!: Phaser.GameObjects.Image;
  private startButton!: Label;
  private logo!: Phaser.GameObjects.Image;
  private versionText!: Phaser.GameObjects.Text;
  private music?: Phaser.Sound.BaseSound;
  private levelButtons: Label[] = [];

  constructor() {
    super('StartScene');
  }

  create() {
    super.create();

    // Scene instances are reused, and the buttons of the previous visit are already destroyed.
    this.levelButtons = [];
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

    if (__DEV__) {
      this.createDevLevelSelect();
    }
  }

  private createDevLevelSelect() {
    levelOrder.forEach(level => {
      const btn = this.gui.createButton(0, 0, `Lv ${level}`, () => {
        progressStore.beginRun();
        this.fadeToScene(`Level${level}Scene`);
      });

      this.levelButtons.push(btn);
    });
  }

  private layout() {
    this.gui.resizeFullscreenBackground(this.background);

    this.startButton.setPosition(this.centerX, this.centerY / 2).layout();
    this.logo.setPosition(this.centerX, this.scale.height - this.logo.displayHeight / 2 - 30);
    this.versionText.setPosition(this.scale.width - 15, this.scale.height - 15);

    this.layoutDevButtons();
  }

  private layoutDevButtons() {
    if (!this.levelButtons.length) return;

    const btnW = 100;
    const gap = 12;
    const totalW = this.levelButtons.length * btnW + (this.levelButtons.length - 1) * gap;
    let x = this.centerX - totalW / 2 + btnW / 2;
    const y = this.centerY / 2 + 80;

    this.levelButtons.forEach(btn => {
      btn.setPosition(x, y).layout();
      x += btnW + gap;
    });
  }

  private playGame() {
    progressStore.beginRun();
    this.fadeToScene('Level1Scene');
  }
}
