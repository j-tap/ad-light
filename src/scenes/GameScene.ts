import BaseScene from './BaseScene';
import { Player } from '../game/Player';
import { LevelManager } from '../game/LevelManager';
import { GameManager } from '../game/GameManager';

export default class GameScene extends BaseScene {
  protected gameManager!: GameManager;
  protected player!: Player;
  protected levelManager!: LevelManager;
  protected scoreText!: Phaser.GameObjects.Text;
  protected hearts: Phaser.GameObjects.Text[] = [];
  protected musicKeys = ['gameMusic1', 'gameMusic2'];
  protected currentTrackIndex = 0;
  protected currentMusic!: Phaser.Sound.BaseSound;
  protected nextScene: string
  protected levelWidth: number = 0;
  protected enemyCount: number = 0;
  protected molluskCount: number = 0;

  constructor(key: string) {
    super(key);
  }

  create() {
    this.gameManager = new GameManager(this);
    this.levelManager = new LevelManager(this);

    this.createAnimations();
    this.setupMusic();
    this.createUI();
    this.setupEvents();
    this.createLevel();
    this.setupPlayerUI();
  }

  createLevel() {}

  update(time: number, delta: number) {
    this.gameManager.update(time, delta);

    if (!this.gameManager.isPlaying()) return;

    this.player.update(time, delta);
    this.levelManager.update(time, delta);

    this.updateUI();
  }

  createUI() {}

  updateUI() {}

  createAnimations() {
    const animations = [
      { key: 'swim', texture: 'player', frameRate: 8 },
      { key: 'enemy-swim', texture: 'enemy1', frameRate: 6 },
    ];

    animations.forEach(({ key, texture, frameRate }) => {
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 3 }),
        frameRate,
        repeat: -1
      });
    });
  }

  setupMusic() {
    this.currentTrackIndex = Phaser.Math.Between(0, this.musicKeys.length - 1);
    this.playNextTrack();
  }

  playNextTrack() {
    if (this.currentMusic) {
      this.currentMusic.destroy();
    }

    const musicKey = this.musicKeys[this.currentTrackIndex];
    this.currentMusic = this.sound.add(musicKey, { volume: 0.25 });
    this.currentMusic.play();

    this.currentMusic.once('complete', () => {
      this.currentTrackIndex = this.getRandomTrackIndex(this.currentTrackIndex);
      this.playNextTrack();
    });
  }

  getRandomTrackIndex(exclude: number): number {
    let index;
    do {
      index = Phaser.Math.Between(0, this.musicKeys.length - 1);
    } while (index === exclude);
    return index;
  }

  setupEvents() {
    this.scale.on('resize', () => {});

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.gameManager.isPlaying()) {
        this.gameManager.pauseGame();
      }
    });

    this.events.on('resume-game', () => {
      this.gameManager.resumeGame();
      this.currentMusic?.resume();
    });

    this.events.on('pause', () => {
      this.currentMusic?.pause();
    });

    this.events.on('shutdown', () => {
      this.currentMusic?.stop();
    });

    this.events.on('player-died', () => {
      this.currentMusic.stop();
      this.gameManager.loseGame();
    });
  }

  setupPlayerUI() {
    this.scoreText = this.add.text(20, 20, 'Mollusks: 0/0', {
      fontSize: '24px',
      color: '#dcdcdc',
      fontFamily: 'Arial'
    }).setScrollFactor(0);

    this.createHearts();
  }

  createHearts() {
    this.hearts.forEach(heart => heart.destroy());
    this.hearts = [];

    const heartSpacing = 40;
    const startX = 20;
    const startY = 70;

    for (let i = 0; i < this.player.getHealth(); i++) {
      const heart = this.add.text(startX + i * heartSpacing, startY, '❤️', {
        fontSize: '32px'
      })
        .setAlpha(0.6)
        .setScrollFactor(0);
      this.hearts.push(heart);
    }
  }

  startGame() {
    this.gameManager.startGame({
      enemyCount: this.enemyCount,
      molluskCount: this.molluskCount,
    });
  }
}
