import Phaser from 'phaser';
import { config } from '../config';
import { formatTime } from '../game/ProgressStore';

const DEPTH = 100;
const MARGIN = 20;
const HEART_SPACING = 40;
const HEART_ROW_Y = 70;
const LIGHT_BAR_Y = 118;
const LIGHT_BAR_WIDTH = 160;
const LIGHT_BAR_HEIGHT = 12;
const LIGHT_BAR_STEP = 0.01;
const LIGHT_COLOR_FULL = 0xcff1ff;
const LIGHT_COLOR_LOW = 0xff6a4a;
const HINT_BOTTOM_MARGIN = 70;
const TIMER_TOP = 24;

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly molluskText: Phaser.GameObjects.Text;
  private readonly hearts: Phaser.GameObjects.Text[] = [];
  private readonly lightFrame: Phaser.GameObjects.Rectangle;
  private readonly lightFill: Phaser.GameObjects.Rectangle;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly resultText: Phaser.GameObjects.Text;
  private lightBlinkTween?: Phaser.Tweens.Tween;
  private lastCollected = -1;
  private lastTotal = -1;
  private lastHealth = -1;
  private lastLightRatio = -1;
  private lastTimerLabel = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.molluskText = this.scene.add.text(0, 0, '', {
      fontSize: '24px',
      color: '#dcdcdc',
      fontFamily: 'Arial',
    });

    for (let i = 0; i < config.player.maxHealth; i++) {
      this.hearts.push(this.scene.add.text(0, 0, '❤️', { fontSize: '32px' }).setAlpha(0.6));
    }

    this.lightFrame = this.scene.add
      .rectangle(0, 0, LIGHT_BAR_WIDTH, LIGHT_BAR_HEIGHT)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x6d8a99);

    this.lightFill = this.scene.add
      .rectangle(0, 0, LIGHT_BAR_WIDTH, LIGHT_BAR_HEIGHT, LIGHT_COLOR_FULL)
      .setOrigin(0, 0.5);

    this.hintText = this.scene.add
      .text(0, 0, '', {
        fontSize: '20px',
        color: '#e8f4ff',
        fontFamily: 'Arial',
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setAlpha(0);

    this.timerText = this.scene.add
      .text(0, 0, '0:00.0', {
        fontSize: '22px',
        color: '#dcdcdc',
        fontFamily: 'Arial',
      })
      .setOrigin(1, 0);

    this.resultText = this.scene.add
      .text(0, 0, '', {
        fontSize: '22px',
        color: '#e8f4ff',
        fontFamily: 'Arial',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.getElements().forEach(element => {
      element.setScrollFactor(0);
      element.setDepth(DEPTH);
    });

    this.layout();
  }

  setLight(ratio: number) {
    if (Math.abs(ratio - this.lastLightRatio) < LIGHT_BAR_STEP) return;

    const wasLow = this.isLowRatio(this.lastLightRatio);

    this.lastLightRatio = ratio;
    this.lightFill.setScale(Math.max(ratio, 0), 1);
    this.lightFill.setFillStyle(this.lightColor(ratio));

    if (this.isLowRatio(ratio) !== wasLow) {
      this.toggleLightBlink(this.isLowRatio(ratio));
    }
  }

  setMollusks(collected: number, total: number) {
    if (collected === this.lastCollected && total === this.lastTotal) return;

    this.lastCollected = collected;
    this.lastTotal = total;
    this.molluskText.setText(`Mollusks: ${collected}/${total}`);
  }

  setHealth(health: number) {
    if (health === this.lastHealth) return;

    this.lastHealth = health;
    this.hearts.forEach((heart, index) => heart.setVisible(index < health));
  }

  layout() {
    this.molluskText.setPosition(MARGIN, MARGIN);
    this.hearts.forEach((heart, index) => {
      heart.setPosition(MARGIN + index * HEART_SPACING, HEART_ROW_Y);
    });
    this.lightFrame.setPosition(MARGIN, LIGHT_BAR_Y);
    this.lightFill.setPosition(MARGIN, LIGHT_BAR_Y);
    this.hintText.setPosition(
      this.scene.scale.width / 2,
      this.scene.scale.height - HINT_BOTTOM_MARGIN
    );
    this.timerText.setPosition(this.scene.scale.width - MARGIN, TIMER_TOP);
    this.resultText.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2);
  }

  setTime(ms: number) {
    const label = formatTime(ms);

    if (label === this.lastTimerLabel) return;

    this.lastTimerLabel = label;
    this.timerText.setText(label);
  }

  showResult(text: string) {
    this.resultText.setText(text);
    this.scene.tweens.killTweensOf(this.resultText);
    this.resultText.setAlpha(0);
    this.scene.tweens.add({
      targets: this.resultText,
      alpha: 1,
      duration: config.tutorial.fadeMs,
      ease: 'Quad.easeOut',
    });
  }

  private isLowRatio(ratio: number) {
    return ratio >= 0 && ratio <= config.player.light.lowFuelThreshold;
  }

  private lightColor(ratio: number) {
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(LIGHT_COLOR_LOW),
      Phaser.Display.Color.ValueToColor(LIGHT_COLOR_FULL),
      100,
      ratio * 100
    );

    return Phaser.Display.Color.GetColor(color.r, color.g, color.b);
  }

  private toggleLightBlink(active: boolean) {
    if (!active) {
      this.lightBlinkTween?.stop();
      this.lightBlinkTween = undefined;
      this.lightFill.setAlpha(1);
      return;
    }

    this.lightBlinkTween = this.scene.tweens.add({
      targets: this.lightFill,
      alpha: { from: 1, to: 0.3 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setHint(text: string) {
    this.hintText.setText(text);
    this.fadeHint(1);
  }

  clearHint() {
    this.fadeHint(0);
  }

  private fadeHint(alpha: number) {
    this.scene.tweens.killTweensOf(this.hintText);
    this.scene.tweens.add({
      targets: this.hintText,
      alpha,
      duration: config.tutorial.fadeMs,
      ease: 'Quad.easeOut',
    });
  }

  getElements(): Array<Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle> {
    return [
      this.molluskText,
      ...this.hearts,
      this.lightFrame,
      this.lightFill,
      this.hintText,
      this.timerText,
      this.resultText,
    ];
  }
}
