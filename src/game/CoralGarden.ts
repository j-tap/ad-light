import Phaser from 'phaser';
import { config, CoralPlacement } from '../config';
import { ensureCoralTexture } from './art/coral';
import { TrenchWalls } from './TrenchWalls';
import { addRisingParticles } from './art/particles';
import { addSoftGlow, ensureCanvasTexture, ensureSoftGlow } from './textures';

const settings = config.trench.garden;
const palettes = config.coral.palettes;
const SKYLIGHT_TEXTURE = 'gardenSkylight';

/**
 * The end of the journey: a shelf of glowing corals under the last trace of daylight.
 * Everything here lights itself, so the place reads as bright against the trench below.
 */
export class CoralGarden {
  private readonly scene: Phaser.Scene;
  private readonly walls: TrenchWalls;
  private readonly greatCoral = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, walls: TrenchWalls, worldWidth: number) {
    this.scene = scene;
    this.walls = walls;

    this.createSkylight(worldWidth);
    settings.layout.forEach((placement, index) => this.plant(placement, index));
    this.plant(settings.greatCoral, settings.layout.length, this.greatCoral);
    this.createMotes(worldWidth);
  }

  /** Middle of the great coral, the spot the fish is invited to. */
  getGreatCoral() {
    return this.greatCoral;
  }

  private plant(placement: CoralPlacement, index: number, centre?: Phaser.Math.Vector2) {
    const surface = this.walls.surfaceY(placement.side, placement.x, placement.from, placement.to);

    if (surface === undefined) return;

    const palette = palettes[placement.palette % palettes.length];
    const texture = ensureCoralTexture(this.scene, placement.kind, placement.palette, index);
    const depth = placement.front ? config.render.foreground : config.render.scenery;
    const baseY = surface + settings.embed;
    const { sway } = settings;

    const coral = this.scene.add.image(placement.x, baseY, texture)
      .setOrigin(0.5, 1)
      .setScale(placement.scale)
      .setFlipX(index % 2 === 1)
      .setDepth(depth);

    const middleY = baseY - coral.displayHeight * 0.55;

    addSoftGlow(this.scene, placement.x, middleY, palette.glow)
      .setAlpha(settings.glowAlpha)
      .setDisplaySize(coral.displayWidth * settings.glowScale, coral.displayHeight * settings.glowScale)
      .setDepth(depth - 0.5);

    this.scene.tweens.add({
      targets: coral,
      angle: {
        from: -Phaser.Math.FloatBetween(sway.degrees.min, sway.degrees.max),
        to: Phaser.Math.FloatBetween(sway.degrees.min, sway.degrees.max),
      },
      duration: Phaser.Math.Between(sway.ms.min, sway.ms.max),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    if (placement.light) {
      this.scene.lights.addLight(
        placement.x,
        middleY,
        placement.light.radius,
        palette.glow,
        placement.light.intensity
      );
    }

    centre?.set(placement.x, middleY);
  }

  /** A soft blue wash from above: as close to daylight as a blobfish should ever get. */
  private createSkylight(worldWidth: number) {
    const { skylight } = settings;
    const { width, height } = skylight.texture;
    const { beams } = skylight;

    ensureCanvasTexture(this.scene, SKYLIGHT_TEXTURE, width, height, context => {
      const wash = context.createLinearGradient(0, 0, 0, height);

      // Fully clear well before the last row, or filtering turns the bottom edge into a line.
      wash.addColorStop(0, `rgba(${skylight.color}, ${skylight.strength})`);
      wash.addColorStop(skylight.fadeAt, `rgba(${skylight.color}, 0)`);
      context.fillStyle = wash;
      context.fillRect(0, 0, width, height);

      const reach = height * beams.length;

      for (let beam = 0; beam < beams.count; beam++) {
        const top = ((beam + 0.5) / beams.count) * width;
        const bottom = top + beams.slant + beam * beams.spread;
        const shaft = context.createLinearGradient(0, 0, 0, reach);

        shaft.addColorStop(0, `rgba(${beams.color}, ${beams.strength})`);
        shaft.addColorStop(1, `rgba(${beams.color}, 0)`);

        context.fillStyle = shaft;
        context.beginPath();
        context.moveTo(top - beams.top, 0);
        context.lineTo(top + beams.top, 0);
        context.lineTo(bottom + beams.bottom, reach);
        context.lineTo(bottom - beams.bottom, reach);
        context.closePath();
        context.fill();
      }
    });

    this.scene.add.image(0, 0, SKYLIGHT_TEXTURE)
      .setOrigin(0)
      .setDisplaySize(worldWidth, skylight.height)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(skylight.alpha)
      .setDepth(config.render.scenery - 1);
  }

  private createMotes(worldWidth: number) {
    const { motes } = settings;

    addRisingParticles(this.scene, 0, 0, ensureSoftGlow(this.scene), motes, {
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(0, motes.top, worldWidth, motes.bottom - motes.top),
      },
      tint: palettes.map(palette => palette.glow),
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(config.render.scenery + 1);
  }
}
