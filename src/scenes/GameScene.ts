import Phaser from 'phaser';
import BaseScene from './BaseScene';
import { Player } from '../game/Player';
import { LevelManager } from '../game/LevelManager';
import { GameManager } from '../game/GameManager';
import { config, LevelConfig } from '../config';

const UI_DEPTH = 100;
const HEART_SPACING = 40;
const DEATH_DELAY = 2500;
const WIN_DELAY = 500;

export default class GameScene extends BaseScene {
  protected readonly cameraBackgroundColor = '#000000';
  protected readonly ambientColor = 0x1a2a6c;
  protected readonly levelConfig: LevelConfig;
  protected gameManager!: GameManager;
  protected levelManager!: LevelManager;
  protected player!: Player;
  protected ground!: Phaser.Physics.Arcade.StaticGroup;
  private groundBody?: Phaser.Physics.Arcade.Sprite;
  private scoreText!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Text[] = [];
  private currentMusic?: Phaser.Sound.BaseSound;
  private currentTrackIndex = 0;
  private lastScore = -1;
  private lastHealth = -1;

  constructor(key: string, levelConfig: LevelConfig) {
    super(key);
    this.levelConfig = levelConfig;
  }

  create() {
    super.create();

    this.gameManager = new GameManager(this);
    this.levelManager = new LevelManager(this);
    this.gameManager.setCurrentLevel(this.scene.key);

    this.lights.enable().setAmbientColor(this.ambientColor);

    this.setupMusic();
    this.setupEvents();
    this.createLevel();
    this.createPlayerUI();

    this.physics.add.collider(this.player.getSprite(), this.ground);
  }

  update(time: number, delta: number) {
    this.levelManager.update();
    this.gameManager.update();

    if (!this.gameManager.isPlaying()) return;

    this.player.update(time, delta);
    this.updateUI();
  }

  protected createLevel() {
    const { width, textures, plankton } = this.levelConfig;

    this.physics.world.gravity.y = config.world.gravityY;
    this.physics.world.setBounds(0, 0, width, this.scale.height);

    this.levelManager.createLevel({ textures, plankton: plankton !== false });
    this.createGround();

    this.player = new Player(this);
    this.createCamera();

    this.gameManager.setPlayer(this.player);
    this.gameManager.startGame(this.levelConfig);
    this.gameManager.setupCollisions(this.player);
  }

  private createCamera() {
    const camera = this.cameras.main;

    camera.setBounds(0, 0, this.levelConfig.width, this.scale.height);
    camera.startFollow(this.player.getSprite(), true, 0.09, 0.09, 0, 0);
    camera.setLerp(0.1, 0.1);
    camera.setRoundPixels(false);
    camera.setDeadzone(0, 150);
    camera.setBackgroundColor(this.cameraBackgroundColor);
  }

  private createGround() {
    this.ground = this.physics.add.staticGroup();
    this.groundBody = this.ground.create(0, 0) as Phaser.Physics.Arcade.Sprite;
    this.groundBody.setVisible(false);

    this.layoutGround();
  }

  private layoutGround() {
    const { groundHeight, groundOffsetY } = config.world;

    this.groundBody
      ?.setOrigin(0.5)
      .setPosition(this.levelConfig.width / 2, this.scale.height - groundOffsetY)
      .setDisplaySize(this.levelConfig.width, groundHeight)
      .refreshBody();
  }

  private setupMusic() {
    if (!this.levelConfig.music.length) return;

    this.currentTrackIndex = Phaser.Math.Between(0, this.levelConfig.music.length - 1);
    this.playCurrentTrack();
  }

  private playCurrentTrack() {
    const tracks = this.levelConfig.music;
    const isSingleTrack = tracks.length === 1;

    this.currentMusic?.destroy();
    this.currentMusic = this.sound.add(tracks[this.currentTrackIndex], {
      volume: 0.5,
      loop: isSingleTrack,
    });
    this.currentMusic.play();

    if (isSingleTrack) return;

    this.currentMusic.once(Phaser.Sound.Events.COMPLETE, () => {
      const step = Phaser.Math.Between(1, tracks.length - 1);
      this.currentTrackIndex = (this.currentTrackIndex + step) % tracks.length;
      this.playCurrentTrack();
    });
  }

  private setupEvents() {
    this.onResize(() => this.handleResize());

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.gameManager.isPlaying()) {
        this.gameManager.pauseGame();
      }
    });

    this.onSceneEvent('resume-game', () => {
      this.gameManager.resumeGame();
      this.currentMusic?.resume();
    });

    this.onSceneEvent(Phaser.Scenes.Events.PAUSE, () => this.currentMusic?.pause());
    this.onSceneEvent('player-died', () => this.handlePlayerDied());
    this.onSceneEvent('player-win', () => {
      this.time.delayedCall(WIN_DELAY, () => this.fadeToScene(this.levelConfig.nextScene));
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.currentMusic?.destroy();
      this.currentMusic = undefined;
    });
  }

  private handlePlayerDied() {
    this.currentMusic?.stop();
    this.gameManager.loseGame();

    this.time.delayedCall(DEATH_DELAY, () => {
      this.fadeToScene('GameOverScene', { level: this.gameManager.getLastLevel() });
    });
  }

  private handleResize() {
    if (!this.groundBody) return;

    this.physics.world.setBounds(0, 0, this.levelConfig.width, this.scale.height);
    this.cameras.main.setBounds(0, 0, this.levelConfig.width, this.scale.height);

    this.layoutGround();
    this.levelManager.resize();
  }

  private createPlayerUI() {
    this.scoreText = this.add.text(20, 20, '', {
      fontSize: '24px',
      color: '#dcdcdc',
      fontFamily: 'Arial'
    })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.hearts = [];

    for (let i = 0; i < config.player.maxHealth; i++) {
      this.hearts.push(
        this.add.text(20 + i * HEART_SPACING, 70, '❤️', { fontSize: '32px' })
          .setAlpha(0.6)
          .setScrollFactor(0)
          .setDepth(UI_DEPTH)
      );
    }

    this.lastScore = -1;
    this.lastHealth = -1;
    this.updateUI();
  }

  private updateUI() {
    const score = this.gameManager.getScore();
    const health = this.player.getHealth();

    if (score !== this.lastScore) {
      this.lastScore = score;
      this.scoreText.setText(`Mollusks: ${score}/${this.levelConfig.mollusks.count}`);
    }

    if (health !== this.lastHealth) {
      this.lastHealth = health;
      this.hearts.forEach((heart, index) => heart.setVisible(index < health));
    }
  }
}
