import Phaser from 'phaser';
import { config, Point, TAU, TunnelSide } from '../config';
import { EnemyKraken } from './enemies/Kraken';
import { KrakenArm } from './KrakenArm';
import { Player } from './Player';

export interface StrikePlan {
  side: TunnelSide,
  /** The spot the arm sweeps through. */
  aim: Point,
  worldHeight: number,
  /** Spells out which way to dodge. */
  showHint: boolean,
}

export interface StrikeOutcome {
  /** Fired the moment the arm connects. */
  onHit: () => void,
  /** Fired once the arm is gone, with whether it connected. */
  onDone: (hit: boolean) => void,
}

type Phase = 'warn' | 'strike' | 'hold' | 'retract' | 'done';

const settings = config.tentacle.strike;

/**
 * One lash of a kraken arm. The aim is fixed the moment the warning appears: the arm sweeps
 * through that spot and slams into the floor or the ceiling beyond it, so changing lane away
 * from that side is always enough to get clear. What a hit or a dodge means for the chase is
 * up to whoever launched the strike.
 */
export class KrakenTentacleStrike {
  private readonly scene: Phaser.Scene;
  private readonly plan: StrikePlan;
  private readonly player: Player;
  private readonly kraken: EnemyKraken;
  private readonly outcome: StrikeOutcome;
  private readonly arm: KrakenArm;
  private readonly warning: Phaser.GameObjects.Graphics;
  private readonly markers: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text>;
  private readonly root = new Phaser.Math.Vector2();
  private readonly control = new Phaser.Math.Vector2();
  private readonly end = new Phaser.Math.Vector2();
  private readonly curve = new Phaser.Curves.QuadraticBezier(this.root, this.control, this.end);
  private readonly point = new Phaser.Math.Vector2();
  private phase: Phase = 'warn';
  private phaseTime = 0;
  private reach = 0;
  private hit = false;

  constructor(scene: Phaser.Scene, plan: StrikePlan, player: Player, kraken: EnemyKraken, outcome: StrikeOutcome) {
    const { warning } = settings;

    this.scene = scene;
    this.plan = plan;
    this.player = player;
    this.kraken = kraken;
    this.outcome = outcome;

    this.end.set(
      plan.aim.x + settings.overshootX,
      plan.side === 'bottom' ? plan.worldHeight - settings.wallMargin : settings.wallMargin
    );

    this.arm = new KrakenArm(scene, settings.width, config.render.krakenArm);
    this.arm.setVisible(false);
    this.arm.setFlipY(plan.side === 'top');

    this.warning = scene.add.graphics().setDepth(config.render.tentacle);
    this.markers = plan.showHint ? [this.warning, this.createHint()] : [this.warning];

    scene.tweens.add({
      targets: this.markers,
      alpha: { from: warning.pulseFrom, to: 1 },
      duration: warning.pulseMs,
      yoyo: true,
      repeat: -1,
    });
  }

  update(delta: number) {
    if (this.phase === 'done') return;

    this.phaseTime += delta;
    this.fitCurve();

    switch (this.phase) {
      case 'warn':
        this.drawWarning();

        if (this.phaseTime >= settings.warningMs) this.beginStrike();
        return;
      case 'strike':
        this.reach = Phaser.Math.Easing.Quadratic.In(this.progress(settings.strikeMs));

        if (this.phaseTime >= settings.strikeMs) this.enter('hold');
        break;
      case 'hold':
        if (this.phaseTime >= settings.holdMs) this.enter('retract');
        break;
      case 'retract':
        this.reach = 1 - Phaser.Math.Easing.Quadratic.In(this.progress(settings.retractMs));
        this.arm.setAlpha(Math.min(this.reach * 3, 1));

        if (this.phaseTime >= settings.retractMs) {
          this.destroy();
          this.outcome.onDone(this.hit);
          return;
        }
        break;
    }

    this.shapeArm();

    if (!this.hit && this.phase !== 'retract' && this.touchesPlayer()) {
      this.strikePlayer();
    }
  }

  destroy() {
    this.phase = 'done';
    this.scene.tweens.killTweensOf(this.markers);
    this.markers.forEach(marker => marker.destroy());
    this.arm.destroy();
  }

  private enter(phase: Phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }

  private progress(durationMs: number) {
    return Math.min(this.phaseTime / durationMs, 1);
  }

  private beginStrike() {
    this.scene.tweens.killTweensOf(this.markers);
    this.markers.forEach(marker => marker.setVisible(false));
    this.arm.setVisible(true);
    this.enter('strike');
  }

  /** The body keeps moving, so the control point is refitted to pass through the aim every frame. */
  private fitCurve() {
    const { aim } = this.plan;
    const t = settings.passAt;
    const weight = 2 * t * (1 - t);

    this.kraken.getStrikeRoot(this.plan.side, this.root);
    this.control.set(
      (aim.x - (1 - t) * (1 - t) * this.root.x - t * t * this.end.x) / weight,
      (aim.y - (1 - t) * (1 - t) * this.root.y - t * t * this.end.y) / weight
    );
  }

  private shapeArm() {
    const wobble = this.phase === 'hold'
      ? Math.sin((this.phaseTime / settings.wobbleMs) * TAU) * settings.wobble
      : 0;

    this.arm.shape((t, out) => {
      this.curve.getPoint(t * this.reach, out);
      out.y += wobble * Math.sin(t * Math.PI);
    });
  }

  private drawWarning() {
    const { color, width, alpha, samples, markerRadius, ringWidth, ringAlpha, fillAlpha } = settings.warning;
    const { aim } = this.plan;
    const closing = 1 - this.progress(settings.warningMs);

    this.warning.clear();
    this.warning.lineStyle(width, color, alpha);
    this.warning.beginPath();

    for (let i = 0; i <= samples; i++) {
      const { x, y } = this.curve.getPoint(i / samples, this.point);

      if (i === 0) {
        this.warning.moveTo(x, y);
      } else {
        this.warning.lineTo(x, y);
      }
    }

    this.warning.strokePath();
    this.warning.lineStyle(ringWidth, color, ringAlpha);
    this.warning.strokeCircle(aim.x, aim.y, markerRadius * (1 + closing));
    this.warning.fillStyle(color, fillAlpha);
    this.warning.fillCircle(aim.x, aim.y, markerRadius);
  }

  private createHint() {
    const { hint, warning } = settings;
    const { aim, side } = this.plan;
    const above = side === 'bottom';

    return this.scene.add.text(
      aim.x,
      aim.y + (above ? -1 : 1) * (warning.markerRadius * 2 + hint.gap),
      above ? hint.up : hint.down,
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

    for (let i = 1; i <= settings.hitSamples; i++) {
      const { x, y } = this.curve.getPoint((i / settings.hitSamples) * this.reach, this.point);

      if (Phaser.Math.Distance.Between(x, y, sprite.x, sprite.y) < settings.hitRadius) return true;
    }

    return false;
  }

  private strikePlayer() {
    if (!this.player.isAlive()) return;

    this.hit = true;
    this.scene.sound.play('eat', { volume: settings.hitVolume });
    this.player.takeDamage(1);
    this.player.stun(settings.stunMs);
    this.scene.cameras.main.shake(settings.shakeMs, settings.shakeIntensity);
    this.outcome.onHit();
  }
}
