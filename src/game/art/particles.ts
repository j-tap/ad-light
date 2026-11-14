import Phaser from 'phaser';

export interface RisingParticleSettings {
  everyMs: number,
  speed: { min: number, max: number },
  drift: number,
  lifespanMs: number,
  /** A single number shrinks to nothing over the lifetime; a range picks a fixed size per particle. */
  scale: number | { min: number, max: number },
  alpha: number,
}

type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

/** Embers, bubbles and motes: anything that drifts upwards and fades out. */
export function addRisingParticles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  texture: string,
  settings: RisingParticleSettings,
  extra: EmitterConfig = {}
) {
  return scene.add.particles(x, y, texture, {
    lifespan: settings.lifespanMs,
    speedY: { min: -settings.speed.max, max: -settings.speed.min },
    speedX: { min: -settings.drift, max: settings.drift },
    scale: typeof settings.scale === 'number' ? { start: settings.scale, end: 0 } : settings.scale,
    alpha: { start: settings.alpha, end: 0 },
    frequency: settings.everyMs,
    ...extra,
  });
}
