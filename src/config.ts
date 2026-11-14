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

export type LevelOrientation = 'horizontal' | 'vertical';

export interface DepthEffects {
  ambientFrom: number,
  ambientTo: number,
  lightDrainFrom: number,
  lightDrainTo: number,
}

export interface CurrentZone {
  y: number,
  height: number,
  forceX: number,
}

export type RockSide = 'top' | 'bottom' | 'left' | 'right';

export interface RockObstacleDef {
  x: number,
  y: number,
  width: number,
  height: number,
  side: RockSide,
}

export interface RockTextures {
  top: string[],
  bottom: string[],
  left: string[],
  right: string[],
}

export interface RockSettings {
  bodyColor: number,
  overhangShadowHeight: number,
  overhangShadowAlpha: number,
  particleCount: number,
  particleColor: number,
  hazardGlowColor: number,
  hazardGlowStrength: number,
  hazardGlowDistance: number,
  hazardStripeColor: number,
  hitShakeDuration: number,
  hitShakeIntensity: number,
  hitCooldownMs: number,
  hitStunDuration: number,
  krakenCatchUpMultiplier: number,
  krakenCatchUpDuration: number,
  krakenSurgeDistance: number,
  molluskDeadZone: number,
  textures: RockTextures,
}

export interface LevelLighting {
  ambientColor?: number,
  fuelStart?: number,
  drainMultiplier?: number,
  radiusMultiplier?: number,
}

export interface EscapeConfig {
  finishX: number,
}

export interface TentacleSettings {
  texture: string,
  initialDelayMs: number,
  intervalMs: { min: number, max: number },
  targetOffsetX: { min: number, max: number },
  startWorldX: number,
  endWorldX: number,
  warningMs: number,
  warningColor: number,
  strikeMs: number,
  holdMs: number,
  retractMs: number,
  width: number,
}

export type LevelGoal = 'collect' | 'escape';

export interface LevelConfig {
  width: number,
  height?: number,
  orientation?: LevelOrientation,
  music: string[],
  textures: LevelTextures,
  enemies: EnemySpawnConfig[],
  mollusks: MolluskConfig,
  goal?: LevelGoal,
  escape?: EscapeConfig,
  lighting?: LevelLighting,
  plankton?: boolean,
  /** Turns the level opening into a scripted teaching zone. */
  tutorial?: boolean,
  depthEffects?: DepthEffects,
  currentZones?: CurrentZone[],
  finaleHeight?: number,
  rocks?: RockObstacleDef[],
  /** Parallax multiplier for the viewport foreground layer (default 3). */
  foregroundParallax?: number,
  /** Amber hazard markers on rock colliders so they read clearly against the bg. */
  markRockHazards?: boolean,
  /** Kraken tentacle sweeps during the chase segment. */
  tentacleAttacks?: boolean,
}

export const VERSION = __APP_VERSION__;

export const levelOrder = [1, 2, 3, 4];

export function nextLevelScene(currentKey: string) {
  const level = Number(/^Level(\d+)Scene$/.exec(currentKey)?.[1]);
  const next = levelOrder[levelOrder.indexOf(level) + 1];

  return next ? `Level${next}Scene` : 'WinScene';
}

export function isVerticalLevel(level: LevelConfig) {
  return level.orientation === 'vertical';
}

export function levelWorldSize(level: LevelConfig, viewportHeight: number) {
  return {
    width: level.width,
    height: isVerticalLevel(level) ? (level.height ?? viewportHeight) : viewportHeight,
  };
}

