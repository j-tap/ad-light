import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Mollusk } from './Mollusk';
import { Player } from './Player';

export enum GameState {
  Start,
  Playing,
  Paused,
  Win,
  Lose
}

export class GameManager {
  private readonly scene: Phaser.Scene;
  private state: GameState = GameState.Start;
  private enemies: Enemy[] = [];
  private readonly enemiesGroup!: Phaser.Physics.Arcade.Group;
  private readonly mollusksGroup!: Phaser.Physics.Arcade.Group;
  private score = 0;
  private player!: Player;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.enemiesGroup = this.createPhysicsGroup();
    this.mollusksGroup = this.createPhysicsGroup();

    this.scene.physics.add.collider(this.enemiesGroup, this.enemiesGroup);
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

  startGame() {
    this.score = 0;
    this.state = GameState.Playing;
    console.log('Game Started!');

    (this.scene as any).playerDead = false;

    this.spawnEnemies();
    this.spawnMollusks();
  }

  pauseGame() {
    this.state = GameState.Paused;
    console.log('Game Paused!');
  }

  winGame() {
    this.state = GameState.Win;
    console.log('You Win!');
    this.scene.scene.start('EndScene');
  }

  loseGame() {
    if (this.state !== GameState.Playing) return;
    this.state = GameState.Lose;
    console.log('You Lose!');
    this.scene.scene.start('StartScene');
  }

  addScore(amount: number) {
    this.score += amount;
    console.log(`Score: ${this.score}`);
  }

  getScore(): number {
    return this.score;
  }

  update(time: number, delta: number) {
    if (!this.isPlaying()) return;

    this.enemies.forEach(enemy => enemy.update(this.player.getSprite().x, this.player.getSprite().y));
    this.checkWinLoseConditions();
  }

  isPlaying(): boolean {
    return this.state === GameState.Playing;
  }

  isPaused(): boolean {
    return this.state === GameState.Paused;
  }

  checkWinLoseConditions() {
    // Тут будет логика проверки победы/поражения
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
      });
    });

    this.scene.physics.add.overlap(player.getSprite(), this.mollusksGroup, this.collectMollusk, undefined, this);
  }

  private handlePlayerDeath() {
    const player = (this.scene as any).player;

    if (!player || (this.scene as any).playerDead || !player.isAlive()) return;

    if (typeof player.canInvulnerable === 'function' && player.canInvulnerable()) {
      return;
    }

    const eatSound = this.scene.sound.add('eat', { volume: 0.3 });
    eatSound.play();

    player.takeDamage(1);

    if (player.getHealth() <= 0) {
      (this.scene as any).playerDead = true;
      this.showDeathText();

      this.scene.time.delayedCall(3000, () => {
        this.loseGame();
      });
    }
  }

  private showDeathText() {
    const { width, height } = this.scene.scale;

    const text = this.scene.add.text(width / 2, height / 2, 'You Died', {
      fontSize: '48px',
      color: '#ff4444',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.scene.tweens.add({
      targets: text,
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Sine.easeInOut'
    });
  }

  private spawnEnemies() {
    const { width, height } = this.scene.physics.world.bounds;
    const playerSprite = this.player.getSprite();
    const playerX = playerSprite.x;
    const playerY = playerSprite.y;
    const enemyCount = Math.floor(width / 300);
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

  private spawnMollusks() {
    const bounds = this.scene.physics.world.bounds;

    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(bounds.left + 100, bounds.right - 100);
      const y = Phaser.Math.Between(bounds.height - 120, bounds.height - 60);

      const mollusk = new Mollusk(this.scene, x, y);

      this.mollusksGroup.add(mollusk.getSprite());
    }
  }

  private collectMollusk(playerSprite: Phaser.GameObjects.GameObject, molluskSprite: Phaser.GameObjects.GameObject) {
    const collectSound = this.scene.sound.add('drip', { volume: 0.2 });
    collectSound.play();

    molluskSprite.destroy();
    this.addScore(1);
  }
}
