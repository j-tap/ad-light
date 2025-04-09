import BaseScene from './BaseScene';
import { BubbleEmitter } from '../game/BubbleEmitter'
import { GUI } from '../ui/Gui';
import { VERSION } from '../config'

export default class StartScene extends BaseScene {
  private gui!: GUI;
  private startButton!: Phaser.GameObjects.GameObject;
  private bg!: Phaser.GameObjects.Image;
  private bubbleEmitter: BubbleEmitter;
  private logo: Phaser.GameObjects.Image;
  menuMusic!: Phaser.Sound.BaseSound;

  constructor() {
    super('StartScene');
  }

  create() {
    this.gui = new GUI(this);
    this.menuMusic = this.sound.add('menuMusic', { loop: true, volume: .5 })
    this.menuMusic.play();

    this.scale.on('resize', this.resize, this);

    this.createBg();
    this.createUI();
    this.fadeIn();

    this.events.on('shutdown', () => {
      if (this.menuMusic && this.menuMusic.isPlaying) {
        this.menuMusic.stop();
      }
    });

    this.input.keyboard.on('keydown-ENTER', () => {
      this.playGame();
    })
  }

  createUI() {
    this.gui.createButton(this.centerX, this.centerY / 2, 'Start', () => {
      this.playGame();
    });

    this.logo = this.add.image(0, 0, 'logo');
    this.logo.setPosition(this.centerX, this.scale.height - this.logo.displayHeight / 2 - 30);

    this.add.text(this.scale.width - 15, this.scale.height - 15, `v${VERSION}`, {
        fontSize: 14,
        color: '#dcdcdc',
        fontFamily: 'Arial',
      })
      .setOrigin(1, 1);
  }

  createBg() {
    this.bg = this.bg = this.gui.createFullscreenBackground('menuBg', 'bottom')

    this.bubbleEmitter = new BubbleEmitter(this);
    this.bubbleEmitter.setTiming(1000, 1000);
  }

  resize() {
    if (this.startButton) {
      (this.startButton as Phaser.GameObjects.Container).setPosition(this.centerX, this.centerY);
    }

    this.gui.resizeFullscreenBackground(this.bg);
  }

  playGame() {
    this.fadeToScene('Level1Scene');
  }
}
