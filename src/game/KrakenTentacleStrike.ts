import Phaser from 'phaser';
import { config } from '../config';
import { EnemyKraken } from './enemies/Kraken';
import { KrakenArm } from './KrakenArm';
import { Player } from './Player';

export type TentacleSide = 'top' | 'bottom';

type Phase = 'warn' | 'strike' | 'hold' | 'retract' | 'done';

const settings = config.tentacle.strike;
const WARNING_SAMPLES = 14;
const HIT_SAMPLES = 10;

/**
 * One lash of a kraken arm. The aim is fixed the moment the warning appears: the arm sweeps
 * through that spot and slams into the floor or the ceiling beyond it, so leaving the marked
 * path in time is always enough.
 */
export class KrakenTentacleStrike {
  private readonly scene: Phaser.Scene;
  private readonly side: TentacleSide;
  private readonly player: Player;
  private readonly kraken: EnemyKraken;
  private readonly onComplete: () => void;
  private readonly arm: KrakenArm;
  private readonly warning: Phaser.GameObjects.Graphics;
  private readonly hint?: Phaser.GameObjects.Text;
  private readonly aim = new Phaser.Math.Vector2();
  private readonly end = new Phaser.Math.Vector2();
  private readonly anchor = new Phaser.Math.Vector2();
  private readonly control = new Phaser.Math.Vector2();
  private readonly point = new Phaser.Math.Vector2();
  private phase: Phase = 'warn';
  private phaseTime = 0;
  private reach = 0;
  private hit = false;

  constructor(
    scene: Phaser.Scene,
    side: TentacleSide,
    worldHeight: number,
    player: Player,
    kraken: EnemyKraken,
    showHint: boolean,
    onComplete: () => void,
  ) {
    this.scene = scene;
    this.side = side;
    this.player = player;
    this.kraken = kraken;
    this.onComplete = onComplete;

    const sprite = player.getSprite();
    const velocity = (sprite.body as Phaser.Physics.Arcade.Body).velocity;
    const lead = settings.leadMs / 1000;

    this.aim.set(
      sprite.x + velocity.x * lead,
      Phaser.Math.Clamp(sprite.y + velocity.y * lead, settings.wallMargin, worldHeight - settings.wallMargin)
    );
    this.end.set(
      this.aim.x + settings.overshootX,
      side === 'bottom' ? worldHeight - settings.wallMargin : settings.wallMargin
    );

    this.arm = new KrakenArm(scene, settings.width, config.render.krakenArm);
    this.arm.setVisible(false);
    this.arm.setFlipY(side === 'top');

    this.warning = scene.add.graphics().setDepth(config.render.tentacle - 0.5);

    if (showHint) {
      this.hint = this.createHint();
    }

    scene.tweens.add({
      targets: [this.warning, this.hint].filter(Boolean),
      alpha: { from: 0.45, to: 1 },
      duration: 130,
      yoyo: true,
      repeat: -1,
    });
  }

  update(delta: number) {
    if (this.phase === 'done') return;

    this.phaseTime += delta;
    this.updateCurve();

    switch (this.phase) {
      case 'warn':
        this.drawWarning();

        if (this.phaseTime >= settings.warningMs) this.beginStrike();
        break;
      case 'strike':
        this.reach = Phaser.Math.Easing.Quadratic.In(Math.min(this.phaseTime / settings.strikeMs, 1));

        if (this.phaseTime >= settings.strikeMs) this.enter('hold');
        break;
      case 'hold':
        if (this.phaseTime >= settings.holdMs) this.enter('retract');
        break;
      case 'retract':
        this.reach = 1 - Phaser.Math.Easing.Quadratic.In(Math.min(this.phaseTime / settings.retractMs, 1));
        this.arm.setAlpha(Math.min(this.reach * 3, 1));

        if (this.phaseTime >= settings.retractMs) {
          this.finish();
          return;
        }
        break;
    }

    if (this.phase === 'warn') return;

    this.shapeArm();

    if (!this.hit && this.phase !== 'retract' && this.touchesPlayer()) {
      this.onPlayerHit();
    }
  }

