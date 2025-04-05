import Phaser from 'phaser';

export enum GameState {
  Start,
  Playing,
  Paused,
  Win,
  Lose
}

export class GameManager {
  private scene: Phaser.Scene;
  private state: GameState = GameState.Start;
  private score: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  startGame() {
    this.score = 0;
    this.state = GameState.Playing;
    console.log('Game Started!');
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
    this.state = GameState.Lose;
    console.log('You Lose!');
    this.scene.scene.start('StartScene');
  }

  addScore(amount: number) {
    this.score += amount;
    console.log(`Score: ${this.score}`);
  }

  update(time: number, delta: number) {
    if (this.state === GameState.Playing) {
      this.checkWinLoseConditions();
    }
  }

  isPlaying(): boolean {
    return this.state === GameState.Playing;
  }

  isPaused(): boolean {
    return this.state === GameState.Paused;
  }

  checkWinLoseConditions() {
    // Check win/lose conditions here
  }
}
