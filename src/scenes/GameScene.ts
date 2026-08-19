import Phaser from 'phaser';
import BaseScene from './BaseScene';
import { Player } from '../game/Player';
import { LevelManager } from '../game/LevelManager';
import { GameManager } from '../game/GameManager';
import { CameraDirector } from '../game/systems/CameraDirector';
import { TutorialDirector } from '../game/systems/TutorialDirector';
import { Hud } from '../ui/Hud';
import { config, isVerticalLevel, levelWorldSize, nextLevelScene, LevelConfig } from '../config';
import { formatTime, progressStore } from '../game/ProgressStore';

const DEATH_DELAY = 2500;

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
  private tutorial?: TutorialDirector;
  private groundBody?: Phaser.Physics.Arcade.Sprite;
  private currentMusic?: Phaser.Sound.BaseSound;
  private currentTrackIndex = 0;
  private lastDepthProgress = -1;

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

    if (this.levelConfig.tutorial) {
      this.tutorial = new TutorialDirector(this.hud, this.player, this.gameManager);
    }

    this.physics.add.collider(this.player.getSprite(), this.ground);
  }

  update(time: number, delta: number) {
    this.levelManager.update();
    this.gameManager.update(delta);

    if (!this.gameManager.isPlaying()) return;

    this.player.update(time, delta);
    this.applyCurrent(delta);
    this.updateDepthPressure();
    this.cameraDirector.update(delta, this.gameManager.getThreat());
    this.tutorial?.update(delta);
    this.updateUI();
  }

  protected createLevel() {
    const { textures, plankton, currentZones } = this.levelConfig;
    const { width, height } = this.worldSize();

    this.physics.world.gravity.y = config.world.gravityY;
    this.physics.world.setBounds(0, 0, width, height);

    this.levelManager.createLevel({
      textures,
      plankton: plankton !== false,
      vertical: this.isVertical(),
      currentZones,
    });
    this.createGround();

    this.player = new Player(this, this.gameManager.getNoiseField(), this.playerSpawn());
    this.createCamera();
    this.cameraDirector = new CameraDirector(this);

    this.gameManager.setPlayer(this.player);
    this.gameManager.startGame(this.levelConfig);
    this.gameManager.setupCollisions(this.player);
  }

  private worldSize() {
    return levelWorldSize(this.levelConfig, this.scale.height);
  }

  private isVertical() {
    return isVerticalLevel(this.levelConfig);
  }

  private playerSpawn() {
    const { width, height } = this.worldSize();

    if (this.isVertical()) {
      return { x: width / 2, y: Math.min(this.scale.height * 0.4, 280) };
    }

    return { x: this.scale.width / 2, y: height / 2 };
  }

  private createCamera() {
    const camera = this.cameras.main;
    const { width, height } = this.worldSize();

    camera.setBounds(0, 0, width, height);
    camera.startFollow(this.player.getSprite(), true, 0.09, 0.09, 0, 0);
    camera.setLerp(0.1, 0.1);
    camera.setRoundPixels(false);
    camera.setDeadzone(this.isVertical() ? 150 : 0, this.isVertical() ? 0 : 150);
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
    const { width, height } = this.worldSize();

    this.groundBody
      ?.setOrigin(0.5)
      .setPosition(width / 2, height - groundOffsetY)
      .setDisplaySize(width, groundHeight)
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

    this.onSceneEvent(Phaser.Scenes.Events.PAUSE, () => {
      this.currentMusic?.pause();
      this.tutorial?.hide();
    });
    this.onSceneEvent('player-damaged', () => {
      this.gameManager.noteDamage();
      this.cameraDirector.onDamage();
    });
    this.onSceneEvent('player-died', () => this.handlePlayerDied());
    this.onSceneEvent('player-win', () => this.handlePlayerWin());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.currentMusic?.destroy();
      this.currentMusic = undefined;
    });
  }

  private handlePlayerDied() {
    this.currentMusic?.stop();
    this.tutorial?.hide();
    this.gameManager.loseGame();

    this.time.delayedCall(DEATH_DELAY, () => {
      this.fadeToScene('GameOverScene', { level: this.gameManager.getLastLevel() });
    });
  }

  private handleResize() {
    if (!this.groundBody) return;

    const { width, height } = this.worldSize();

    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width, height);

    this.layoutGround();
    this.levelManager.resize();
    this.hud.layout();
    this.cameraDirector.layout();
    this.uiCamera.setSize(this.scale.width, this.scale.height);
  }

  private applyCurrent(delta: number) {
    const zones = this.levelConfig.currentZones;

    if (!zones?.length) return;

    const sprite = this.player.getSprite();
    const zone = zones.find(entry => sprite.y >= entry.y && sprite.y < entry.y + entry.height);

    if (!zone) return;

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.velocity.x += zone.forceX * (delta / 1000) * 30;
  }

  /** Ambient light and fuel drain follow how far down the player has gone. */
  private updateDepthPressure() {
    const effects = this.levelConfig.depthEffects;

    if (!effects) return;

    const progress = Phaser.Math.Clamp(this.player.getSprite().y / this.worldSize().height, 0, 1);

    if (Math.abs(progress - this.lastDepthProgress) < config.world.depthUpdateStep) return;

    this.lastDepthProgress = progress;

    const finale = this.levelConfig.finaleHeight;
    let ambientFrom = effects.ambientFrom;
    let ambientTo = effects.ambientTo;
    let drainFrom = effects.lightDrainFrom;
    let drainTo = effects.lightDrainTo;

    if (finale) {
      const { height } = this.worldSize();
      const finaleStart = 1 - finale / height;

      if (progress >= finaleStart) {
        const t = (progress - finaleStart) / Math.max(1 - finaleStart, 0.001);
        ambientFrom = effects.ambientTo;
        ambientTo = 0x020305;
        drainFrom = effects.lightDrainTo;
        drainTo = effects.lightDrainTo + 0.4;
        this.lights.setAmbientColor(this.lerpColor(ambientFrom, ambientTo, t));
        this.player.setLightDrainMultiplier(Phaser.Math.Linear(drainFrom, drainTo, t));
        return;
      }
    }

    this.lights.setAmbientColor(this.lerpColor(ambientFrom, ambientTo, progress));
    this.player.setLightDrainMultiplier(Phaser.Math.Linear(drainFrom, drainTo, progress));
  }

  private lerpColor(from: number, to: number, t: number) {
    const a = Phaser.Display.Color.IntegerToColor(from);
    const b = Phaser.Display.Color.IntegerToColor(to);
    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, t * 100);

    return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
  }

  private updateUI() {
    this.hud.setMollusks(this.gameManager.getScore(), this.levelConfig.mollusks.count);
    this.hud.setHealth(this.player.getHealth());
    this.hud.setLight(this.player.getLightRatio());
    this.hud.setTime(this.gameManager.getElapsed());
  }

  private handlePlayerWin() {
    const result = progressStore.finishLevel(
      this.scene.key,
      this.gameManager.getElapsed(),
      !this.gameManager.wasDamaged()
    );
    const next = nextLevelScene(this.scene.key);

    if (next === 'WinScene') {
      progressStore.finishRun();
    }

    const lines = [
      result.isRecord ? `New record ${formatTime(result.timeMs)}` : formatTime(result.timeMs),
      `Best ${formatTime(result.bestTimeMs)}`,
    ];

    if (result.noDamage) {
      lines.push('No damage');
    }

    this.hud.showResult(lines.join('\n'));
    this.time.delayedCall(config.records.resultToastMs, () => this.fadeToScene(next));
  }
}
