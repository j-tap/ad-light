import Phaser from 'phaser';
import { GUI } from '../ui/Gui';
import { BubbleEmitter } from '../game/BubbleEmitter'
import BaseScene from './BaseScene'

export default class WinScene extends BaseScene {
  private gui!: GUI;
  private bg!: Phaser.GameObjects.Image;
  private bubbleEmitter: BubbleEmitter;

  constructor() {
    super('WinScene');
  }

  create() {
    this.gui = new GUI(this);

    this.createBg();
    this.createUI();

    this.time.delayedCall(3000, () => {
      this.scene.start('EndScene');
    })
  }

  resize(gameSize: Phaser.Structs.Size) {}

  createUI() {
    const text = this.add.text(this.centerX, this.centerY / 3, 'You survived', {
      fontSize: '44px',
      color: '#dcdcdc',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.tweens.add({
      targets: text,
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Sine.easeInOut'
    });
  }

  createBg() {
    this.bg = this.gui.createFullscreenBackground('winBg', 'bottom');

    this.bubbleEmitter = new BubbleEmitter(this);
    this.bubbleEmitter.setTiming(1000, 1000);
  }
}
