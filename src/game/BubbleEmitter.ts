import Phaser from 'phaser';

export class BubbleEmitter {
  private bubbles: Phaser.GameObjects.Group;
  private bubbleTimer: Phaser.Time.TimerEvent;

  constructor(private scene: Phaser.Scene, private sprite: Phaser.Physics.Arcade.Sprite) {
    this.bubbles = this.scene.add.group();
    this.bubbleTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(5000, 10000),
      loop: true,
      callback: () => this.emitBubbles()
    });
  }

  private emitBubbles() {
    if (!this.sprite.active) return;

    const count = Phaser.Math.Between(1, 5);
    for (let i = 0; i < count; i++) {
      this.spawnBubble();
    }
    this.bubbleTimer.delay = Phaser.Math.Between(5000, 10000);
  }

  private spawnBubble() {
    const offsetX = this.sprite.flipX ? -this.sprite.width * 0.4 : this.sprite.width * 0.4;
    const bubbleX = this.sprite.x + offsetX + Phaser.Math.Between(-3, 3);
    const bubbleY = this.sprite.y + Phaser.Math.Between(-3, 3);
    const size = Phaser.Math.Between(4, 10);

    const bubble = this.scene.add.ellipse(
      bubbleX,
      bubbleY,
      size,
      size,
      0xadd8e6,
      0.6
    );

    this.bubbles.add(bubble);

    this.scene.tweens.add({
      targets: bubble,
      x: bubbleX + Phaser.Math.Between(-10, 10),
      y: bubbleY - Phaser.Math.Between(200, 600),
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: Phaser.Math.Between(3000, 6000),
      ease: 'Sine.easeOut',
      onComplete: () => bubble.destroy()
    });
  }

  emitBurst(count: number = null) {
    const cnt = count || Phaser.Math.Between(3, 8);
    for (let i = 0; i < cnt; i++) {
      this.spawnBubble();
    }
  }

  stop() {
    this.bubbleTimer?.remove(false);
  }
}
