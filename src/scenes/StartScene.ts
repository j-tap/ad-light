import BaseScene from './BaseScene';
import { BubbleEmitter } from '../game/BubbleEmitter'
import { GUI } from '../ui/Gui';

export default class StartScene extends BaseScene {
  private gui!: GUI;
  private startButton!: Phaser.GameObjects.GameObject;
  private bg!: Phaser.GameObjects.Image;
  private bubbleEmitter: BubbleEmitter;
  menuMusic!: Phaser.Sound.BaseSound;

  constructor() {
    super('StartScene');
  }

  create() {
    this.gui = new GUI(this);
    this.menuMusic = this.sound.add('menuMusic', { loop: true, volume: .25 })
    this.menuMusic.play();

    this.scale.on('resize', this.resize, this);

    this.createBg();
    this.createUI();

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
    this.gui.createButton(this.centerX, this.centerY, 'Start', () => {
      this.playGame();
    });
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
    this.scene.start('Level1Scene');
  }
}
