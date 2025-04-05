import BaseScene from './BaseScene';
import { creditsText } from '../credits.ts';

export default class EndScene extends BaseScene {
  endMusic!: Phaser.Sound.BaseSound;
  private container!: Phaser.GameObjects.Container;
  private scrollSpeed = 50;

  constructor() {
    super('EndScene');
  }

  create() {
    this.endMusic = this.sound.add('menuMusic', { loop: true, volume: 0.5 });
    this.endMusic.play();

    this.createUI()

    this.scale.on('resize', this.resize, this);

    this.input.once('pointerdown', () => {
      this.nextScene()
    });
    this.input.keyboard.on('keydown-ESC', () => {
      this.nextScene()
    })

    this.events.on('shutdown', () => {
      if (this.endMusic && this.endMusic.isPlaying) {
        this.endMusic.stop();
      }
    });
  }

  update(time: number, delta: number) {
    const dy = (this.scrollSpeed * delta) / 1000;
    this.container.y -= dy;

    if (this.container.y < -200) {
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
    const title = this.add.text(0, 0, 'Congratulations!', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5, 0);

    const credits = this.add.text(0, 100, creditsText, {
      fontSize: '16px',
      color: '#ffffff',
      align: 'left',
    }).setOrigin(0.5, 0);

    this.container = this.add.container(this.centerX, this.centerY, [title, credits]);
    this.container.setDepth(1);
  }
}
