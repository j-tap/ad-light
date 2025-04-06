import BaseScene from './BaseScene';
import { Player } from '../game/Player';
import { LevelManager } from '../game/LevelManager';
import { GameManager } from '../game/GameManager';

export default class GameScene extends BaseScene {
  private gameManager!: GameManager;
  private player!: Player;
  private levelManager!: LevelManager;
  private musicKeys = ['gameMusic1', 'gameMusic2'];
  private currentTrackIndex = 0;
  private currentMusic!: Phaser.Sound.BaseSound;
  private scoreText!: Phaser.GameObjects.Text;
  private levelWidth = 10000;
  private hearts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('GameScene');
  }

  create() {
    this.gameManager = new GameManager(this);

    this.levelManager = new LevelManager(this);
    this.levelManager.createLevel();

    this.createAnimations();
    this.createPlayer(); // сначала игрок
    this.createCamera();

    this.gameManager.setPlayer(this.player);

    this.setupMusic();
    this.createUI();
    this.setupEvents();

    this.gameManager.startGame();
    this.gameManager.setupCollisions(this.player);

    this.cameras.main.postFX.addVignette(.5, .5, .8, 0)

    this.scoreText = this.add.text(20, 20, 'Mollusks: 0/0', {
      fontSize: '24px',
      color: '#dcdcdc',
      fontFamily: 'Arial'
    }).setScrollFactor(0);

    this.createHearts();
  }

  update(time: number, delta: number) {
    this.gameManager.update(time, delta);

    if (!this.gameManager.isPlaying()) return;

    this.player.update(time, delta);
    this.levelManager.update(time, delta);

    this.scoreText.setText('Mollusks: ' + this.gameManager.getScore() + '/' + this.gameManager.getMolluskCount());

    this.updateHearts();
  }

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

  createPlayer() {
    this.player = new Player(this);
    this.physics.world.gravity.y = 50;
    this.physics.world.setBounds(0, 0, this.levelWidth, this.scale.height);
  }

  createCamera() {
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.scale.height);
    this.cameras.main.startFollow(this.player.getSprite(), true, 0.08, 0.08);
    this.cameras.main.setDeadzone(0, 100);
    this.cameras.main.setBackgroundColor('#000000');
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
    this.currentMusic = this.sound.add(musicKey, { volume: 0.3 });
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
        this.scene.launch('PauseScene');
        this.scene.pause();
      }
    });

    this.events.on('resume-game', () => {
      this.gameManager.startGame();
      this.currentMusic?.resume();
    });

    this.events.on('pause', () => {
      this.currentMusic?.pause();
    });

    this.events.on('shutdown', () => {
      this.currentMusic?.stop();
    });
  }

  createUI() {
    //
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
        .setAlpha(0.4)
        .setScrollFactor(0);
      this.hearts.push(heart);
    }
  }

  updateHearts() {
    if (!this.player) return;
    const health = this.player.getHealth();
    this.hearts.forEach((heart, index) => {
      heart.setVisible(index < health);
    });
  }
}
