import Phaser from 'phaser';
import BaseScene from './BaseScene';
import { GUI } from '../ui/Gui';
import { BubbleEmitter } from '../game/BubbleEmitter';
import { formatTime, progressStore } from '../game/ProgressStore';

const CREDITS_DELAY = 3600;

export default class WinScene extends BaseScene {
  private gui!: GUI;
  private background!: Phaser.GameObjects.Image;
  private title!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private music!: Phaser.Sound.BaseSound;

  constructor() {
    super('WinScene');
  }

  create() {
    super.create();

    this.gui = new GUI(this);

    // Kept alive on purpose: EndScene keeps playing the same track over the credits.
    this.music = this.sound.add('victory', { volume: 0.4 });
    this.music.play();

    this.createBackground();
    this.createUI();
    this.layout();

    this.onResize(() => this.layout());

    this.time.delayedCall(CREDITS_DELAY, () => {
      this.fadeToScene('EndScene', { music: this.music });
    });
  }

  private createBackground() {
    this.background = this.gui.createFullscreenBackground('winBg', 'bottom');

    new BubbleEmitter(this, undefined, { minDelay: 1000, maxDelay: 1000 });
  }

  private createUI() {
    this.title = this.add.text(0, 0, 'You survived', {
      fontSize: '44px',
      color: '#dcdcdc',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const run = progressStore.finishRun();
    const best = run.bestTotalMs ?? run.totalMs;
    const record = run.isRecord && run.totalMs > 0 ? '  New record' : '';

    this.timeText = this.add.text(0, 0, `Time ${formatTime(run.totalMs)}  Best ${formatTime(best)}${record}`, {
      fontSize: '22px',
      color: '#c5d8e6',
      fontFamily: 'Arial',
    })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.tweens.add({
      targets: [this.title, this.timeText],
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Sine.easeInOut'
    });
  }

  private layout() {
    this.gui.resizeFullscreenBackground(this.background);
    this.title.setPosition(this.centerX, this.centerY / 3);
    this.timeText.setPosition(this.centerX, this.title.y + 64);
  }
}
