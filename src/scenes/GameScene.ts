import Phaser from 'phaser';
import BaseScene from './BaseScene';
import { Player } from '../game/Player';
import { LevelManager } from '../game/LevelManager';
import { GameManager } from '../game/GameManager';
import { CameraDirector } from '../game/systems/CameraDirector';
import { TutorialDirector } from '../game/systems/TutorialDirector';
import { Terrain } from '../game/systems/Terrain';
import { Hud } from '../ui/Hud';
import { RockObstacle } from '../game/RockObstacle';
import { TrenchWalls } from '../game/TrenchWalls';
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
  protected terrain?: Terrain;
  protected walls?: TrenchWalls;
  protected currentsEnabled = true;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private tutorial?: TutorialDirector;
  private groundBody?: Phaser.Physics.Arcade.Sprite;
  private rocks: RockObstacle[] = [];
  private currentMusic?: Phaser.Sound.BaseSound;
  private currentTrackIndex = 0;
  private lastDepthY = Number.NaN;

  constructor(key: string, levelConfig: LevelConfig) {
    super(key);
    this.levelConfig = levelConfig;
  }

  create() {
    super.create();

    this.terrain = undefined;
    this.walls = undefined;
    this.rocks = [];
    this.currentsEnabled = true;
    this.lastDepthY = Number.NaN;

    this.gameManager = new GameManager(this);
    this.levelManager = new LevelManager(this);
    this.gameManager.setCurrentLevel(this.scene.key);

    this.lights.enable().setAmbientColor(this.levelConfig.lighting?.ambientColor ?? this.ambientColor);

    this.setupMusic();
    this.setupEvents();
    this.createLevel();

    this.hud = new Hud(this);
    this.updateUI();
    this.createUiCamera();

    if (this.levelConfig.tutorial) {
      this.tutorial = new TutorialDirector(this.hud, this.player, this.gameManager);
    }

    if (this.levelConfig.title) {
      this.hud.showTitle(this.levelConfig.title);
    }

    this.physics.add.collider(this.player.getSprite(), this.ground);
    this.updateDepthPressure();
  }

  update(time: number, delta: number) {
    this.levelManager.update();
    this.gameManager.update(delta);

    if (!this.gameManager.isPlaying()) {
      this.updateAfterGame(time, delta);
      return;
    }

    this.player.update(time, delta);
    this.applyCurrent(delta);
    this.updateDepthPressure();
    this.cameraDirector.update(delta, this.gameManager.getThreat());
    this.tutorial?.update(delta);
    this.updateUI();
  }

  /** Level-specific response to ramming a rock (stun, hints, kraken boost). */
  protected onRockHit() {}

  /** Runs instead of the gameplay update once the level is decided; scripted endings live here. */
  protected updateAfterGame(_time: number, _delta: number) {}

  /** Replaces the mollusk counter with a level specific objective line. */
  protected goalLabel(): string | undefined {
    return undefined;
  }

  protected createLevel() {
    const { textures, plankton, currentZones } = this.levelConfig;
    const { width, height } = this.worldSize();

    this.physics.world.gravity.y = config.world.gravityY;
    this.physics.world.setBounds(0, 0, width, height);
    this.physics.world.drawDebug = false;
    this.physics.world.debugGraphic?.destroy();

    this.levelManager.createLevel({
      textures,
      plankton: plankton !== false,
      vertical: this.isVertical(),
      currentZones,
    });
    this.createGround();
    this.createTerrain();

    this.player = new Player(this, this.gameManager.getNoiseField(), this.playerSpawn());

    if (this.levelConfig.lighting) {
      this.player.applyLightProfile(this.levelConfig.lighting);
    }

    this.createCamera();
    this.cameraDirector = new CameraDirector(this);

    const walls = this.walls;

    this.gameManager.setPlayer(this.player);
    this.gameManager.startGame(
      this.levelConfig,
      walls ? (x, y, margin) => ({ x: walls.clampX(x, y, margin), y }) : undefined
    );
    this.gameManager.setupCollisions(this.player);
  }

  protected worldSize() {
    return levelWorldSize(this.levelConfig, this.scale.height);
  }

  /** Interface elements created after the HUD have to be registered to stay out of the world camera. */
  protected addToUi(objects: Phaser.GameObjects.GameObject[]) {
    objects.forEach(object => {
      // The filter lists the cameras that skip an object: only the world camera should.
      (object as Phaser.GameObjects.GameObject & { cameraFilter: number }).cameraFilter = this.cameras.main.id;
    });

    this.uiObjects.push(...objects);
  }

  protected stopMusic(fadeMs: number) {
    const music = this.currentMusic;

    if (!music) return;

    this.currentMusic = undefined;
    this.tweens.add({
      targets: music,
      volume: 0,
      duration: fadeMs,
      onComplete: () => music.destroy(),
    });
  }

  /** Ambient light and fuel drain follow how deep the player is. */
  protected updateDepthPressure() {
    const profile = this.levelConfig.depthProfile;

    if (!profile?.length) return;

    const y = this.player.getSprite().y;

    if (Math.abs(y - this.lastDepthY) < config.world.depthUpdateStep) return;

    this.lastDepthY = y;

    const next = profile.findIndex(key => key.y >= y);

    if (next <= 0) {
      const key = next === 0 ? profile[0] : profile[profile.length - 1];

      this.lights.setAmbientColor(key.ambient);
      this.player.setLightDrainMultiplier(key.drain);
      return;
    }

    const from = profile[next - 1];
    const to = profile[next];
    const t = (y - from.y) / (to.y - from.y);

    this.lights.setAmbientColor(this.lerpColor(from.ambient, to.ambient, t));
    this.player.setLightDrainMultiplier(Phaser.Math.Linear(from.drain, to.drain, t));
  }

  /** Saves the result, shows it and moves on; scripted endings override the last step. */
  protected completeLevel() {
    this.showLevelResult();
    this.time.delayedCall(config.records.resultToastMs, () => this.fadeToScene(nextLevelScene(this.scene.key)));
  }

  protected showLevelResult() {
    const result = progressStore.finishLevel(
      this.scene.key,
      this.gameManager.getElapsed(),
      !this.gameManager.wasDamaged()
    );

    if (nextLevelScene(this.scene.key) === 'WinScene') {
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
  }

  private createTerrain() {
    const { rocks, shaft } = this.levelConfig;

    if (!rocks?.length && !shaft) return;

    const { width, height } = this.worldSize();

    this.terrain = new Terrain();

    if (shaft) {
      this.walls = new TrenchWalls(this, shaft, width, height, this.terrain, this.scene.key);
    }

    this.rocks = (rocks ?? []).map((def, index) => new RockObstacle(this, def, index));
    this.layoutRocks();
  }

  private layoutRocks() {
    if (!this.rocks.length || !this.terrain) return;

    const { height } = this.worldSize();

    this.terrain.clear();
    this.rocks.forEach(rock => {
      rock.layout(height);
      this.terrain?.addPolygon(rock.getCollider());
    });
  }

  /**
   * Runs after arcade has written the new positions to the sprites, so pushing a sprite out of
   * rock here is what the next physics step starts from.
   */
  private resolveTerrain() {
    const terrain = this.terrain;

    if (!terrain) return;

    this.gameManager.getEnemies().forEach(enemy => enemy.resolveTerrain(terrain));

    if (!this.player.isAlive() || !this.player.isSolid()) return;

    const impact = this.player.resolveTerrain(terrain);

    if (impact < config.rock.hitSpeed || !this.gameManager.isPlaying()) return;

    const { x } = this.player.getSprite();
    const rock = this.rocks.find(candidate => candidate.containsX(x, config.terrain.playerSpread * 3));

    if (rock?.registerHit()) {
      this.onRockHit();
    }
  }

  private isVertical() {
    return isVerticalLevel(this.levelConfig);
  }

  private playerSpawn() {
    const { height } = this.worldSize();

    return this.levelConfig.spawn ?? { x: this.scale.width / 2, y: height / 2 };
  }

  private createCamera() {
    const camera = this.cameras.main;

    this.applyCameraBounds();
    camera.startFollow(this.player.getSprite(), true, 0.09, 0.09, 0, 0);
    camera.setLerp(0.1, 0.1);
    camera.setRoundPixels(false);
    camera.setDeadzone(this.isVertical() ? 150 : 0, this.isVertical() ? 0 : 150);
    camera.setBackgroundColor(this.cameraBackgroundColor);
  }

  /** A world narrower than the screen is centred instead of being pinned to the left edge. */
  private applyCameraBounds() {
    const { width, height } = this.worldSize();
    const slack = Math.max(this.scale.width - width, 0);

    this.cameras.main.setBounds(-slack / 2, 0, width + slack, height);
  }

  /**
   * The chase zoom scales everything the main camera draws, so the interface gets its own
   * camera. World objects are kept out of it as they appear, including the ones spawned later.
   */
  private createUiCamera() {
    this.uiObjects = [
      ...this.hud.getElements(),
      this.cameraDirector.getOverlay(),
    ];

    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');

    this.cameras.main.ignore(this.uiObjects);
    this.uiCamera.ignore(this.children.list.filter(child => !this.uiObjects.includes(child)));

    this.onSceneEvent(Phaser.Scenes.Events.ADDED_TO_SCENE, (object: Phaser.GameObjects.GameObject) => {
      if (!this.uiObjects.includes(object)) {
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
    this.onSceneEvent(Phaser.Scenes.Events.POST_UPDATE, () => this.resolveTerrain());

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
    this.onSceneEvent('mollusk-collected', (x: number, y: number) => this.levelManager.sparkle(x, y));
    this.onSceneEvent('player-died', () => this.handlePlayerDied());
    this.onSceneEvent('player-win', () => this.completeLevel());

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
    this.applyCameraBounds();

    this.layoutGround();
    this.layoutRocks();
    this.levelManager.resize();
    this.hud.layout();
    this.cameraDirector.layout();
    this.uiCamera.setSize(this.scale.width, this.scale.height);
    this.onLayout();
  }

  /** Called after a resize once the shared layout is done. */
  protected onLayout() {}

  /** Currents carry the fish at a fixed water speed, whatever it is doing itself. */
  private applyCurrent(delta: number) {
    const zones = this.levelConfig.currentZones;

    if (!zones?.length || !this.currentsEnabled) return;

    const sprite = this.player.getSprite();
    const zone = zones.find(entry => sprite.y >= entry.y && sprite.y < entry.y + entry.height);

    if (!zone) return;

    const seconds = delta / 1000;

    sprite.x += (zone.forceX ?? 0) * seconds;
    sprite.y += (zone.forceY ?? 0) * seconds;
  }

  private lerpColor(from: number, to: number, t: number) {
    const a = Phaser.Display.Color.IntegerToColor(from);
    const b = Phaser.Display.Color.IntegerToColor(to);
    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, t * 100);

    return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
  }

  private updateUI() {
    const label = this.goalLabel();

    if (label !== undefined) {
      this.hud.setGoalLabel(label);
    } else {
      this.hud.setMollusks(this.gameManager.getScore(), this.gameManager.getMolluskTotal());
    }

    this.hud.setHealth(this.player.getHealth());
    this.hud.setLight(this.player.getLightRatio());
    this.hud.setTime(this.gameManager.getElapsed());
  }
}
