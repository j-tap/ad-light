import Phaser from 'phaser';
import { BaseEnemy } from './enemies/BaseEnemy';
import { AnglerFish } from './enemies/AnglerFish';
import { SwallowtailFish } from './enemies/SwallowtailFish';
import { Jellyfish } from './enemies/Jellyfish';
import { Mollusk } from './Mollusk';
import { NoiseField } from './systems/NoiseField';
import { Player } from './Player';
import { config } from '../config';
import type { MolluskConfig, EnemyKind, EnemySpawnConfig, SpawnIndent, LevelConfig } from '../config';

export enum GameState {
  Start,
  Playing,
  Paused,
  Win,
  Lose
}

type EnemyConstructor = new (scene: Phaser.Scene, x: number, y: number) => BaseEnemy;

const enemyConstructors: Record<EnemyKind, EnemyConstructor> = {
  anglerFish: AnglerFish,
  swallowtail: SwallowtailFish,
  jellyfish: Jellyfish,
};

const SPAWN_MIN_DISTANCE_TO_PLAYER = 300;
const SPAWN_MAX_TRIES = 20;
const ENEMY_SPAWN_PADDING_TOP = 50;
const ENEMY_SPAWN_PADDING_BOTTOM = 100;

export class GameManager {
  private readonly scene: Phaser.Scene;
  private readonly enemiesGroup: Phaser.Physics.Arcade.Group;
  private readonly mollusksGroup: Phaser.Physics.Arcade.Group;
  private readonly mouthsGroup: Phaser.Physics.Arcade.Group;
  private readonly noiseField = new NoiseField();
  private readonly enemyByObject = new WeakMap<Phaser.GameObjects.GameObject, BaseEnemy>();
  private readonly molluskBySprite = new WeakMap<Phaser.GameObjects.GameObject, Mollusk>();
  private state: GameState = GameState.Start;
  private enemies: BaseEnemy[] = [];
  private mollusks: Mollusk[] = [];
  private score = 0;
  private threat = 0;
  private player!: Player;
  private lastLevel = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.enemiesGroup = this.createPhysicsGroup();
    this.mollusksGroup = this.createPhysicsGroup();
    // A group re-applies its defaults to every added body, so gravity/immovable must be declared here.
    this.mouthsGroup = this.scene.physics.add.group({ allowGravity: false, immovable: true });

