import Phaser from 'phaser';
import { config } from '../../config';

const settings = config.camera;

/**
 * Turns the abstract threat level into camera language: the view creeps in while something
 * is hunting the player and snaps back once the danger is gone, so pressure is felt before
 * it is seen. Damage adds a short shake and a red wash on top.
 */
export class CameraDirector {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private threat = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.overlay = this.createOverlay();

    this.camera.setZoom(settings.zoomBase);
  }

  update(delta: number, threat: number) {
    const step = delta / (threat > this.threat ? settings.zoomInMs : settings.zoomOutMs);

    this.threat = Phaser.Math.Linear(this.threat, Phaser.Math.Clamp(threat, 0, 1), Math.min(step, 1));
    this.camera.setZoom(Phaser.Math.Linear(settings.zoomBase, settings.zoomChase, this.threat));
  }

  onDamage() {
    this.camera.shake(settings.shakeMs, settings.shakeIntensity);
    this.flash();
  }

  getOverlay() {
    return this.overlay;
  }

  layout() {
    this.overlay.setSize(this.scene.scale.width, this.scene.scale.height);
    this.overlay.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2);
  }

  reset() {
    this.threat = 0;
    this.camera.setZoom(settings.zoomBase);
    this.overlay.setAlpha(0);
  }

  private flash() {
    this.scene.tweens.killTweensOf(this.overlay);
    this.overlay.setAlpha(settings.damageAlpha);
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: settings.damageFadeMs,
      ease: 'Quad.easeOut',
    });
  }

  private createOverlay() {
    const { width, height } = this.scene.scale;

    return this.scene.add
      .rectangle(width / 2, height / 2, width, height, settings.damageColor)
      .setScrollFactor(0)
      .setDepth(settings.overlayDepth)
      .setAlpha(0);
  }
}
