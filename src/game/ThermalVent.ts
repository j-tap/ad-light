import Phaser from 'phaser';
import { config, TAU } from '../config';
import { spikeTexture } from './RockObstacle';
import { addRisingParticles } from './art/particles';
import { addSoftGlow } from './textures';

const settings = config.trench.vent;

/**
 * The warm vent on the floor of the trench: the one light source that belongs to the abyss,
 * and the place the climb starts from.
 */
export class ThermalVent {
  private readonly glow: Phaser.GameObjects.Image;
  private readonly light: Phaser.GameObjects.Light;
  private time = 0;

  constructor(scene: Phaser.Scene, floorY: number) {
    const { x, chimneyWidth, chimneyHeight, chimneyVariant, color, coreColor, embers, light } = settings;
    const mouthY = floorY - chimneyHeight * settings.mouthAt;

    this.glow = addSoftGlow(scene, x, mouthY, color).setDepth(config.render.scenery);

    scene.add.image(x, floorY + chimneyHeight * settings.sunk, spikeTexture(scene, chimneyVariant))
      .setOrigin(0.5, 1)
      .setFlipY(true)
      .setDisplaySize(chimneyWidth, chimneyHeight)
      .setPipeline('Light2D')
      .setDepth(config.render.rockObstacle - 2);

    addSoftGlow(scene, x, mouthY, coreColor)
      .setScale(settings.coreScale)
      .setDepth(config.render.rockObstacle - 1);

    this.light = scene.lights.addLight(x, mouthY, light.radius, color, light.intensity);

    addRisingParticles(scene, x, mouthY, 'planktonParticle', embers, {
      tint: [color, coreColor],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(config.render.rockObstacle - 1);
  }

  update(delta: number) {
    this.time += delta;

    const pulse = Math.sin((this.time / settings.pulseMs) * TAU);

    this.glow.setScale(settings.glowScale * (1 + pulse * settings.glowPulse));
    this.light.intensity = settings.light.intensity + pulse * settings.light.pulse;
  }
}
