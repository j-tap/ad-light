import Phaser from 'phaser';
import { config } from '../config';
import { ensureArmTexture } from './art/tentacle';
import { sampleLight } from './art/lighting';

const { points: POINT_COUNT, paint } = config.tentacle;

/**
 * A bendable kraken arm. The caller describes the centre line in world space and the rope
 * stretches the arm artwork along it. Ropes are drawn as a triangle strip, which the Light2D
 * pipeline cannot batch, so the arm is tinted per point to match the lit scene around it.
 */
export class KrakenArm {
  private readonly scene: Phaser.Scene;
  private readonly rope: Phaser.GameObjects.Rope;
  private readonly colors: number[];
  private readonly scale: number;
  private readonly scratch = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, width: number, depth: number) {
    const points = Array.from({ length: POINT_COUNT }, () => new Phaser.Math.Vector2());

    this.scene = scene;
    this.colors = points.map(() => 0);

    // Rope thickness is fixed to the texture height, so the whole rope is scaled instead.
    this.scale = width / paint.thickness;
    this.rope = scene.add.rope(0, 0, ensureArmTexture(scene), undefined, points, true)
      .setScale(this.scale)
      .setDepth(depth);
  }

  /** `curve` writes the world position for t in 0..1, body to tip. */
  shape(curve: (t: number, out: Phaser.Math.Vector2) => void) {
    const points = this.rope.points as Phaser.Math.Vector2[];

    for (let i = 0; i < points.length; i++) {
      curve(i / (points.length - 1), this.scratch);
      points[i].set(this.scratch.x / this.scale, this.scratch.y / this.scale);
      this.colors[i] = sampleLight(this.scene, this.scratch.x, this.scratch.y);
    }

    this.rope.setColors(this.colors);
    this.rope.setDirty();
  }

  setFlipY(flip: boolean) {
    this.rope.flipY = flip;
  }

  setAlpha(alpha: number) {
    this.rope.setAlpha(alpha);
  }

  setVisible(visible: boolean) {
    this.rope.setVisible(visible);
  }

  destroy() {
    this.rope.destroy();
  }
}
