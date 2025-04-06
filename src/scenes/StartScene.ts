import BaseScene from './BaseScene';
import { BubbleEmitter } from '../game/BubbleEmitter'

export default class StartScene extends BaseScene {
  menuMusic!: Phaser.Sound.BaseSound;
  private startButton!: Phaser.GameObjects.GameObject;
  private bg!: Phaser.GameObjects.Image;
  private bubbleEmitter: BubbleEmitter;

  constructor() {
    super('StartScene');
  }

  create() {
    this.menuMusic = this.sound.add('menuMusic', { loop: true, volume: 0.3 });
    this.menuMusic.play();

    this.scale.on('resize', this.resize, this);
    this.createUI();

    this.events.on('shutdown', () => {
      if (this.menuMusic && this.menuMusic.isPlaying) {
        this.menuMusic.stop();
      }
    });

    this.input.keyboard.on('keydown-ENTER', () => {
      this.startGame();
    })
  }

  createUI() {
    this.createBg()

    const btnWidth = 220;
    const btnHeight = 80;
    const background = this.add.image(0, 0, 'btn')
      .setDisplaySize(btnWidth, btnHeight)
      .setInteractive();

    this.startButton = this.rexUI.add.label({
      x: this.centerX,
      y: this.centerY,
      align: 'center',
      width: btnWidth,
      height: btnHeight,
      background,
      text: this.add.text(0, 0, 'Start', { fontSize: '30px', color: '#dcdcdc' }),
      space: { left: 10, right: 10, top: 10, bottom: 10 }
    })
      .layout()
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.startGame();
      })
      .on('pointerover', () => {
        background.setTint(0xcccccc);
      })
      .on('pointerout', () => {
        background.clearTint();
      });
  }

  createBg() {
    this.bg = this.add.image(this.centerX, this.centerY, 'menuBg')
      .setDisplaySize(this.scale.width, this.scale.height)
      .setOrigin(0.5)
      .setScrollFactor(0);

    const fx = this.bg.preFX.addDisplacement('displacementTexture', 0.02, 0.02);

    this.tweens.add({
      targets: fx,
      x: 0.05,
      y: 0.05,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.bubbleEmitter = new BubbleEmitter(this);
    this.bubbleEmitter.setTiming(1000, 1000);
  }

  resize(gameSize: Phaser.Structs.Size) {
    if (this.startButton) {
      (this.startButton as Phaser.GameObjects.Container).setPosition(this.centerX, this.centerY);
    }

    const width = gameSize.width;
    const height = gameSize.height;

    this.bg.setPosition(width / 2, height / 2);
    this.bg.setDisplaySize(width, height);
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
