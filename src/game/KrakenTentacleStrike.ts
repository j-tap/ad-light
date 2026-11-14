import Phaser from 'phaser';
import { config } from '../config';
import { EnemyKraken } from './enemies/Kraken';
import { Player } from './Player';

export type TentacleSide = 'top' | 'bottom';

interface TentacleLayout {
  anchorX: number,
  anchorY: number,
  targetX: number,
  targetY: number,
  length: number,
  rotation: number,
}

export class KrakenTentacleStrike {
  private readonly scene: Phaser.Scene;
  private readonly side: TentacleSide;
  private readonly worldHeight: number;
  private readonly player: Player;
  private readonly kraken: EnemyKraken;
  private readonly onComplete: () => void;
  private readonly targetOffsetX: number;
  private tentacle?: Phaser.GameObjects.Image;
  private warningPath?: Phaser.GameObjects.Graphics;
  private dodgeHint?: Phaser.GameObjects.Text;
  private wobbleTime = 0;
  private fullLength = 0;
  private hit = false;
  private phase: 'warn' | 'strike' | 'hold' | 'done' = 'warn';

  constructor(
    scene: Phaser.Scene,
    side: TentacleSide,
    worldHeight: number,
    player: Player,
    kraken: EnemyKraken,
    targetOffsetX: number,
    onComplete: () => void,
  ) {
    this.scene = scene;
    this.side = side;
    this.worldHeight = worldHeight;
    this.player = player;
    this.kraken = kraken;
    this.targetOffsetX = targetOffsetX;
    this.onComplete = onComplete;

    this.showWarning();
  }

  update(_time: number) {
    if (this.phase === 'done') return;

    const layout = this.computeLayout();

    if (this.phase === 'warn' && this.warningPath) {
      this.drawWarningPath(layout);
      return;
    }

    if (!this.tentacle) return;

    const length = this.tentacle.displayHeight;
    this.applyLayout(this.tentacle, layout, length);

    if (this.phase === 'hold') {
      this.wobbleTime += 16;
      this.tentacle.rotation = layout.rotation + Math.sin(this.wobbleTime * 0.018) * 0.045;

      if (!this.hit && this.overlapsPlayer()) {
        this.onPlayerHit();
      }
    }
  }

  destroy() {
    this.phase = 'done';
    this.warningPath?.destroy();
    this.dodgeHint?.destroy();
    this.tentacle?.destroy();
  }

  private computeLayout(): TentacleLayout {
    const anchor = this.kraken.getTentacleAnchor();
    const targetX = this.player.getSprite().x + this.targetOffsetX;
    const targetY = this.side === 'bottom' ? this.worldHeight - 24 : 24;
    const dx = targetX - anchor.x;
    const dy = targetY - anchor.y;
    const length = Math.hypot(dx, dy);

    return {
      anchorX: anchor.x,
      anchorY: anchor.y,
      targetX,
      targetY,
      length,
      rotation: Math.atan2(dy, dx) + Math.PI / 2,
    };
  }

  private showWarning() {
    const { warningMs } = config.tentacle;
    const layout = this.computeLayout();
    this.fullLength = layout.length;

    this.warningPath = this.scene.add.graphics()
      .setDepth(config.render.tentacle - 1);

    this.drawWarningPath(layout);

    this.dodgeHint = this.scene.add.text(
      layout.targetX,
      this.side === 'bottom' ? this.worldHeight - 46 : 46,
      this.side === 'bottom' ? '↑ Swim up' : '↓ Swim down',
      {
        fontSize: '15px',
        color: '#ddb890',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      },
    )
      .setOrigin(0.5)
      .setDepth(config.render.tentacle)
      .setAlpha(0.9);

    this.scene.tweens.add({
      targets: [this.warningPath, this.dodgeHint],
      alpha: { from: 0.35, to: 0.85 },
      duration: 140,
      yoyo: true,
      repeat: Math.ceil(warningMs / 280),
    });

    this.scene.time.delayedCall(warningMs, () => {
      this.warningPath?.destroy();
      this.warningPath = undefined;
      this.dodgeHint?.destroy();
      this.dodgeHint = undefined;
      this.phase = 'strike';
      this.strike();
    });
  }

