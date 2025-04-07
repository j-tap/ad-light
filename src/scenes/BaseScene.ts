import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import { GameManager } from '../game/GameManager';

export default class BaseScene extends Phaser.Scene {
  private readonly scenesWithoutFade = ['BootScene', 'PreloadScene'];
  protected gameManager!: GameManager;
  protected rexUI!: UIPlugin;
  protected fadeDuration = 300;

  constructor(key: string) {
    super(key);
  }

  create() {
    this.gameManager = new GameManager(this);

    if (!this.scenesWithoutFade.includes(this.scene.key)) {
      this.fadeIn();
    }
  }

  get centerX() {
    return this.scale.width / 2;
  }

  get centerY() {
    return this.scale.height / 2;
  }

  fullscreenToggle() {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    } else {
      this.scale.startFullscreen();
    }
  }

  fadeToScene(targetScene: string, params: Record<any, any> = {}, callback?: () => void) {
    this.cameras.main.resetFX();
    this.cameras.main.fadeOut(this.fadeDuration, 10, 17, 25);

    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (callback) callback();
      this.scene.start(targetScene, params);
    });
  }

  protected fadeIn() {
    this.cameras.main.fadeIn(this.fadeDuration, 10, 17, 25);
  }
}
