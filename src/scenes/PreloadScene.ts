import Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
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
    this.createPreloader();
    this.loadAssets();
    this.handleLoadingEvents();
  }

  create() {
    this.scene.start('StartScene');
  }

  loadAssets() {
    this.load.image('logo', 'assets/images/logo.png');
    this.load.audio('menuMusic', 'assets/audio/menu.mp3');

    this.load.audio('gameMusic1', 'assets/audio/game1.mp3');
    this.load.audio('gameMusic2', 'assets/audio/game2.mp3');
  }

  createPreloader() {
    // Background
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x000000, 0.2);
    this.progressBox.fillRect(this.centerX - 160, this.centerY - 25, 320, 50);

    // Line
    this.progressBar = this.add.graphics();

    // Text
    this.loadingText = this.add.text(this.centerX, this.centerY - 50, 'Loading...', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.percentText = this.add.text(this.centerX, this.centerY, '0%', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);
  }

  handleLoadingEvents() {
    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x000000, 0.5);
      this.progressBar.fillRect(this.centerX - 150, this.centerY - 15, 300 * value, 30);
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