export const config = {
  world: {
    gravityY: 50,
    groundHeight: 45,
    groundOffsetY: 35,
    depthUpdateStep: 0.02,
  },
  /** Draw order: kraken < tentacles < player < fg decor < rock protrusions. */
  render: {
    kraken: 6,
    tentacle: 7,
    player: 8,
    foreground: 10,
    rockObstacle: 14,
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
  tutorial: {
    zoneWidth: 900,
    molluskCount: 3,
    molluskLead: 260,
    molluskSpacing: 190,
    anglerX: 1700,
    anglerY: 240,
    firstHintDelayMs: 2200,
    hintEnemyDistance: 380,
    hintHoldMs: 5500,
    escHintMs: 2500,
    fadeMs: 400,
  },
  camera: {
    zoomBase: 1,
    zoomChase: 1.12,
    zoomInMs: 700,
    zoomOutMs: 2200,
    threatRadius: 520,
    shakeMs: 220,
    shakeIntensity: 0.012,
    damageColor: 0xff2d2d,
    damageAlpha: 0.32,
    damageFadeMs: 420,
    overlayDepth: 90,
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
  rock: {
    bodyColor: 0x2a2420,
    overhangShadowHeight: 36,
    overhangShadowAlpha: 0.38,
    particleCount: 10,
    particleColor: 0x4a4438,
    hazardGlowColor: 0x9a7a55,
    hazardGlowStrength: 1.4,
    hazardGlowDistance: 5,
    hazardStripeColor: 0xffcc66,
    hitShakeDuration: 180,
    hitShakeIntensity: 4,
    hitCooldownMs: 700,
    hitStunDuration: 420,
    krakenCatchUpMultiplier: 2.8,
    krakenCatchUpDuration: 900,
    krakenSurgeDistance: 90,
    molluskDeadZone: 250,
    textures: {
      top: ['rockTop'],
      bottom: ['rockBottom'],
      left: ['rockLeft', 'rockLeft2'],
      right: ['rockLeft', 'rockLeft2'],
    },
  } as RockSettings,
  tentacle: {
    texture: 'krakenTentacle',
    initialDelayMs: 2800,
    intervalMs: { min: 2600, max: 4000 },
    targetOffsetX: { min: -40, max: 100 },
    startWorldX: 1500,
    endWorldX: 11200,
    warningMs: 380,
    warningColor: 0xcc5544,
    strikeMs: 200,
    holdMs: 140,
    retractMs: 160,
    width: 92,
  } as TentacleSettings,
  records: {
    timerUpdateMs: 100,
    resultToastMs: 1600,
    storageKey: 'ad-light:progress:v1',
  },
  levels: {
    1: {
      width: 5000,
      tutorial: true,
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
      music: ['gameMusic3'],
      goal: 'escape',
      escape: { finishX: 11500 },
      plankton: true,
      markRockHazards: true,
      tentacleAttacks: true,
      lighting: {
        ambientColor: 0x3a4a8a,
        fuelStart: 100,
        drainMultiplier: 0.35,
        radiusMultiplier: 1.2,
      },
      textures: {
        backgroundFar: 'level3BgFar',
        background: 'level3Bg',
        foreground: 'emptyTexture',
      },
      enemies: [],
      mollusks: {
        count: 0,
      },
      rocks: [
        { x: 1700, y: 0, width: 300, height: 0, side: 'top' },
        { x: 2900, y: 0, width: 280, height: 0, side: 'bottom' },
        { x: 4100, y: 0, width: 260, height: 0, side: 'top' },
        { x: 4700, y: 0, width: 260, height: 0, side: 'bottom' },
        { x: 5600, y: 0, width: 320, height: 0, side: 'top' },
        { x: 6800, y: 0, width: 300, height: 0, side: 'bottom' },
        { x: 7900, y: 0, width: 280, height: 0, side: 'top' },
        { x: 8500, y: 0, width: 260, height: 0, side: 'bottom' },
        { x: 9400, y: 0, width: 300, height: 0, side: 'top' },
        { x: 10400, y: 0, width: 280, height: 0, side: 'bottom' },
      ],
    },
    4: {
      width: 1600,
      height: 9000,
      orientation: 'vertical',
      music: ['gameMusic2'],
      plankton: true,
      finaleHeight: 1400,
      depthEffects: {
        ambientFrom: 0x1a2a6c,
        ambientTo: 0x05070d,
        lightDrainFrom: 1,
        lightDrainTo: 1.8,
      },
      currentZones: [
        { y: 1600, height: 700, forceX: 90 },
        { y: 3400, height: 800, forceX: -100 },
        { y: 5400, height: 700, forceX: 80 },
        { y: 7200, height: 650, forceX: -90 },
      ],
      textures: {
        backgroundFar: 'level3BgFar',
        background: 'depthGradient',
        foreground: 'emptyTexture',
      },
      enemies: [
        { kind: 'jellyfish', count: 6, indent: { top: 400, bottom: 400 } },
        { kind: 'swallowtail', count: 3, indent: { top: 800, bottom: 500 } },
      ],
      mollusks: {
        count: 16,
        indent: {
          top: 350,
          bottom: 180,
        },
      },
      rocks: [
        // --- Section 1 (y 800–1800): passage shifts right ---
        { x: 0, y: 800, width: 700, height: 280, side: 'left' },
        { x: 0, y: 1300, width: 850, height: 300, side: 'left' },
        { x: 0, y: 1100, width: 300, height: 200, side: 'right' },

        // --- Section 2 (y 2000–3200): passage shifts left ---
        { x: 0, y: 2000, width: 350, height: 260, side: 'right' },
        { x: 0, y: 2500, width: 800, height: 320, side: 'right' },
        { x: 0, y: 2200, width: 280, height: 200, side: 'left' },
        // Dead-end niche on right
        { x: 0, y: 2900, width: 500, height: 240, side: 'right' },

        // --- Section 3 (y 3400–4400): narrow center ---
        { x: 0, y: 3400, width: 550, height: 300, side: 'left' },
        { x: 0, y: 3500, width: 500, height: 280, side: 'right' },
        { x: 0, y: 3900, width: 650, height: 260, side: 'left' },
        { x: 0, y: 4000, width: 600, height: 250, side: 'right' },

        // --- Section 4 (y 4600–5600): wide-then-tight, passage right ---
        { x: 0, y: 4600, width: 900, height: 350, side: 'left' },
        { x: 0, y: 5000, width: 950, height: 300, side: 'left' },
        { x: 0, y: 4800, width: 250, height: 200, side: 'right' },

        // --- Section 5 (y 5800–6800): passage left ---
        { x: 0, y: 5800, width: 300, height: 250, side: 'left' },
        { x: 0, y: 5900, width: 850, height: 320, side: 'right' },
        { x: 0, y: 6400, width: 900, height: 280, side: 'right' },
        // Dead-end niche on left
        { x: 0, y: 6200, width: 500, height: 220, side: 'left' },

        // --- Section 6 (y 7000–7800): final squeeze ---
        { x: 0, y: 7000, width: 600, height: 300, side: 'left' },
        { x: 0, y: 7000, width: 550, height: 280, side: 'right' },
        { x: 0, y: 7400, width: 700, height: 260, side: 'left' },
        { x: 0, y: 7500, width: 650, height: 250, side: 'right' },
      ],
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
    maxLights: 24,
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
