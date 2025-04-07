import Phaser from 'phaser';
import { GUI } from '../ui/Gui';
import { BubbleEmitter } from '../game/BubbleEmitter'
import BaseScene from './BaseScene'

export default class GameOverScene extends BaseScene {
  private gui!: GUI;
  private bg!: Phaser.GameObjects.Image;
  private bubbleEmitter: BubbleEmitter;
  private music: Phaser.Sound.BaseSound;
  private lastLevel: string;

  constructor() {
    super('GameOverScene');
  }

  init(data: { level: string }) {
    this.lastLevel = data.level;
  }

  create() {
    this.gui = new GUI(this);

    this.music = this.sound.add('depth', { volume: 0.4 })
    this.music.play();

    this.createBg();
    this.createUI();
    this.fadeIn();

    this.events.on('shutdown', () => {
      if (this.music && this.music.isPlaying) {
        this.music.stop();
        }
    });
  }

  resize(gameSize: Phaser.Structs.Size) {
    this.gui.resizeFullscreenBackground(this.bg)
  }

  createUI() {
    const text = this.add.text(this.centerX, this.centerY / 2, 'You Died', {
      fontSize: '44px',
      color: '#dcdcdc',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const btn1 = this.gui.createButton(this.centerX, text.y + text.height + 60, 'Again', () => {
      this.fadeToScene(this.lastLevel);
    });
    this.gui.createButton(this.centerX, btn1.y + btn1.height + 15, 'Exit to Menu', () => {
      this.fadeToScene('StartScene');
    });

    this.tweens.add({
      targets: text,
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Sine.easeInOut'
    });
  }

  createBg() {
    this.bg = this.gui.createFullscreenBackground('deadBg', 'bottom');

    this.bubbleEmitter = new BubbleEmitter(this);
    this.bubbleEmitter.setTiming(1000, 1000);
  }
}