  private drawWarningPath(layout: TentacleLayout) {
    if (!this.warningPath) return;

    this.warningPath.clear();
    this.warningPath.lineStyle(2, config.tentacle.warningColor, 0.45);
    this.warningPath.beginPath();
    this.warningPath.moveTo(layout.anchorX, layout.anchorY);
    this.warningPath.lineTo(layout.targetX, layout.targetY);
    this.warningPath.strokePath();

    this.warningPath.fillStyle(config.tentacle.warningColor, 0.28);
    this.warningPath.fillCircle(layout.targetX, layout.targetY, 12);
  }

  private strike() {
    const { texture, strikeMs, holdMs } = config.tentacle;
    const layout = this.computeLayout();
    this.fullLength = layout.length;

    this.tentacle = this.scene.add.image(
      layout.anchorX,
      layout.anchorY,
      texture,
    )
      .setOrigin(0.5, 1)
      .setDepth(config.render.tentacle)
      .setPipeline('Light2D');

    this.applyLayout(this.tentacle, layout, this.fullLength * 0.05);

    const growth = { length: this.fullLength * 0.05 };

    this.scene.tweens.add({
      targets: growth,
      length: this.fullLength,
      duration: strikeMs,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        if (!this.tentacle) return;
        this.applyLayout(this.tentacle, this.computeLayout(), growth.length);
      },
      onComplete: () => {
        if (!this.tentacle) return;

        this.phase = 'hold';
        this.applyLayout(this.tentacle, this.computeLayout(), this.fullLength);

        this.scene.time.delayedCall(holdMs, () => this.retract());
      },
    });
  }

  private applyLayout(
    tentacle: Phaser.GameObjects.Image,
    layout: TentacleLayout,
    length: number,
  ) {
    tentacle
      .setPosition(layout.anchorX, layout.anchorY)
      .setRotation(layout.rotation)
      .setDisplaySize(config.tentacle.width, Math.max(length, 20));
  }

  private overlapsPlayer() {
    if (!this.tentacle) return false;

    const bounds = this.tentacle.getBounds();
    const inset = 0.22;
    const hit = new Phaser.Geom.Rectangle(
      bounds.x + bounds.width * inset,
      bounds.y + bounds.height * inset,
      bounds.width * (1 - inset * 2),
      bounds.height * (1 - inset * 2),
    );

    return Phaser.Geom.Rectangle.Overlaps(hit, this.player.getSprite().getBounds());
  }

  private onPlayerHit() {
    if (this.hit || !this.player.isAlive()) return;

    this.hit = true;
    this.scene.sound.play('eat', { volume: 0.35 });
    this.player.takeDamage(1);
    this.player.stun(config.rock.hitStunDuration);
    this.kraken.applyCatchUp();
    this.scene.cameras.main.shake(220, 0.014);
  }

  private retract() {
    const { retractMs } = config.tentacle;

    if (!this.tentacle) {
      this.finish();
      return;
    }

    const tentacle = this.tentacle;
    const startLength = tentacle.displayHeight;
    const shrink = { progress: 0 };

    this.scene.tweens.add({
      targets: shrink,
      progress: 1,
      duration: retractMs,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        const length = startLength * (1 - shrink.progress * 0.96);
        this.applyLayout(tentacle, this.computeLayout(), length);
        tentacle.setAlpha(1 - shrink.progress);
      },
      onComplete: () => {
        tentacle.destroy();
        this.tentacle = undefined;
        this.finish();
      },
    });
  }

  private finish() {
    this.phase = 'done';
    this.onComplete();
  }
}
