import Phaser from 'phaser';
import { ensureBubbleTexture } from './textures';

export interface BubbleEmitterConfig {
  minDelay?: number,
  maxDelay?: number,
  minCount?: number,
  maxCount?: number,
}

export class BubbleEmitter {
  private readonly scene: Phaser.Scene;
  private readonly sprite?: Phaser.GameObjects.Sprite;
  private readonly minDelay: number;
  private readonly maxDelay: number;
  private readonly minCount: number;
  private readonly maxCount: number;
  private readonly texture: string;
  private readonly timer: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, sprite?: Phaser.GameObjects.Sprite, config: BubbleEmitterConfig = {}) {
    this.scene = scene;
    this.sprite = sprite;
    this.minDelay = config.minDelay ?? 3000;
    this.maxDelay = config.maxDelay ?? 5000;
    this.minCount = config.minCount ?? 1;
    this.maxCount = config.maxCount ?? 5;

    this.texture = ensureBubbleTexture(scene);

    this.timer = this.scene.time.addEvent({
      delay: this.nextDelay(),
      loop: true,
      callbackScope: this,
      callback: this.emitScheduled,
    });
  }

  emitBurst(count?: number) {
    const total = count ?? Phaser.Math.Between(this.minCount, this.maxCount);

    for (let i = 0; i < total; i++) {
      this.spawnBubble();
    }
  }

  stop() {
    this.timer.remove(false);
  }

  private emitScheduled() {
    this.emitBurst();

    this.timer.reset({
      delay: this.nextDelay(),
      loop: true,
      callbackScope: this,
      callback: this.emitScheduled,
    });
  }

  private nextDelay() {
    return Phaser.Math.Between(this.minDelay, this.maxDelay);
  }

  private spawnBubble() {
    const size = Phaser.Math.Between(4, 10);
    let bubbleX: number;
    let bubbleY: number;

    if (this.sprite) {
      const offsetX = this.sprite.flipX ? -this.sprite.width * 0.4 : this.sprite.width * 0.4;
      bubbleX = this.sprite.x + offsetX + Phaser.Math.Between(-3, 3);
      bubbleY = this.sprite.y + Phaser.Math.Between(-3, 3);
    } else {
      bubbleX = Phaser.Math.Between(0, this.scene.scale.width);
      bubbleY = this.scene.scale.height + Phaser.Math.Between(0, 100);
    }

    const bubble = this.scene.add.image(bubbleX, bubbleY, this.texture)
      .setDisplaySize(size, size)
      .setAlpha(0.6);

    this.scene.tweens.add({
      targets: bubble,
      x: bubbleX + Phaser.Math.Between(-10, 10),
      y: -size,
      alpha: 0,
      displayWidth: size * 0.5,
      displayHeight: size * 0.5,
      duration: Phaser.Math.Between(3000, 6000),
      ease: 'Sine.easeOut',
      onComplete: () => bubble.destroy()
    });
  }
}
