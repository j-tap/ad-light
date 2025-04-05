import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';

export default class BaseScene extends Phaser.Scene {
  rexUI!: UIPlugin;

  constructor(key: string) {
    super(key);
  }

  get centerX() {
    return this.scale.width / 2;
  }

  get centerY() {
    return this.scale.height / 2;
  }

  // Можешь сразу добавить базовые функции
  fullscreenToggle() {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    } else {
      this.scale.startFullscreen();
    }
  }
}
