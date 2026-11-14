import Phaser from 'phaser';
import { config } from '../config';
import { spikeTexture } from './RockObstacle';
import { ensureSoftGlow } from './textures';

const settings = config.trench.vent;
const TAU = Math.PI * 2;

/**
 * The warm vent at the bottom of the trench: the one light source that belongs to the abyss,
 * and the thing that finally throws the fish back up.
 */
export class ThermalVent {
  private readonly scene: Phaser.Scene;
  private readonly mouth: Phaser.Math.Vector2;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly light: Phaser.GameObjects.Light;
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private time = 0;
  private erupting = false;

  constructor(scene: Phaser.Scene, floorY: number) {
    const { x, chimneyWidth, chimneyHeight, chimneyVariant, color, coreColor, embers, light } = settings;
    const glowTexture = ensureSoftGlow(scene);

    this.scene = scene;
    this.mouth = new Phaser.Math.Vector2(x, floorY - chimneyHeight * 0.86);

    this.glow = scene.add.image(x, this.mouth.y, glowTexture)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(config.render.scenery);

    scene.add.image(x, floorY + chimneyHeight * 0.1, spikeTexture(scene, chimneyVariant))
      .setOrigin(0.5, 1)
      .setFlipY(true)
      .setDisplaySize(chimneyWidth, chimneyHeight)
      .setPipeline('Light2D')
      .setDepth(config.render.rockObstacle - 2);

    scene.add.image(x, this.mouth.y, glowTexture)
      .setTint(coreColor)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.7)
      .setDepth(config.render.rockObstacle - 1);

    this.light = scene.lights.addLight(x, this.mouth.y, light.radius, color, light.intensity);

    this.embers = scene.add.particles(x, this.mouth.y, 'planktonParticle', {
      lifespan: embers.lifespanMs,
      speedY: { min: -embers.speed.max, max: -embers.speed.min },
      speedX: { min: -embers.drift, max: embers.drift },
      scale: { start: embers.scale, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [color, coreColor],
      frequency: embers.everyMs,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(config.render.rockObstacle - 1);
  }

  getMouth() {
    return this.mouth;
  }

  update(delta: number) {
    if (this.erupting) return;

    this.time += delta;

    const pulse = Math.sin((this.time / settings.pulseMs) * TAU);

    this.glow.setScale(settings.glowScale * (1 + pulse * settings.glowPulse));
    this.light.intensity = settings.light.intensity + pulse * settings.light.pulse;
  }

  erupt() {
    const { eruption, embers } = settings;

    this.erupting = true;
    this.embers.frequency = eruption.everyMs;
    this.embers.lifespan = eruption.lifespanMs;
    this.embers.speedY = { min: -embers.speed.max * eruption.speedScale, max: -embers.speed.min * eruption.speedScale };
    this.embers.speedX = { min: -embers.drift * 3, max: embers.drift * 3 };

    this.scene.tweens.add({
      targets: this.glow,
      scale: eruption.glowScale,
      duration: config.trench.finale.liftDelayMs,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: this.light,
      radius: eruption.lightRadius,
      intensity: eruption.lightIntensity,
      duration: config.trench.finale.liftDelayMs,
      ease: 'Quad.easeOut',
    });
  }
}
