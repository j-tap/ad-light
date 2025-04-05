import Phaser from 'phaser';

export class Player {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(time: number, delta: number) {
    // move player or handle input
    // console.log(`Player update: time=${time}, delta=${delta}`);
  }
}
