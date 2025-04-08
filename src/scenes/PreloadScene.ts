import Phaser from 'phaser';
import BaseScene from './BaseScene';

export default class PreloadScene extends BaseScene {
  private progressBar!: Phaser.GameObjects.Image;
  private progressBox!: Phaser.GameObjects.Image;
  private loadingText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;

  get centerX() {
    return this.scale.width / 2;
  }

  get centerY() {
    return this.scale.height / 2;
  }

  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.load.image('loader', 'assets/images/loader.png');
    this.load.image('loaderLine', 'assets/images/loader-line.png');

    this.load.once('complete', () => {
      this.createPreloader();
      this.loadAssets();
      this.handleLoadingEvents();

      this.load.once('complete', () => {
        this.time.delayedCall(500, () => {
          this.fadeToScene('StartScene');
        });
      });

      this.load.start();
    });

    this.load.start();
  }

  loadAssets() {
    this.load.spritesheet('player', 'assets/images/player-sprite.png', {
      frameWidth: 128,
      frameHeight: 128,
    });

    this.load.spritesheet('enemy1', 'assets/images/enemy-1-sprite.png', {
      frameWidth: 128,
      frameHeight: 128,
    });

    this.load.image('logo', 'assets/images/logo-title.png');
    this.load.image('menuBg', 'assets/images/bg/menu-bg.png');
    this.load.image('deadBg', 'assets/images/bg/dead-bg.png');
    this.load.image('winBg', 'assets/images/bg/win-bg.png');
    this.load.image('btn', 'assets/images/btn.png');
    this.load.image('mollusk', 'assets/images/mollusk.png');
    this.load.image('fishBone', 'assets/images/fish-bone.png');
    // this.load.image('swallowtail', 'assets/images/enemy-swallowtail.png');
    this.load.image('kraken', 'assets/images/enemy-kraken.png');
    this.load.image('planktonParticle', 'assets/images/plankton-particle.png');

    this.load.image('level1BgFar', 'assets/images/bg/level-1-bg-far.png');
    this.load.image('level1Bg', 'assets/images/bg/level-1-bg.png');
    this.load.image('level1Fg', 'assets/images/bg/level-1-fg.png');

    this.load.image('level2BgFar', 'assets/images/bg/level-2-bg-far.png');
    this.load.image('level2Bg', 'assets/images/bg/level-2-bg.png');
    this.load.image('level2Fg', 'assets/images/bg/level-2-fg.png');

    this.load.image('level3BgFar', 'assets/images/bg/level-3-bg-far.png');
    this.load.image('level3Bg', 'assets/images/bg/level-3-bg.png');
    this.load.image('level3Fg', 'assets/images/bg/level-3-fg.png');

    this.load.audio('menuMusic', 'assets/audio/music/menu.mp3');
    this.load.audio('gameMusic2', 'assets/audio/music/game2.mp3');
    this.load.audio('gameMusic3', 'assets/audio/music/game1.mp3');
    this.load.audio('gameMusic1', 'assets/audio/music/game3.mp3');
    this.load.audio('victory', 'assets/audio/music/victory.mp3');
    this.load.audio('depth', 'assets/audio/depth.mp3');
    this.load.audio('eat', 'assets/audio/eat.mp3');
    this.load.audio('drip', 'assets/audio/drip.mp3');
    this.load.audio('fishBubble', 'assets/audio/fish-bubble.mp3');
  }

  createPreloader() {
    this.progressBox = this.add.image(this.centerX, this.centerY, 'loader')
      .setOrigin(0.5)
      .setDisplaySize(320, 50);

    this.progressBar = this.add.image(this.centerX - 150, this.centerY, 'loaderLine')
      .setOrigin(0, 0.5)
      .setDisplaySize(0, 30);

    this.loadingText = this.add.text(this.centerX, this.centerY - 50, 'Loading...', {
        fontSize: '20px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.percentText = this.add.text(this.centerX, this.centerY + 50, '0%', {
        fontSize: '18px',
        color: '#ffffff'
      })
      .setOrigin(0.5);
  }

  handleLoadingEvents() {
    this.load.on('progress', (value: number) => {
      this.progressBar.setDisplaySize(300 * value, 30);
      this.percentText.setText(Math.floor(value * 100) + '%');
    });

    this.load.on('complete', () => {
      this.destroyPreloader();
    });
  }

  destroyPreloader() {
    this.progressBar.destroy();
    this.progressBox.destroy();
    this.loadingText.destroy();
    this.percentText.destroy();
  }
}
