import Phaser from 'phaser';
import BaseScene from './BaseScene';
import { creditsText } from '../credits';

export default class EndScene extends BaseScene {
  private readonly scrollSpeed = 140;
  private container!: Phaser.GameObjects.Container;
  private music?: Phaser.Sound.BaseSound;

  constructor() {
    super('EndScene');
  }

  init(data: { music?: Phaser.Sound.BaseSound }) {
    this.music = data.music;
  }

  create() {
    super.create();

    this.createUI();

    this.onResize(() => {
      this.container.x = this.centerX;
    });

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.nextScene());
    this.input.keyboard?.on('keydown-ESC', () => this.nextScene());
  }

  update(time: number, delta: number) {
    this.container.y -= (this.scrollSpeed * delta) / 1000;

    if (this.container.getBounds().bottom < 0) {
      this.nextScene();
    }
  }

  private createUI() {
    const credits = this.add.text(0, 100, creditsText, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#dcdcdc',
      align: 'center',
    })
      .setOrigin(0.5, 0);

    this.container = this.add.container(this.centerX, this.centerY, [credits]).setDepth(1);
  }

  private nextScene() {
    this.fadeToScene('StartScene', {}, () => {
      this.music?.destroy();
      this.music = undefined;
    });
  }
}
