import Phaser from 'phaser';
import { config, TAU } from '../../config';
import { ensureCanvasTexture } from '../textures';

const { paint } = config.tentacle;
const ARM_TEXTURE = 'krakenArm';

/** One kraken arm drawn along the x axis, thick at the body and tapering to the tip. */
export function ensureArmTexture(scene: Phaser.Scene) {
  const { length, thickness, tipThickness, outlineWidth, suckers } = paint;

  return ensureCanvasTexture(scene, ARM_TEXTURE, length, thickness, context => {
    const middle = thickness / 2;
    const tipX = length - tipThickness;
    const halfAt = (x: number) => Phaser.Math.Linear(
      middle - outlineWidth,
      tipThickness / 2,
      Math.pow(Phaser.Math.Clamp(x / tipX, 0, 1), 0.85)
    );
    const outlinePath = () => {
      context.beginPath();
      context.moveTo(-outlineWidth * 2, middle - halfAt(0));

      for (let x = 0; x <= tipX; x += 16) {
        context.lineTo(x, middle - halfAt(x));
      }

      context.arc(tipX, middle, tipThickness / 2, -Math.PI / 2, Math.PI / 2);

      for (let x = tipX; x >= 0; x -= 16) {
        context.lineTo(x, middle + halfAt(x));
      }

      context.lineTo(-outlineWidth * 2, middle + halfAt(0));
    };

    context.lineJoin = 'round';
    context.lineCap = 'round';

    outlinePath();
    context.fillStyle = paint.skin;
    context.fill();

    context.save();
    outlinePath();
    context.clip();

    context.strokeStyle = paint.skinLight;
    context.lineWidth = thickness * 0.16;
    context.beginPath();

    for (let x = 0; x <= tipX; x += 16) {
      context.lineTo(x, middle - halfAt(x) * 0.45);
    }

    context.stroke();

    for (let i = 0; i < suckers; i++) {
      const x = ((i + 0.6) / suckers) * tipX * 0.94;
      const half = halfAt(x);
      const radius = half * 0.36;

      context.beginPath();
      context.ellipse(x, middle + half * 0.5, radius * 1.15, radius, 0, 0, TAU);
      context.fillStyle = paint.sucker;
      context.fill();
      context.lineWidth = Math.max(outlineWidth * 0.4, 1.5);
      context.strokeStyle = paint.outline;
      context.stroke();

      context.beginPath();
      context.ellipse(x, middle + half * 0.5, radius * 0.45, radius * 0.4, 0, 0, TAU);
      context.fillStyle = paint.suckerDark;
      context.fill();
    }

    context.restore();

    outlinePath();
    context.strokeStyle = paint.outline;
    context.lineWidth = outlineWidth;
    context.stroke();
  });
}