    this.scene.physics.add.collider(this.enemiesGroup, this.enemiesGroup);
    this.scene.physics.world.on('worldbounds', this.handleWorldBounds, this);
  }

  getNoiseField() {
    return this.noiseField;
  }

  /** 0 when nothing hunts the player, 1 when a hunter is right on top of them. */
  getThreat() {
    return this.threat;
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  startGame(level: LevelConfig) {
    this.score = 0;
    this.noiseField.reset();
    this.player.setInvulnerable(false);

    this.spawnEnemies(level.enemies);
    this.spawnMollusks(level.mollusks);

    this.state = GameState.Playing;
  }

  pauseGame() {
    this.state = GameState.Paused;
    this.scene.scene.launch('PauseScene', { target: this.scene.scene.key });
    this.scene.scene.bringToTop('PauseScene');
    this.scene.time.delayedCall(0, () => this.scene.scene.pause());
  }

  resumeGame() {
    this.state = GameState.Playing;
    this.scene.scene.stop('PauseScene');
    this.scene.scene.resume(this.scene.scene.key);
  }

  winGame() {
    this.state = GameState.Win;
    this.player.setInvulnerable(true);
    this.scene.events.emit('player-win');
  }

  loseGame() {
    this.state = GameState.Lose;
  }

  addScore(amount: number) {
    this.score += amount;
  }

  getScore(): number {
    return this.score;
  }

  isPlaying(): boolean {
    return this.state === GameState.Playing;
  }

  update(delta: number) {
    if (!this.isPlaying()) return;

    const playerSprite = this.player.getSprite();

    this.noiseField.update(delta);

    const context = {
      playerX: playerSprite.x,
      playerY: playerSprite.y,
      isPlayerAlive: this.player.isAlive(),
      playerLightRadius: this.player.getLightRadius(),
      noise: this.noiseField,
    };

    this.enemies.forEach(enemy => enemy.update(delta, context));
    this.mollusks.forEach(mollusk => mollusk.update(delta, playerSprite.x, playerSprite.y));
    this.threat = this.measureThreat(playerSprite.x, playerSprite.y);

    if (this.mollusks.length === 0) {
      this.winGame();
    }
  }

  setupCollisions(player: Player) {
    const playerSprite = player.getSprite();

    this.scene.physics.add.overlap(playerSprite, this.mouthsGroup, (_player, mouth) => {
      const enemy = this.enemyByObject.get(mouth as Phaser.GameObjects.GameObject);

      if (!enemy?.canDamage()) return;

      this.damagePlayer();
      enemy.onPlayerHit();
    });

    this.scene.physics.add.overlap(playerSprite, this.mollusksGroup, this.collectMollusk, undefined, this);
  }

  setCurrentLevel(levelKey: string) {
    this.lastLevel = levelKey;
  }

  getLastLevel() {
    return this.lastLevel;
  }

  private createPhysicsGroup() {
    return this.scene.physics.add.group({
      allowGravity: false,
      collideWorldBounds: true,
      immovable: false,
      bounceX: 0.5,
      bounceY: 0.5
    });
  }

  private handleWorldBounds(body: Phaser.Physics.Arcade.Body) {
    this.enemyByObject.get(body.gameObject)?.bounceOffBounds(body);
  }

  private damagePlayer() {
    if (!this.player.isAlive() || this.player.canInvulnerable()) return;

    this.scene.sound.play('eat', { volume: 0.5 });
    this.player.takeDamage(1);
  }

  private spawnEnemies(spawns: EnemySpawnConfig[]) {
    spawns.forEach(spawn => {
      const EnemyClass = enemyConstructors[spawn.kind];

      for (let i = 0; i < spawn.count; i++) {
        const { x, y } = this.findEnemySpawnPoint(spawn.indent);
        const enemy = new EnemyClass(this.scene, x, y);
        const sprite = enemy.getSprite();
        const hitArea = enemy.getHitArea();

        this.enemies.push(enemy);
        this.enemiesGroup.add(sprite);
        this.enemyByObject.set(sprite, enemy);

        if (hitArea) {
          this.mouthsGroup.add(hitArea);
          this.enemyByObject.set(hitArea, enemy);
        }
      }
    });
  }

  private findEnemySpawnPoint(indent?: SpawnIndent) {
    const bounds = this.scene.physics.world.bounds;
    const { x: playerX, y: playerY } = this.player.getSprite();
    const left = bounds.left + (indent?.left ?? 0);
    const right = bounds.right - (indent?.right ?? 0);
    const top = bounds.top + ENEMY_SPAWN_PADDING_TOP + (indent?.top ?? 0);
    const bottom = bounds.bottom - ENEMY_SPAWN_PADDING_BOTTOM - (indent?.bottom ?? 0);

    let x = 0;
    let y = 0;
    let tries = 0;

    do {
      x = Phaser.Math.Between(left, right);
      y = Phaser.Math.Between(top, bottom);
      tries++;
    } while (
      Phaser.Math.Distance.Between(x, y, playerX, playerY) < SPAWN_MIN_DISTANCE_TO_PLAYER &&
      tries < SPAWN_MAX_TRIES
    );

    return { x, y };
  }

  /** Mollusks come in nests, so the player has to commit to a spot instead of grazing evenly. */
  private spawnMollusks(mollusks: MolluskConfig) {
    const { nest } = config.mollusk;
    const area = this.molluskArea(mollusks.indent);
    const centers: Phaser.Types.Math.Vector2Like[] = [];

    while (this.mollusks.length < mollusks.count) {
      const center = this.findNestCenter(area, centers);
      const size = Math.min(
        Phaser.Math.Between(nest.size.min, nest.size.max),
        mollusks.count - this.mollusks.length
      );

      centers.push(center);

      for (let i = 0; i < size; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * nest.radius;

        this.addMollusk(
          Phaser.Math.Clamp(center.x + Math.cos(angle) * distance, area.left, area.right),
          Phaser.Math.Clamp(center.y + Math.sin(angle) * distance, area.top, area.bottom)
        );
      }
    }
  }

  private molluskArea(indent?: SpawnIndent) {
    const bounds = this.scene.physics.world.bounds;
    const { padding } = config.mollusk.nest;

    return {
      left: bounds.left + padding + (indent?.left ?? 0),
      right: bounds.right - padding - (indent?.right ?? 0),
      top: bounds.top + padding + (indent?.top ?? 0),
      bottom: bounds.bottom - padding - (indent?.bottom ?? 0),
    };
  }

  private findNestCenter(
    area: { left: number, right: number, top: number, bottom: number },
    taken: Phaser.Types.Math.Vector2Like[]
  ) {
    const { spacing } = config.mollusk.nest;
    let best = { x: 0, y: 0 };
    let bestDistance = -1;

    for (let tries = 0; tries < SPAWN_MAX_TRIES; tries++) {
      const candidate = {
        x: Phaser.Math.Between(area.left, area.right),
        y: Phaser.Math.Between(area.top, area.bottom),
      };
      const distance = taken.reduce(
        (closest, point) => Math.min(closest, Phaser.Math.Distance.BetweenPoints(candidate, point)),
        Number.POSITIVE_INFINITY
      );

      if (distance >= spacing) return candidate;

      if (distance > bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }

    return best;
  }

  private measureThreat(playerX: number, playerY: number) {
    const { threatRadius } = config.camera;

    return this.enemies.reduce((threat, enemy) => {
      if (!enemy.isHunting()) return threat;

      const sprite = enemy.getSprite();
      const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, playerX, playerY);

      return Math.max(threat, 1 - Math.min(distance / threatRadius, 1));
    }, 0);
  }

  private addMollusk(x: number, y: number) {
    const mollusk = new Mollusk(this.scene, x, y);
    const sprite = mollusk.getSprite();

    this.mollusks.push(mollusk);
    this.mollusksGroup.add(sprite);
    this.molluskBySprite.set(sprite, mollusk);
  }

  private collectMollusk(
    _playerSprite: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    molluskSprite: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    if (!this.player.isAlive()) return;

    const mollusk = this.molluskBySprite.get(molluskSprite as Phaser.GameObjects.GameObject);

    if (!mollusk) return;

    this.molluskBySprite.delete(molluskSprite as Phaser.GameObjects.GameObject);
    this.mollusks.splice(this.mollusks.indexOf(mollusk), 1);
    mollusk.destroy();

    this.scene.sound.play('drip', { volume: 0.2 });
    this.player.refillLight(config.player.light.fuelPerMollusk);
    this.addScore(1);
  }
}
