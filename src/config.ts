import Phaser from 'phaser';

export type EnemyKind = 'anglerFish' | 'swallowtail' | 'jellyfish';

export interface SpawnIndent {
  top?: number,
  bottom?: number,
  left?: number,
  right?: number,
}

export interface EnemySpawnConfig {
  kind: EnemyKind,
  count: number,
  indent?: SpawnIndent,
}

export interface MolluskConfig {
  count: number,
  indent?: SpawnIndent,
}

export interface LevelTextures {
  backgroundFar: string,
  background: string,
  foreground: string,
}

export interface LevelConfig {
  width: number,
  nextScene: string,
  music: string[],
  textures: LevelTextures,
  enemies: EnemySpawnConfig[],
  mollusks: MolluskConfig,
  plankton?: boolean,
}

export const VERSION = __APP_VERSION__;

export const config = {
  world: {
    gravityY: 50,
    groundHeight: 45,
    groundOffsetY: 35,
  },
  noise: {
    radiusMin: 180,
    radiusMax: 420,
    lifetimeMs: 600,
    maxPings: 8,
    lightDetectionFactor: 0.9,
    alertThreshold: 0.35,
  },
  player: {
    maxHealth: 3,
    speed: 260,
    movingThreshold: 79,
    light: {
      fuelMax: 100,
      fuelStart: 85,
      drainPerSecond: 1.4,
      fuelPerMollusk: 25,
      radiusMax: 500,
      radiusMin: 120,
      intensityMax: 2.5,
      intensityMin: 1.2,
      pulseAmplitude: 0.5,
      pulseAmplitudeLow: 1,
      pulseSpeed: 0.02,
      pulseSpeedLow: 0.05,
      dimRadius: 90,
      dimDrainMultiplier: 0.25,
      dimTransitionMs: 350,
      lowFuelThreshold: 0.25,
      darknessGraceMs: 15000,
    },
  },
  enemy: {
    anglerFish: {
      postDriftRadius: 40,
      driftSpeed: 22,
      driftIntervalMs: { min: 2000, max: 4500 },
      lureIntervalMs: 2000,
      lureIntensityMin: 2.5,
      lureIntensityMax: 5,
      alertIntensity: 7,
      recoverIntensity: 1.2,
      telegraphMs: 400,
      lungeRange: 150,
      lungeSpeed: 420,
      lungeDurationMs: 350,
      lungeCooldownMs: 2500,
      returnSpeed: 60,
      biteFrame: 3,
      biteFrameMs: 250,
      senses: { hearRadius: 260, hearingFactor: 0.7, sightFactor: 1 },
      light: { radius: 46, color: 0xf0ff5e, intensity: 4, offsetX: 50, offsetY: -20 },
      hitArea: { width: 40, height: 40, offsetX: 40, offsetY: 30 },
      bubbles: { minDelay: 3000, maxDelay: 9000, maxCount: 1 },
    },
    swallowtail: {
      patrolSpeed: 90,
      patrolTurnMs: { min: 3000, max: 6000 },
      patrolWobble: 18,
      patrolWobbleMs: 2600,
      telegraphMs: 450,
      shakeMs: 110,
      dashSpeed: 520,
      dashDurationMs: 400,
      cooldownMs: 1800,
      senses: { hearRadius: 380, hearingFactor: 1, sightFactor: 0 },
      bodySize: { width: 110, height: 50 },
      hitArea: { width: 60, height: 50, offsetX: 45, offsetY: 0 },
      bubbles: { minDelay: 4000, maxDelay: 12000, maxCount: 1 },
    },
    jellyfish: {
      alpha: 0.88,
      pulseMs: 2600,
      squash: 0.08,
      driftRatio: 0.35,
      driftSpeed: 26,
      riseSpeed: 34,
      glowRadius: 60,
      glowColor: 0xa8f0e0,
      glowScale: 1,
      glowPulse: 0.14,
      glowAlpha: 0.3,
      glowAlphaPulse: 0.12,
      senses: { hearRadius: 0, hearingFactor: 0, sightFactor: 0 },
      bodySize: { width: 60, height: 90 },
      hitArea: { width: 58, height: 96, offsetX: 0, offsetY: 12 },
    },
  },
  mollusk: {
    scale: 0.6,
    lightRadius: 100,
    lightColor: 0x66ccff,
    nest: {
      size: { min: 2, max: 4 },
      radius: 130,
      spacing: 700,
      padding: 100,
    },
    pulse: {
      nearDistance: 240,
      farDistance: 900,
      slowMs: 2800,
      fastMs: 900,
      scaleAmount: 0.12,
      intensityBase: 1,
      intensityAmount: 0.55,
      closenessFloor: 0.25,
      bobMs: 2200,
      bobDistance: 5,
      tiltRad: 0.12,
    },
  },
  levels: {
    1: {
      width: 5000,
      nextScene: 'Level2Scene',
      music: ['gameMusic1'],
      textures: {
        backgroundFar: 'level1BgFar',
        background: 'level1Bg',
        foreground: 'level1Fg',
      },
      enemies: [
        { kind: 'anglerFish', count: 6 },
        { kind: 'jellyfish', count: 3, indent: { bottom: 200 } },
      ],
      mollusks: {
        count: 7,
      },
    },
    2: {
      width: 8000,
      nextScene: 'Level3Scene',
      music: ['gameMusic2'],
      textures: {
        backgroundFar: 'level2BgFar',
        background: 'level2Bg',
        foreground: 'level2Fg',
      },
      enemies: [
        { kind: 'anglerFish', count: 7 },
        { kind: 'swallowtail', count: 4 },
        { kind: 'jellyfish', count: 6, indent: { bottom: 180 } },
      ],
      mollusks: {
        count: 15,
      },
    },
    3: {
      width: 12000,
      nextScene: 'WinScene',
      music: ['gameMusic3'],
      plankton: false,
      textures: {
        backgroundFar: 'level3BgFar',
        background: 'level3Bg',
        foreground: 'level3Fg',
      },
      enemies: [],
      mollusks: {
        count: 18,
        indent: {
          top: 230,
          bottom: 230,
          left: 800,
        },
      }
    }
  } as Record<number, LevelConfig>,
}

export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#0a1119',
  parent: 'game',
  autoFocus: true,
  physics: {
    default: 'arcade',
    arcade: {
      fps: 30,
      timeScale: 1,
      fixedStep: true,
      useTree: true,
      debug: false,
    },
  },
  fps: {
    target: 30,
    forceSetTimeOut: true
  },
  render: {
    // A nest plus a couple of anglers already passes the default cap of ten lights.
    maxLights: 16,
    roundPixels: false,
    pixelArt: false,
    antialias: true,
    powerPreference: 'high-performance',
  },
  scene: [],
  input: { mouse: true, touch: true, keyboard: true },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
}