  destroy() {
    this.phase = 'done';
    this.scene.tweens.killTweensOf([this.warning, this.hint].filter(Boolean));
    this.warning.destroy();
    this.hint?.destroy();
    this.arm.destroy();
  }

  private enter(phase: Phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }

  private beginStrike() {
    this.scene.tweens.killTweensOf([this.warning, this.hint].filter(Boolean));
    this.warning.setVisible(false);
    this.hint?.setVisible(false);
    this.arm.setVisible(true);
    this.reach = 0;
    this.enter('strike');
  }

  /** The body keeps moving, so the control point is refitted to pass through the aim every frame. */
  private updateCurve() {
    const t = settings.passAt;
    const weight = 2 * t * (1 - t);

    this.kraken.getStrikeAnchor(this.side, this.anchor);
    this.control.set(
      (this.aim.x - (1 - t) * (1 - t) * this.anchor.x - t * t * this.end.x) / weight,
      (this.aim.y - (1 - t) * (1 - t) * this.anchor.y - t * t * this.end.y) / weight
    );
  }

  private curveAt(t: number, out: Phaser.Math.Vector2) {
    const inverse = 1 - t;

    return out.set(
      inverse * inverse * this.anchor.x + 2 * inverse * t * this.control.x + t * t * this.end.x,
      inverse * inverse * this.anchor.y + 2 * inverse * t * this.control.y + t * t * this.end.y
    );
  }

  private shapeArm() {
    const wobble = this.phase === 'hold'
      ? Math.sin((this.phaseTime / settings.wobbleMs) * Math.PI * 2) * settings.wobble
      : 0;

    this.arm.shape((t, out) => {
      this.curveAt(t * this.reach, out);
      out.y += wobble * Math.sin(t * Math.PI);
    });
  }

  private drawWarning() {
    const { warningColor, warningWidth, warningAlpha, markerRadius } = settings;

    this.warning.clear();
    this.warning.lineStyle(warningWidth, warningColor, warningAlpha);
    this.warning.beginPath();

    for (let i = 0; i <= WARNING_SAMPLES; i++) {
      const { x, y } = this.curveAt(i / WARNING_SAMPLES, this.point);

      if (i === 0) {
        this.warning.moveTo(x, y);
      } else {
        this.warning.lineTo(x, y);
      }
    }

    this.warning.strokePath();

    const closing = 1 - Math.min(this.phaseTime / settings.warningMs, 1);

    this.warning.lineStyle(4, warningColor, 0.9);
    this.warning.strokeCircle(this.aim.x, this.aim.y, markerRadius * (1 + closing));
    this.warning.fillStyle(warningColor, 0.25);
    this.warning.fillCircle(this.aim.x, this.aim.y, markerRadius);
  }

  private createHint() {
    const above = this.side === 'bottom';

    return this.scene.add.text(
      this.aim.x,
      this.aim.y + (above ? -1 : 1) * (settings.markerRadius * 2 + 16),
      above ? '↑ Swim up' : '↓ Swim down',
      {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#ffd9c2',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      },
    )
      .setOrigin(0.5)
      .setDepth(config.render.tentacle);
  }

  private touchesPlayer() {
    const sprite = this.player.getSprite();

    for (let i = 1; i <= HIT_SAMPLES; i++) {
      const { x, y } = this.curveAt((i / HIT_SAMPLES) * this.reach, this.point);

      if (Phaser.Math.Distance.Between(x, y, sprite.x, sprite.y) < settings.hitRadius) return true;
    }

    return false;
  }

  private onPlayerHit() {
    if (!this.player.isAlive()) return;

    this.hit = true;
    this.scene.sound.play('eat', { volume: 0.35 });
    this.player.takeDamage(1);
    this.player.stun(config.rock.hitStunDuration);
    this.kraken.applyCatchUp();
    this.scene.cameras.main.shake(settings.shakeMs, settings.shakeIntensity);
  }

  private finish() {
    this.destroy();
    this.onComplete();
  }
}
