import BaseScene from './BaseScene';
import { creditsText } from '../credits';

export default class EndScene extends BaseScene {
  private music!: Phaser.Sound.BaseSound;
  private container!: Phaser.GameObjects.Container;
  private scrollSpeed = 140;
  private isEnd: boolean;

  constructor() {
    super('EndScene');
  }

  init(data: { music: Phaser.Sound.BaseSound }) {
    this.music = data.music;
  }

  create() {
    this.isEnd = false;
    this.createUI();

    this.scale.on('resize', this.resize, this);

    this.input.once('pointerdown', () => {
      this.nextScene()
    });
    this.input.keyboard.on('keydown-ESC', () => {
      this.nextScene()
    })
  }

  update(time: number, delta: number) {
    const dy = (this.scrollSpeed * delta) / 1000;
    this.container.y -= dy;

    if (this.container.getBounds().bottom < 0) {
      this.nextScene()
    }
  }

  resize() {
    if (this.container) {
      this.container.x = this.centerX;
    }
  }

  createUI() {
    const credits = this.add.text(0, 100, creditsText, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#dcdcdc',
      align: 'center',
    })
      .setOrigin(0.5, 0);

    this.container = this.add.container(this.centerX, this.centerY, [credits]);
    this.container.setDepth(1);
  }

  nextScene() {
    if (this.isEnd) return;
    this.isEnd = true;
    this.music.stop();
    this.fadeToScene('StartScene');
  }
}
