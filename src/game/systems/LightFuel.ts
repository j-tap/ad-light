import Phaser from 'phaser';
import { config } from '../../config';

const settings = config.player.light;

/**
 * Player light is a consumable: it drains over time, mollusks refill it and the radius
 * follows the remaining amount, so running low is what actually endangers the player.
 */
export class LightFuel {
  private fuel = settings.fuelStart;
  private dimFactor = 0;
  private radiusMultiplier = 1;

  update(delta: number, dimmed: boolean, drainMultiplier = 1) {
    const dimStep = delta / settings.dimTransitionMs;

    this.dimFactor = Phaser.Math.Clamp(this.dimFactor + (dimmed ? dimStep : -dimStep), 0, 1);

    const drain = settings.drainPerSecond
      * drainMultiplier
      * Phaser.Math.Linear(1, settings.dimDrainMultiplier, this.dimFactor);

    this.fuel = Phaser.Math.Clamp(this.fuel - drain * (delta / 1000), 0, settings.fuelMax);
  }

  refill(amount: number) {
    this.fuel = Phaser.Math.Clamp(this.fuel + amount, 0, settings.fuelMax);
  }

  reset() {
    this.fuel = settings.fuelStart;
    this.dimFactor = 0;
    this.radiusMultiplier = 1;
  }

  setRadiusMultiplier(multiplier: number) {
    this.radiusMultiplier = multiplier;
  }

  setFuel(value: number) {
    this.fuel = Phaser.Math.Clamp(value, 0, settings.fuelMax);
  }

  getRatio() {
    return this.fuel / settings.fuelMax;
  }

  isEmpty() {
    return this.fuel <= 0;
  }

  isLow() {
    return this.getRatio() <= settings.lowFuelThreshold;
  }

  getRadius() {
    const radius = Phaser.Math.Linear(settings.radiusMin, settings.radiusMax, this.getRatio());

    return Phaser.Math.Linear(radius, settings.dimRadius, this.dimFactor) * this.radiusMultiplier;
  }

  getIntensity(pulse: number) {
    const ratio = this.getRatio();
    const base = Phaser.Math.Linear(settings.intensityMin, settings.intensityMax, ratio);
    const amplitude = Phaser.Math.Linear(settings.pulseAmplitudeLow, settings.pulseAmplitude, ratio);

    return Math.max(base + Math.sin(pulse) * amplitude, 0);
  }

  /** Low light makes the pulse nervous, which reads as the light being about to die. */
  getPulseSpeed() {
    return Phaser.Math.Linear(settings.pulseSpeedLow, settings.pulseSpeed, this.getRatio());
  }
}
