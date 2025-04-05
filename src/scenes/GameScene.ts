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

  constructor() {
    super('GameScene');
  }

  create() {
    this.levelManager = new LevelManager(this);
    this.player = new Player(this);
    this.gameManager = new GameManager(this);

    this.currentTrackIndex = Phaser.Math.Between(0, this.musicKeys.length - 1);
    this.playNextTrack();

    this.scale.on('resize', this.resize, this);
    this.createUI();
    this.gameManager.startGame();

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.gameManager.isPlaying()) {
        this.gameManager.pauseGame();
        this.scene.launch('PauseScene');
        this.scene.pause();
      }
    });

    this.events.on('resume-game', () => {
      this.gameManager.startGame();
      this.currentMusic.play()
    });

    this.events.on('pause', () => {
      if (this.currentMusic && this.currentMusic.isPlaying) {
        this.currentMusic.pause();
      }
    })
    this.events.on('shutdown', () => {
      if (this.currentMusic && this.currentMusic.isPlaying) {
        this.currentMusic.stop();
      }
    });
  }

  update(time: number, delta: number) {
    if (this.gameManager.isPlaying()) {
      this.player.update(time, delta);
      this.levelManager.update(time, delta);
    }
    this.gameManager.update(time, delta);
  }

  createUI() {
    this.add.text(this.centerX, this.centerY - 80, 'Game Started!', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.rexUI.add.label({
      x: this.centerX,
      y: this.centerY,
      width: 150,
      height: 50,
      background: this.add.rectangle(0, 0, 150, 50, 0x3498db).setInteractive(),
      text: this.add.text(0, 0, 'End', { fontSize: '24px', color: '#ffffff' }),
      align: 'center',
      space: { left: 10, right: 10, top: 10, bottom: 10 }
    })
      .layout()
      .setInteractive()
      .on('pointerdown', () => {
        this.scene.start('EndScene');
      });
  }

  playNextTrack() {
    if (this.currentMusic) {
      this.currentMusic.destroy();
    }

    const musicKey = this.musicKeys[this.currentTrackIndex];
    this.currentMusic = this.sound.add(musicKey, { volume: 0.5 });
    this.currentMusic.play();

    this.currentMusic.once('complete', () => {
      let nextIndex;
      do {
        nextIndex = Phaser.Math.Between(0, this.musicKeys.length - 1);
      } while (nextIndex === this.currentTrackIndex);

      this.currentTrackIndex = nextIndex;
      this.playNextTrack();
    });
  }

  resize() {
    //
  }
}
