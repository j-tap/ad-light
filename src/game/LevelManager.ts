import Phaser from 'phaser';

export class LevelManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(time: number, delta: number) {
    // Update level logic here
    // console.log(`LevelManager update: time=${time}, delta=${delta}`);
  }
}
