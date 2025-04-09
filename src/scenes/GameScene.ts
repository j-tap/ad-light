import BaseScene from './BaseScene';
import { Player } from '../game/Player';
import { LevelManager } from '../game/LevelManager';
import { GameManager } from '../game/GameManager';
import {LevelConfig} from '../config'

export default class GameScene extends BaseScene {
  protected readonly cameraBackgroundColor = '#000000';
  protected gameManager!: GameManager;
  protected player!: Player;
  protected levelManager!: LevelManager;
  protected ground!: Phaser.Physics.Arcade.StaticGroup;
  protected scoreText!: Phaser.GameObjects.Text;
  protected currentMusic!: Phaser.Sound.BaseSound;
  protected hearts: Phaser.GameObjects.Text[] = [];
  protected musicKeys = [];
  protected levelConfig: LevelConfig;
  protected currentTrackIndex = 0;
  protected ambientColor: number = 0x1a2a6c;
  public nextScene: string

  constructor(key: string) {
    super(key);
  }

  create() {
    this.gameManager = new GameManager(this);
    this.levelManager = new LevelManager(this);
    this.gameManager.setCurrentLevel(this.scene.key);

    this.createLighting();
    this.createAnimations();
    this.setupMusic();
    this.createUI();
    this.setupEvents();
    this.createLevel();
    this.setupPlayerUI();
    this.setupCollisions();
    this.fadeIn();
  }

  createLevel() {}

  update(time: number, delta: number) {
    this.gameManager.update(time, delta);

    if (!this.gameManager.isPlaying()) return;

    this.player.update(time, delta);
    this.levelManager.update();

    this.updateUI();
  }

  createUI() {}

  updateUI() {}

  createAnimations() {
    this.anims.create({
      key: 'swim',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 2 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'enemy-swim',
      frames: this.anims.generateFrameNumbers('enemy1', { start: 0, end: 2 }),
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: 'enemy-attack',
      frames: [
        { key: 'enemy1', frame: 2 },
        { key: 'enemy1', frame: 3 },
      ],
      frameRate: 6,
      repeat: 1,
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
    this.currentMusic = this.sound.add(musicKey, { volume: 0.5 });
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

      this.time.delayedCall(2500, () => {
        this.fadeToScene('GameOverScene', { level: this.gameManager.getLastLevel() });
      });
    });

    this.events.on('player-win', () => {
      this.time.delayedCall(500, () => {
        this.fadeToScene(this.nextScene);
      });
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

  createCamera() {
    this.cameras.main.setBounds(0, 0, this.levelConfig.width, this.scale.height);
    this.cameras.main.startFollow(this.player.getSprite(), true, 0.09, 0.09, 0, 0);
    this.cameras.main.setLerp(0.1, 0.1);
    this.cameras.main.setRoundPixels(false);
    this.cameras.main.setDeadzone(0, 150);
    this.cameras.main.setBackgroundColor(this.cameraBackgroundColor);
  }

  startGame() {
    this.gameManager.startGame(this.levelConfig);
  }

  private createLighting() {
    this.lights.enable().setAmbientColor(this.ambientColor);
  }

  private setupCollisions() {
    this.physics.add.collider(this.player.getSprite(), this.ground);
  }
}
