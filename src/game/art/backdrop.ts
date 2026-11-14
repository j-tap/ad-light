import Phaser from 'phaser';
import { config, TAU } from '../../config';
import { ensureCanvasTexture } from '../textures';
import { between, createRng } from './random';

export const TRENCH_BACKDROP = 'trenchBackdrop';

const settings = config.trench.backdrop;
const STEP = 8;

/**
 * Far wall of the trench: dim rock columns that tile in both directions. Every wave uses a
 * whole number of periods per tile, which is what keeps the seams invisible.
 */
export function ensureTrenchBackdrop(scene: Phaser.Scene) {
  const { size, base, tones, columns, seed, specks, waveAmplitude } = settings;

  return ensureCanvasTexture(scene, TRENCH_BACKDROP, size, size, context => {
    const rng = createRng(seed);

    context.fillStyle = base;
    context.fillRect(0, 0, size, size);

    for (let i = 0; i < columns; i++) {
      const centre = ((i + between(rng, 0.2, 0.8)) / columns) * size;
      const width = between(rng, 0.06, 0.16) * size;
      const waves = [1, 2, 3].map(k => ({
        periods: k + Math.floor(rng() * 2),
        amplitude: between(rng, waveAmplitude.min, waveAmplitude.max) / k,
        phase: rng() * TAU,
      }));
      const offsetAt = (y: number, shift: number) => waves.reduce(
        (sum, wave) => sum + Math.sin((y / size) * TAU * wave.periods + wave.phase + shift) * wave.amplitude,
        0
      );

      context.fillStyle = tones[i % tones.length];

      // Drawn three times so a column that crosses the left or right edge wraps around.
      [-size, 0, size].forEach(wrap => {
        context.beginPath();

        for (let y = 0; y <= size; y += STEP) {
          context.lineTo(centre + wrap - width / 2 + offsetAt(y, 0), y);
        }

        for (let y = size; y >= 0; y -= STEP) {
          context.lineTo(centre + wrap + width / 2 + offsetAt(y, 1.3), y);
        }

        context.closePath();
        context.fill();
      });
    }

    for (let i = 0; i < specks; i++) {
      context.fillStyle = rng() < 0.5 ? 'rgba(0, 0, 0, 0.25)' : 'rgba(190, 210, 220, 0.05)';
      context.fillRect(rng() * size, rng() * size, 2, 2);
    }
  });
}
