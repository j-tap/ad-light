import BaseScene from './BaseScene';
import { creditsText } from '../credits';

export default class EndScene extends BaseScene {
  private music!: Phaser.Sound.BaseSound;
  private container!: Phaser.GameObjects.Container;
  private scrollSpeed = 50;

  constructor() {
    super('EndScene');
  }

  create() {
    this.music = this.sound.add('menuMusic', { loop: true, volume: 0.3 });
    this.music.play();

    this.createUI()

    this.scale.on('resize', this.resize, this);

    this.input.once('pointerdown', () => {
      this.nextScene()
    });
    this.input.keyboard.on('keydown-ESC', () => {
      this.nextScene()
    })

    this.events.on('shutdown', () => {
      if (this.music && this.music.isPlaying) {
        this.music.stop();
      }
    });
  }

  update(time: number, delta: number) {
    const dy = (this.scrollSpeed * delta) / 1000;
    this.container.y -= dy;

    if (this.container.getBounds().bottom < 0) {
      this.nextScene()
    }
  }

  nextScene() {
    this.scene.start('StartScene');
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
}
