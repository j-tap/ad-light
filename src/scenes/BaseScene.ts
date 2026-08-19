import Phaser from 'phaser';

type EventHandler = (...args: any[]) => void;

export default class BaseScene extends Phaser.Scene {
  private static readonly scenesWithoutFade = ['BootScene', 'PreloadScene'];
  protected fadeDuration = 300;
  private teardownTasks: Array<() => void> = [];
  private isTransitioning = false;

  create() {
    this.isTransitioning = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);

    this.input.keyboard?.on('keydown-F', this.fullscreenToggle, this);

    if (!BaseScene.scenesWithoutFade.includes(this.scene.key)) {
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

  fadeToScene(targetScene: string, params: Record<string, any> = {}, callback?: () => void) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    this.cameras.main.resetFX();
    this.cameras.main.fadeOut(this.fadeDuration, 10, 17, 25);

    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      callback?.();
      this.scene.start(targetScene, params);
    });
  }

  protected fadeIn() {
    this.cameras.main.fadeIn(this.fadeDuration, 10, 17, 25);
  }

  /** Scene-scoped listener that is detached on shutdown to survive scene restarts. */
  protected onSceneEvent(event: string, handler: EventHandler) {
    this.events.on(event, handler, this);
    this.teardownTasks.push(() => this.events.off(event, handler, this));
  }

  /** ScaleManager lives longer than a scene, so its listeners must be detached manually. */
  protected onResize(handler: (size: Phaser.Structs.Size) => void) {
    this.scale.on(Phaser.Scale.Events.RESIZE, handler, this);
    this.teardownTasks.push(() => this.scale.off(Phaser.Scale.Events.RESIZE, handler, this));
  }

  private teardown() {
    this.teardownTasks.forEach(task => task());
    this.teardownTasks = [];
  }
}
