import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Mollusk } from './Mollusk';
import { Player } from './Player';

interface StartGameConfig {
  enemyCount: number,
  molluskCount: number,
}

export enum GameState {
  Start,
  Playing,
  Paused,
  Win,
  Lose
}

export class GameManager {
  private readonly scene: Phaser.Scene;
  private readonly enemiesGroup!: Phaser.Physics.Arcade.Group;
  private readonly mollusksGroup!: Phaser.Physics.Arcade.Group;
  private state: GameState = GameState.Start;
  private enemies: Enemy[] = [];
  private mollusks: Mollusk[] = [];
  private score = 0;
  private player!: Player;
  private lastLevel: string;
  public molluskCount = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.enemiesGroup = this.createPhysicsGroup();
    this.mollusksGroup = this.createPhysicsGroup();

    this.scene.physics.add.collider(this.enemiesGroup, this.enemiesGroup);
  }

  getMolluskCount(): number {
    return this.molluskCount;
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

  startGame(config: StartGameConfig) {
    this.molluskCount = config.molluskCount
    this.score = 0;
    this.state = GameState.Playing;
    this.player.setInvulnerable(false);

    this.spawnEnemies(config.enemyCount);
    this.spawnMollusks(config.molluskCount);
  }

  pauseGame() {
    this.state = GameState.Paused;
    this.scene.scene.launch('PauseScene', { target: this.scene.scene.key });
    this.scene.scene.bringToTop('PauseScene');
    this.scene.time.delayedCall(0, () => {
      this.scene.scene.pause();
    });
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

  update(time: number, delta: number) {
    if (!this.isPlaying()) return;

    this.enemies.forEach(enemy => enemy.update(this.player.getSprite().x, this.player.getSprite().y, this.player.isAlive()));
    this.checkWinLoseConditions();
  }

  isPlaying(): boolean {
    return this.state === GameState.Playing;
  }

  isPaused(): boolean {
    return this.state === GameState.Paused;
  }

  checkWinLoseConditions() {
    if (this.isPlaying() && this.mollusks.length === 0) {
      this.winGame();
    }
  }

  getEnemiesGroup(): Phaser.Physics.Arcade.Group {
    return this.enemiesGroup;
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  setupCollisions(player: Player) {
    this.enemies.forEach(enemy => {
      this.scene.physics.add.overlap(player.getSprite(), enemy.getMouthCollider(), () => {
        this.handlePlayerDeath();
        enemy.onPlayerHit();
      });
    });

    this.scene.physics.add.overlap(player.getSprite(), this.mollusksGroup, this.collectMollusk, undefined, this);
  }

  setCurrentLevel(levelKey: string) {
    this.lastLevel = levelKey;
  }

  getLastLevel() {
    return this.lastLevel;
  }

  private handlePlayerDeath() {
    const player = (this.scene as any).player;

    if (!player || !player.isAlive()) return;

    if (typeof player.canInvulnerable === 'function' && player.canInvulnerable()) {
      return;
    }

    const eatSound = this.scene.sound.add('eat', { volume: 0.5 });
    eatSound.play();

    player.takeDamage(1);
  }

  private spawnEnemies(enemyCount: number) {
    const { width, height } = this.scene.physics.world.bounds;
    const playerSprite = this.player.getSprite();
    const playerX = playerSprite.x;
    const playerY = playerSprite.y;
    const minDistance = 300;

    for (let i = 0; i < enemyCount; i++) {
      let x: number, y: number, tries = 0;

      do {
        x = Phaser.Math.Between(0, width);
        y = Phaser.Math.Between(50, height - 100);
        tries++;
      } while (Phaser.Math.Distance.Between(x, y, playerX, playerY) < minDistance && tries < 20);

      const enemy = new Enemy(this.scene, x, y);
      this.enemies.push(enemy);
      this.enemiesGroup.add(enemy.getSprite());
    }
  }

  private spawnMollusks(molluskCount: number) {
    const bounds = this.scene.physics.world.bounds;

    for (let i = 0; i < molluskCount; i++) {
      const x = Phaser.Math.Between(bounds.left + 100, bounds.right - 100);
      const y = Phaser.Math.Between(bounds.height - 70, bounds.height - 45);

      const mollusk = new Mollusk(this.scene, x, y);
      this.mollusks.push(mollusk);
      this.mollusksGroup.add(mollusk.getSprite());
    }
  }

  private collectMollusk(
    playerBody: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    molluskBody: Phaser.Types.Physics.Arcade.GameObjectWithBody
  ) {
    const player = (this.scene as any).player;

    if (!player.isAlive()) return

    const molluskSprite = molluskBody as Phaser.GameObjects.Sprite;
    const mollusk = this.mollusks.find(o => o.getSprite() === molluskSprite);

    const collectSound = this.scene.sound.add('drip', { volume: 0.2 });
    collectSound.play();

    this.mollusks = this.mollusks.filter(o => o !== mollusk);

    mollusk.destroy();
    this.addScore(1);
  }
}
