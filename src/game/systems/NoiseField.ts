import Phaser from 'phaser';
import { config } from '../../config';

export interface NoisePing {
  x: number,
  y: number,
  radius: number,
  age: number,
  active: boolean,
}

const settings = config.noise;

/**
 * Every ripple the player leaves behind is a noise ping: how far it reaches depends on
 * the swimming speed, so moving fast is what gives the player away.
 * A fixed pool keeps the per-frame cost allocation free.
 */
export class NoiseField {
  private readonly pings: NoisePing[] = [];

  constructor() {
    for (let i = 0; i < settings.maxPings; i++) {
      this.pings.push({ x: 0, y: 0, radius: 0, age: 0, active: false });
    }
  }

  emit(x: number, y: number, loudness: number) {
    const ping = this.takeFreePing();

    ping.x = x;
    ping.y = y;
    ping.radius = Phaser.Math.Linear(settings.radiusMin, settings.radiusMax, Phaser.Math.Clamp(loudness, 0, 1));
    ping.age = 0;
    ping.active = true;
  }

  update(delta: number) {
    for (const ping of this.pings) {
      if (!ping.active) continue;

      ping.age += delta;

      if (ping.age >= settings.lifetimeMs) {
        ping.active = false;
      }
    }
  }

  /** Freshest ping that reaches the listener, or null when it is quiet around. */
  getAudiblePing(listenerX: number, listenerY: number, hearRadius: number): NoisePing | null {
    let best: NoisePing | null = null;

    for (const ping of this.pings) {
      if (!ping.active) continue;

      const reach = Math.min(ping.radius, hearRadius);

      if (Phaser.Math.Distance.Between(listenerX, listenerY, ping.x, ping.y) > reach) continue;
      if (best && best.age <= ping.age) continue;

      best = ping;
    }

    return best;
  }

  getLoudness(ping: NoisePing) {
    return 1 - ping.age / settings.lifetimeMs;
  }

  reset() {
    for (const ping of this.pings) {
      ping.active = false;
    }
  }

  private takeFreePing() {
    let oldest = this.pings[0];

    for (const ping of this.pings) {
      if (!ping.active) return ping;
      if (ping.age > oldest.age) oldest = ping;
    }

    return oldest;
  }
}
