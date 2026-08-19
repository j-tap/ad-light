import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Mollusk } from './Mollusk';
import { Player } from './Player';
import type { MolluskConfig, EnemiesConfig, LevelConfig } from '../config';

export enum GameState {
  Start,
  Playing,
  Paused,
  Win,
  Lose
}

const SPAWN_MIN_DISTANCE_TO_PLAYER = 300;
const SPAWN_MAX_TRIES = 20;

export class GameManager {
  private readonly scene: Phaser.Scene;
  private readonly enemiesGroup: Phaser.Physics.Arcade.Group;
  private readonly mollusksGroup: Phaser.Physics.Arcade.Group;
  private readonly mouthsGroup: Phaser.Physics.Arcade.Group;
  private readonly enemyByObject = new WeakMap<Phaser.GameObjects.GameObject, Enemy>();
  private readonly molluskBySprite = new WeakMap<Phaser.GameObjects.GameObject, Mollusk>();
  private state: GameState = GameState.Start;
  private enemies: Enemy[] = [];
  private mollusks: Mollusk[] = [];
  private score = 0;
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

  setPlayer(player: Player) {
    this.player = player;
  }

  startGame(config: LevelConfig) {
    this.score = 0;
    this.player.setInvulnerable(false);

    this.spawnEnemies(config.enemies);
    this.spawnMollusks(config.mollusks);

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

  update() {
    if (!this.isPlaying()) return;

    const playerSprite = this.player.getSprite();
    const isPlayerAlive = this.player.isAlive();

    this.enemies.forEach(enemy => enemy.update(playerSprite.x, playerSprite.y, isPlayerAlive));

    if (this.mollusks.length === 0) {
      this.winGame();
    }
  }

  setupCollisions(player: Player) {
    const playerSprite = player.getSprite();

    this.scene.physics.add.overlap(playerSprite, this.mouthsGroup, (_player, mouth) => {
      this.damagePlayer();
      this.enemyByObject.get(mouth as Phaser.GameObjects.GameObject)?.onPlayerHit();
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

  private spawnEnemies(enemies: EnemiesConfig) {
    const { width, height } = this.scene.physics.world.bounds;
    const { x: playerX, y: playerY } = this.player.getSprite();

    for (let i = 0; i < enemies.count; i++) {
      let x: number;
      let y: number;
      let tries = 0;

      do {
        x = Phaser.Math.Between(0, width);
        y = Phaser.Math.Between(50, height - 100);
        tries++;
      } while (
        Phaser.Math.Distance.Between(x, y, playerX, playerY) < SPAWN_MIN_DISTANCE_TO_PLAYER &&
        tries < SPAWN_MAX_TRIES
      );

      const enemy = new Enemy(this.scene, x, y);
      const sprite = enemy.getSprite();
      const mouth = enemy.getMouthCollider();

      this.enemies.push(enemy);
      this.enemiesGroup.add(sprite);
      this.mouthsGroup.add(mouth);
      this.enemyByObject.set(sprite, enemy);
      this.enemyByObject.set(mouth, enemy);
    }
  }

  private spawnMollusks(mollusks: MolluskConfig) {
    const bounds = this.scene.physics.world.bounds;
    const indents = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      ...mollusks.indent,
    };

    for (let i = 0; i < mollusks.count; i++) {
      const x = Phaser.Math.Between(
        bounds.left + 100 + indents.left,
        bounds.right - 100 - indents.right,
      );
      const y = Phaser.Math.Between(
        bounds.top + 100 + indents.top,
        bounds.height - 50 - indents.bottom,
      );

      const mollusk = new Mollusk(this.scene, x, y);
      const sprite = mollusk.getSprite();

      this.mollusks.push(mollusk);
      this.mollusksGroup.add(sprite);
      this.molluskBySprite.set(sprite, mollusk);
    }
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
    this.addScore(1);
  }
}
