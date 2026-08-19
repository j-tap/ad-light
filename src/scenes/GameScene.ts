import Phaser from 'phaser';
import BaseScene from './BaseScene';
import { Player } from '../game/Player';
import { LevelManager } from '../game/LevelManager';
import { GameManager } from '../game/GameManager';
import { CameraDirector } from '../game/systems/CameraDirector';
import { Hud } from '../ui/Hud';
import { config, LevelConfig } from '../config';

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
  protected hud!: Hud;
  protected cameraDirector!: CameraDirector;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private groundBody?: Phaser.Physics.Arcade.Sprite;
  private currentMusic?: Phaser.Sound.BaseSound;
  private currentTrackIndex = 0;

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

    this.hud = new Hud(this);
    this.updateUI();
    this.createUiCamera();

    this.physics.add.collider(this.player.getSprite(), this.ground);
  }

  update(time: number, delta: number) {
    this.levelManager.update();
    this.gameManager.update(delta);

    if (!this.gameManager.isPlaying()) return;

    this.player.update(time, delta);
    this.cameraDirector.update(delta, this.gameManager.getThreat());
    this.updateUI();
  }

  protected createLevel() {
    const { width, textures, plankton } = this.levelConfig;

    this.physics.world.gravity.y = config.world.gravityY;
    this.physics.world.setBounds(0, 0, width, this.scale.height);

    this.levelManager.createLevel({ textures, plankton: plankton !== false });
    this.createGround();

    this.player = new Player(this, this.gameManager.getNoiseField());
    this.createCamera();
    this.cameraDirector = new CameraDirector(this);

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

  /**
   * The chase zoom scales everything the main camera draws, so the interface gets its own
   * camera. World objects are kept out of it as they appear, including the ones spawned later.
   */
  private createUiCamera() {
    const uiObjects: Phaser.GameObjects.GameObject[] = [
      ...this.hud.getElements(),
      this.cameraDirector.getOverlay(),
    ];

    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');

    this.cameras.main.ignore(uiObjects);
    this.uiCamera.ignore(this.children.list.filter(child => !uiObjects.includes(child)));

    this.onSceneEvent(Phaser.Scenes.Events.ADDED_TO_SCENE, (object: Phaser.GameObjects.GameObject) => {
      if (!uiObjects.includes(object)) {
        this.uiCamera.ignore(object);
      }
    });
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
    this.onSceneEvent('player-damaged', () => this.cameraDirector.onDamage());
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
    this.hud.layout();
    this.cameraDirector.layout();
    this.uiCamera.setSize(this.scale.width, this.scale.height);
  }

  private updateUI() {
    this.hud.setMollusks(this.gameManager.getScore(), this.levelConfig.mollusks.count);
    this.hud.setHealth(this.player.getHealth());
    this.hud.setLight(this.player.getLightRatio());
  }
}
