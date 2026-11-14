import Phaser from 'phaser';

export type EnemyKind = 'anglerFish' | 'swallowtail' | 'jellyfish';

export interface SpawnIndent {
  top?: number,
  bottom?: number,
  left?: number,
  right?: number,
}

/** The one point type shared by level data, collision outlines and generated artwork. */
export interface Point {
  x: number,
  y: number,
}

export interface EnemySpawnConfig {
  kind: EnemyKind,
  /** Random spawns inside the world bounds. */
  count?: number,
  indent?: SpawnIndent,
  /** Hand placed spawns, used where the level geometry leaves no room for chance. */
  at?: Point[],
}

export interface MolluskNest extends Point {
  count: number,
}

/** Either a number of mollusks scattered in random nests, or the nests placed by hand. */
export type MolluskConfig = { count: number } | { nests: MolluskNest[] };

export interface LevelTextures {
  backgroundFar: string,
  background?: string,
  foreground?: string,
}

export type LevelOrientation = 'horizontal' | 'vertical';

/** Ambient light and fuel drain at a given depth; values in between are interpolated. */
export interface DepthKey {
  y: number,
  ambient: number,
  drain: number,
}

/** Water speed in px/s, added on top of whatever the player swims. */
export interface CurrentZone {
  y: number,
  height: number,
  forceX?: number,
  forceY?: number,
}

export type TunnelSide = 'top' | 'bottom';

export interface RockObstacleDef {
  x: number,
  width: number,
  side: TunnelSide,
}

export type ShaftSide = 'left' | 'right';

export type CoralKind = 'branch' | 'tubes' | 'frond' | 'great';

export interface CoralPlacement {
  kind: CoralKind,
  palette: number,
  /** The coral stands on the first rock found at this x between the two depths. */
  x: number,
  side: ShaftSide,
  from: number,
  to: number,
  scale: number,
  /** Drawn in front of the fish instead of behind it. */
  front?: boolean,
  light?: { radius: number, intensity: number },
}

export interface DepthHint {
  y: number,
  text: string,
}

export interface ShaftLedge {
  side: ShaftSide,
  y: number,
  height: number,
  /** How far the feature reaches from its wall, in px from the world edge. */
  reach: number,
}

export interface ShaftConfig {
  /** Wall thickness control points as [depth, inset from the world edge]. */
  left: [number, number][],
  right: [number, number][],
  ledges: ShaftLedge[],
  /** Pockets carved into a wall, the opposite of a ledge. */
  alcoves: ShaftLedge[],
}

export interface LevelLighting {
  ambientColor?: number,
  fuelStart?: number,
  drainMultiplier?: number,
  radiusMultiplier?: number,
}

/**
 * How a level is won: by eating every mollusk, or by getting somewhere. A `reach` goal is met
 * once the fish is at or past `x` and at or above `y`, whichever of the two are given.
 */
export type LevelGoal = { type: 'collect' } | { type: 'reach', x?: number, y?: number };

export interface LevelConfig {
  width: number,
  height?: number,
  orientation?: LevelOrientation,
  music: string[],
  textures: LevelTextures,
  enemies: EnemySpawnConfig[],
  mollusks: MolluskConfig,
  goal: LevelGoal,
  lighting?: LevelLighting,
  /** Turns the level opening into a scripted teaching zone. */
  tutorial?: boolean,
  /** Shown once as the level opens. */
  title?: string,
  depthProfile?: DepthKey[],
  currentZones?: CurrentZone[],
  rocks?: RockObstacleDef[],
  shaft?: ShaftConfig,
  spawn?: Point,
}

export const VERSION = __APP_VERSION__;

/** Per-frame factors are tuned for 30 FPS and scaled by `delta / REFERENCE_FRAME_MS`. */
export const REFERENCE_FRAME_MS = 1000 / 30;
export const TAU = Math.PI * 2;

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
    /** Depth pressure is refreshed once the fish has moved this far vertically. */
    depthUpdateStep: 40,
  },
  /** Draw order: scenery < kraken arms < kraken < strike warning < player < fg decor < rock. */
  render: {
    scenery: 3,
    krakenArm: 5,
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
    /** Swimming speed while sneaking; the dimmed light itself is described under `light`. */
    sneakSpeedFactor: 0.5,
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
    escHintMs: 2500,
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
    sparkle: { count: 12, speed: 150, lifespanMs: 520, tint: 0x9fe6ff, scale: 0.4 },
    nest: {
      size: { min: 2, max: 4 },
      radius: 130,
      placedRadius: 60,
      /** Placed nests are flatter than they are wide. */
      placedSquash: 0.6,
      wallMargin: 60,
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
  terrain: {
    cellSize: 160,
    backfaceLimit: 24,
    passes: 3,
    /** The fish is pushed out of rock as two circles along its body. */
    playerRadius: 26,
    playerSpread: 24,
    enemyRadius: { anglerFish: 34, swallowtail: 30, jellyfish: 32 } as Record<EnemyKind, number>,
  },
  rock: {
    paint: {
      palette: {
        shade: '#2e3227',
        body: '#474a37',
        light: '#5c5e46',
        strata: '#262a20',
        outline: '#0b0e0a',
        grainDark: 'rgba(10, 13, 9, 0.24)',
        grainLight: 'rgba(160, 160, 120, 0.13)',
      },
      rimWidth: 110,
      lightRimWidth: 22,
      outlineWidth: 9,
      strataWidth: 3,
      grainDensity: 9,
      crackWidth: 4.5,
      crackSpacing: { min: 130, max: 300 },
      crackLength: { min: 40, max: 120 },
      crackBend: 0.55,
      grainTile: 192,
      /** Bedding lines across a free standing rock, as spacing and slope ranges. */
      strata: { first: { min: 40, max: 110 }, spacing: { min: 80, max: 150 }, tilt: 0.1, jitter: 8 },
    },
    obstacle: {
      variants: 4,
      seed: 4107,
      textureWidth: 360,
      textureHeight: 460,
      /** Spike height as a share of the tunnel height, so the gap scales with the screen. */
      viewportShare: 0.47,
      minHeight: 250,
      maxHeight: 520,
      sidePoints: 7,
      jag: 0.07,
      lean: 0.16,
      colliderInset: 0.88,
    },
    hitSpeed: 110,
    /** A ram counts against the spike within this distance of the fish. */
    hitMargin: 72,
    hitShakeDuration: 180,
    hitShakeIntensity: 4,
    hitCooldownMs: 700,
    hitStunDuration: 320,
  },
  chase: {
    krakenSpawnX: -2000,
    introDelayMs: 1000,
    introShakeMs: 1000,
    introShakeIntensity: 0.01,
    huntDelayMs: 500,
    rumbleEveryMs: 2000,
    rumbleMs: 350,
    rumbleIntensity: 0.003,
    /**
     * The kraken holds a distance behind the fish rather than a speed. It creeps closer on its
     * own, every mistake lets it close in and every dodged arm throws it back, so the gap on
     * screen is a running score of how well the escape is going.
     */
    gap: {
      start: 380,
      min: 130,
      max: 540,
      /** A penalty never closes the gap past this: the jaws are at the tail, one stumble from shut. */
      danger: 36,
      creepPerSecond: 18,
      recoverPerSecond: 28,
      dodgeReward: 105,
      hitPenalty: 160,
      rockPenalty: 120,
      /** How hard the kraken corrects towards the gap it wants, in px/s per px of error. */
      gain: 2.2,
      maxClosing: 420,
      maxFallBack: 150,
    },
    /** Now and then the kraken throws itself forward, whatever the fish is doing. */
    surge: {
      everyMs: { min: 7000, max: 11000 },
      distance: 110,
      shakeMs: 500,
      shakeIntensity: 0.008,
      volume: 0.25,
      rate: 1.6,
    },
    /** Pacing of the arm strikes along the tunnel; a single lash is described under `tentacle.strike`. */
    strikes: {
      initialDelayMs: 2600,
      retryMs: 400,
      maxActive: 2,
      /** Time between strikes: the closer the kraken, the faster they come. */
      intervalMs: { near: { min: 1300, max: 1800 }, far: { min: 2200, max: 2900 } },
      /** Deeper into the tunnel a strike is often followed by a second one. */
      pair: { fromWorldX: 4000, chance: 0.7, delayMs: 720 },
      startWorldX: 1500,
      endWorldX: 11000,
      /** The aim is where the fish will be when the arm lands if it simply keeps its lane. */
      leadMs: 700,
      /** No strike is aimed this close before or after a rock spike. */
      rockClearance: { before: 240, after: 260 },
      /** The first strikes spell out which way to dodge. */
      hintCount: 2,
    },
    hints: {
      hunt: 'Outrun the kraken: every arm you dodge throws it back',
      rock: 'The rocks are solid: weave around them',
      refuge: 'A crack in the rock ahead: squeeze in!',
    },
    biteVolume: 0.5,
    /** The crack in the rock that ends the chase: wide enough for a blobfish, not for a kraken. */
    refuge: {
      wallX: 11250,
      width: 760,
      height: 720,
      halfGap: 76,
      funnel: 190,
      pad: 48,
      seed: 2203,
      /** The roof of the crack, its mouth as [share of the funnel, rise], and the face above it. */
      roof: { step: 110, wave: 6 },
      mouth: [[0.55, 28], [0.2, 82], [0, 165]] as [number, number][],
      mouthJitter: 12,
      face: { from: 260, step: { min: 90, max: 140 }, jag: 24 },
      krakenMargin: 20,
      hintFromX: 10300,
      backdrop: '#0e110c',
      glow: { inset: 560, color: 0x7fd4ff, alpha: 0.4, scale: 2.4, lightRadius: 260, lightIntensity: 1.2 },
      ramShakeMs: 700,
      ramShakeIntensity: 0.02,
      ramVolume: 0.5,
      /** The fish drifts on into the crack at this share of its speed once it is safe. */
      coastSpeedFactor: 0.5,
      exitDelayMs: 3000,
    },
  },
  kraken: {
    mouthOffsetX: 200,
    mouthOffsetY: 150,
    mouthSize: { width: 300, height: 200 },
    /** From the mouth point to the fish at the moment the jaws touch it. */
    biteReach: 200,
    followFactorY: 0.34,
    wobbleSpeed: 0.005,
    wobbleAmount: 5,
    breathMs: 1700,
    breathAmount: 0.022,
    glow: { radius: 420, color: 0x88aacc, intensity: 1.35 },
    /** Offsets are measured from the sprite centre on the unflipped artwork. */
    eye: { offsetX: 18, offsetY: 6, color: 0xffd98a, scale: 0.85, alpha: 0.55, pulse: 0.2, pulseMs: 900 },
    /** The artwork has a see-through mouth; a dark throat behind it keeps the water out. */
    maw: { offsetX: 250, offsetY: 172, width: 380, height: 200, angle: 8, inner: '#0d0504', outer: '#2a0d0a' },
  },
  tentacle: {
    paint: {
      length: 512,
      thickness: 96,
      tipThickness: 12,
      outlineWidth: 7,
      suckers: 10,
      skin: '#2b291d',
      skinLight: '#3d3a29',
      outline: '#0b0b08',
      sucker: '#857b5d',
      suckerDark: '#3a3526',
    },
    points: 18,
    /** Arms that sway around the body between attacks; angles in degrees on the unflipped artwork. */
    idle: [
      { offsetX: 150, offsetY: -40, angle: -44, length: 430, width: 98, sway: 50, bend: 110, swayMs: 2300, phase: 0 },
      { offsetX: 40, offsetY: 300, angle: 24, length: 490, width: 106, sway: 56, bend: -90, swayMs: 2700, phase: 1.9 },
      { offsetX: -60, offsetY: 250, angle: 112, length: 410, width: 94, sway: 44, bend: 80, swayMs: 3100, phase: 3.4 },
      { offsetX: -150, offsetY: 120, angle: 172, length: 390, width: 90, sway: 46, bend: -70, swayMs: 2500, phase: 5.1 },
    ],
    idleCurl: 0.9,
    /**
     * The lashing arm leaves the body where one of the idle arms is rooted: above the head or
     * below the jaw, never through the mouth. Values are indexes into `idle`.
     */
    strikeRoot: { top: 0, bottom: 1 } as Record<TunnelSide, number>,
    /** One lash: how it is telegraphed, how it moves and what a hit costs. */
    strike: {
      warningMs: 560,
      strikeMs: 190,
      holdMs: 320,
      retractMs: 280,
      overshootX: 170,
      wallMargin: 20,
      /** Where along the arm the aimed spot sits, 0 at the body and 1 at the tip. */
      passAt: 0.6,
      width: 118,
      hitRadius: 44,
      hitSamples: 10,
      stunMs: 320,
      wobble: 14,
      wobbleMs: 240,
      warning: {
        color: 0xd9604a,
        width: 26,
        alpha: 0.3,
        samples: 14,
        pulseMs: 130,
        pulseFrom: 0.45,
        markerRadius: 46,
        ringWidth: 4,
        ringAlpha: 0.9,
        fillAlpha: 0.25,
      },
      hint: { up: '↑ Swim up', down: '↓ Swim down', gap: 16 },
      hitVolume: 0.35,
      shakeMs: 220,
      shakeIntensity: 0.014,
    },
  },
  /** Rendering and collision of the walls of a vertical level, for any level with a `shaft`. */
  shaft: {
    seed: 9173,
    sampleStep: 8,
    collisionStride: 2,
    overscan: 96,
    /** Deliberately not a power of two: those textures wrap, and the seams would bleed. */
    chunkHeight: 480,
    chunkPad: 200,
    /**
     * Wall artwork exists only around the camera: a chunk is painted once it comes within
     * `create` px of the view and dropped again beyond `drop`, which keeps a tall shaft from
     * holding tens of megabytes of texture it is not showing.
     */
    chunkWindow: { create: 600, drop: 1500 },
    outerPad: 40,
    edgeMargin: 12,
    fillerWidth: 3000,
    rightPhase: 2.4,
    /** Layered sine wobble as [period px, amplitude px]. */
    roughness: [[37, 8], [91, 7], [13.7, 3]] as [number, number][],
    ledgeShelf: 0.2,
    ledgeTip: 0.46,
    alcoveLip: 0.28,
    strata: { spacing: { min: 110, max: 230 }, steps: 12, reach: 1100, tilt: 0.08, wave: { min: 6, max: 16 }, waveLength: 70 },
    floorHeight: 76,
    floorStep: 24,
    /** Floor wobble as [period px, amplitude px, phase]. */
    floorWaves: [[83, 12, 0], [31, 4.8, 1.7]] as [number, number, number][],
    floorSeed: 977,
  },
  trench: {
    /** The readout moves in whole steps, so the label is not redrawn on every frame of a climb. */
    depthMeter: { surfaceMeters: 640, metersPerPx: 0.2, stepMeters: 5 },
    startHintDelayMs: 2600,
    /** Shown once each, as the fish first climbs past the depth. */
    hints: [
      { y: 10700, text: 'The only way is up: follow the glow' },
      { y: 9250, text: 'Anglers hunt by sight: hold SHIFT to sneak past their lures' },
      { y: 7760, text: 'These are blind but hear everything: sneak with SHIFT' },
      { y: 6460, text: 'The currents drag sideways: swim across them' },
      { y: 2480, text: 'Warm water rises here: let it lift you' },
    ] as DepthHint[],
    /** The warm vent on the trench floor: the only light the abyss has of its own. */
    vent: {
      x: 800,
      chimneyWidth: 190,
      chimneyHeight: 200,
      chimneyVariant: 2,
      /** Share of the chimney height at which the mouth sits, and how deep its base is sunk. */
      mouthAt: 0.86,
      sunk: 0.1,
      coreScale: 0.7,
      color: 0xff9a4a,
      coreColor: 0xffe2a8,
      glowScale: 2.6,
      glowPulse: 0.25,
      pulseMs: 1600,
      light: { radius: 380, intensity: 1.7, pulse: 0.5 },
      embers: { everyMs: 90, speed: { min: 60, max: 170 }, drift: 26, lifespanMs: 2300, scale: 0.32, alpha: 0.9 },
    },
    /** Leaving the neck is the end of the climb: the level is decided and the garden takes over. */
    arrival: {
      musicFadeMs: 1200,
      resultHoldMs: 2600,
      victoryVolume: 0.4,
    },
    garden: {
      plugY: 1565,
      plugPad: 30,
      ceilingY: 240,
      ceilingPush: 0.12,
      ceilingHint: 'No higher. Up there a blobfish comes apart',
      hint: 'Swim to the great coral',
      hintDelayMs: 2200,
      reachRadius: 300,
      timeoutMs: 26000,
      restOffset: { x: -340, y: 20 },
      settleMs: 2200,
      bobPx: 6,
      bobMs: 2400,
      updraft: { everyMs: 70, speed: { min: 70, max: 190 }, drift: 14, lifespanMs: 2200, scale: 0.28, alpha: 0.5, depth: 60 },
      skylight: {
        height: 1150,
        alpha: 0.5,
        color: '96, 168, 235',
        strength: 0.6,
        /** Not a power of two: such textures repeat, and the bright top would bleed into the bottom edge. */
        texture: { width: 480, height: 500 },
        fadeAt: 0.9,
        beams: { count: 4, color: '190, 225, 255', strength: 0.22, top: 18, bottom: 50, slant: 20, spread: 9, length: 0.8 },
      },
      motes: { everyMs: 130, speed: { min: 6, max: 22 }, drift: 8, lifespanMs: 6500, scale: { min: 0.03, max: 0.09 }, alpha: 0.85, top: 180, bottom: 1500 },
      glowAlpha: 0.32,
      glowScale: 1.5,
      sway: { degrees: { min: 1.2, max: 3.2 }, ms: { min: 2600, max: 4400 } },
      embed: 14,
      layout: [
        { kind: 'frond', palette: 1, x: 215, side: 'left', from: 590, to: 780, scale: 0.8 },
        { kind: 'branch', palette: 3, x: 330, side: 'left', from: 590, to: 780, scale: 0.7 },

        { kind: 'tubes', palette: 2, x: 1335, side: 'right', from: 350, to: 560, scale: 0.85 },
        { kind: 'branch', palette: 1, x: 1240, side: 'right', from: 350, to: 560, scale: 0.75, light: { radius: 240, intensity: 1.1 } },
        { kind: 'frond', palette: 3, x: 1410, side: 'right', from: 350, to: 560, scale: 0.7 },

        { kind: 'frond', palette: 1, x: 205, side: 'left', from: 1250, to: 1560, scale: 1 },
        { kind: 'branch', palette: 2, x: 335, side: 'left', from: 1250, to: 1560, scale: 1.05, light: { radius: 300, intensity: 1.3 } },
        { kind: 'tubes', palette: 3, x: 465, side: 'left', from: 1250, to: 1560, scale: 0.9 },
        { kind: 'frond', palette: 0, x: 560, side: 'left', from: 1250, to: 1560, scale: 0.65 },
        { kind: 'branch', palette: 0, x: 250, side: 'left', from: 1250, to: 1560, scale: 0.5, front: true },

        { kind: 'tubes', palette: 1, x: 1060, side: 'right', from: 1250, to: 1560, scale: 0.7 },
        { kind: 'frond', palette: 3, x: 1150, side: 'right', from: 1250, to: 1560, scale: 0.8 },
        { kind: 'tubes', palette: 2, x: 1395, side: 'right', from: 1250, to: 1560, scale: 0.9 },
        { kind: 'frond', palette: 1, x: 1440, side: 'right', from: 1250, to: 1560, scale: 0.6, front: true },

      ] as CoralPlacement[],
      /** The destination: the biggest coral of the garden, on the right shelf. */
      greatCoral: {
        kind: 'great', palette: 0, x: 1265, side: 'right', from: 1250, to: 1560, scale: 1,
        light: { radius: 460, intensity: 1.8 },
      } as CoralPlacement,
    },
    ending: {
      lines: [
        'A thousand metres down.',
        'Any higher, and a blobfish comes apart.',
        'But here, at last, there is light.',
      ],
      lineEveryMs: 2800,
      lineFadeMs: 1100,
      lineSpacing: 38,
      bottomMargin: 120,
      holdMs: 4200,
      skipAfterMs: 1800,
      zoom: 0.92,
      zoomMs: 6000,
      panOffset: { x: 120, y: 110 },
    },
    backdrop: {
      /** Painted at half size and shown at `tileScale`, which is what blurs it. */
      size: 512,
      tileScale: 2,
      waveAmplitude: { min: 4, max: 17 },
      seed: 311,
      base: '#1a222b',
      tones: ['#232d37', '#141a21', '#2a3540'],
      columns: 7,
      specks: 450,
    },
  },
  current: {
    /** Particle speed as a share of the water speed, so the drift reads without being a blur. */
    particleSpeed: 0.45,
    particleSpread: 12,
    particleLifeMs: 3200,
    particleEveryMs: 180,
  },
  coral: {
    seed: 6151,
    outline: '#0b1216',
    outlineWidth: 6,
    size: {
      branch: { width: 400, height: 360 },
      great: { width: 820, height: 700 },
      tubes: { width: 280, height: 230 },
      frond: { width: 240, height: 420 },
    } as Record<CoralKind, { width: number, height: number }>,
    branch: { depth: 4, minWidth: 7, trunk: 30, maxLean: 0.95 },
    great: { depth: 6, minWidth: 7, trunk: 46, maxLean: 1.05 },
    /** Corals fade into the dark towards their base, so the lit tips read as the glow. */
    shade: { color: '6, 18, 30', strength: 0.78, from: 0.3 },
    tubes: { count: 6, width: { min: 30, max: 46 } },
    frond: { blades: 4, rootSpread: 22, lean: 26, width: { min: 26, max: 40 } },
    palettes: [
      { body: '#dc7f8f', light: '#f2a9ab', tip: '#ffe6da', glow: 0xff8fa0 },
      { body: '#3fb5ab', light: '#74d6c8', tip: '#dcfff5', glow: 0x5fe0cf },
      { body: '#dba552', light: '#f0c67e', tip: '#fff2cc', glow: 0xffc070 },
      { body: '#8a7fe0', light: '#b0a6f4', tip: '#ebe6ff', glow: 0xa596ff },
    ],
  },
  hud: {
    title: { fadeMs: 700, holdMs: 1500 },
    /** Fade of every HUD text, and how long a timed hint stays up. */
    fadeMs: 400,
    hintHoldMs: 5500,
  },
  records: {
    resultToastMs: 1600,
    storageKey: 'ad-light:progress:v1',
  },
  levels: {
    1: {
      width: 5000,
      title: 'Dim Waters',
      goal: { type: 'collect' },
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
      title: 'The Dark',
      goal: { type: 'collect' },
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
      title: 'The Kraken',
      music: ['gameMusic3'],
      // Well inside the crack of the refuge, past the rock face at chase.refuge.wallX.
      goal: { type: 'reach', x: 11600 },
      lighting: {
        ambientColor: 0x3a4a8a,
        fuelStart: 100,
        drainMultiplier: 0.35,
        radiusMultiplier: 1.2,
      },
      textures: {
        backgroundFar: 'level3BgFar',
        background: 'level3Bg',
      },
      enemies: [],
      mollusks: {
        count: 0,
      },
      rocks: [
        { x: 1700, width: 300, side: 'top' },
        { x: 2900, width: 280, side: 'bottom' },
        { x: 4100, width: 260, side: 'top' },
        { x: 4700, width: 260, side: 'bottom' },
        { x: 5600, width: 320, side: 'top' },
        { x: 6800, width: 300, side: 'bottom' },
        { x: 7900, width: 280, side: 'top' },
        { x: 8500, width: 260, side: 'bottom' },
        { x: 9400, width: 300, side: 'top' },
        { x: 10400, width: 280, side: 'bottom' },
      ],
    },
    4: {
      width: 1600,
      height: 11000,
      orientation: 'vertical',
      title: 'The Trench',
      music: ['gameMusic2'],
      // The top of the neck, where the shaft opens into the coral garden.
      goal: { type: 'reach', y: 1500 },
      // On the trench floor, beside the vent.
      spawn: { x: 620, y: 10600 },
      lighting: { fuelStart: 100 },
      depthProfile: [
        { y: 0, ambient: 0x3f6f9c, drain: 0 },
        { y: 1500, ambient: 0x2c5682, drain: 0 },
        { y: 1950, ambient: 0x14265a, drain: 1 },
        { y: 2500, ambient: 0x1a2a6c, drain: 1 },
        { y: 9300, ambient: 0x05070d, drain: 1.5 },
        { y: 11000, ambient: 0x020305, drain: 1.6 },
      ],
      currentZones: [
        // The neck: warm water rising into the garden.
        { y: 1560, height: 780, forceY: -150 },
        { y: 5300, height: 500, forceX: 110 },
        { y: 5950, height: 500, forceX: -120 },
      ],
      textures: {
        backgroundFar: 'trenchBackdrop',
      },
      shaft: {
        left: [
          // Coral garden with a shelf that funnels into the neck.
          [0, 150], [500, 120], [1000, 170], [1330, 150], [1420, 500], [1520, 640], [1700, 660],
          [2200, 650],
          // Opening chamber.
          [2360, 260], [2500, 170], [4000, 170],
          // Jellyfish chimney.
          [4180, 540], [5000, 540], [5180, 190],
          [7800, 190],
          // The squeeze: a narrow channel that snakes left and back.
          [7960, 700], [8200, 700], [8520, 380], [8760, 380], [9080, 720], [9180, 720],
          // The abyss.
          [9340, 170], [10300, 160], [11000, 230],
        ],
        right: [
          [0, 160], [600, 120], [1100, 160], [1340, 160], [1430, 520], [1530, 650], [1700, 660],
          [2200, 650],
          [2360, 280], [2500, 190], [4000, 180],
          [4180, 540], [5000, 540], [5180, 180],
          [7800, 180],
          [7960, 550], [8200, 550], [8520, 870], [8760, 870], [9080, 530], [9180, 530],
          [9340, 170], [10300, 160], [11000, 230],
        ],
        ledges: [
          { side: 'left', y: 640, height: 170, reach: 400 },
          { side: 'right', y: 400, height: 170, reach: 420 },

          // Long shelves turn the climb into a serpentine: every gap is on the far side.
          { side: 'left', y: 3020, height: 240, reach: 1120 },
          { side: 'right', y: 3500, height: 240, reach: 1150 },

          { side: 'right', y: 5540, height: 210, reach: 1000 },
          { side: 'left', y: 6070, height: 210, reach: 1000 },

          { side: 'right', y: 6620, height: 200, reach: 1100 },
          { side: 'left', y: 7020, height: 200, reach: 1100 },
          { side: 'right', y: 7420, height: 200, reach: 1100 },
        ],
        alcoves: [
          { side: 'left', y: 8000, height: 190, reach: 430 },
          { side: 'right', y: 8560, height: 190, reach: 590 },
        ],
      },
      enemies: [
        {
          kind: 'jellyfish',
          at: [
            { x: 880, y: 3390 },
            { x: 690, y: 4300 }, { x: 910, y: 4500 }, { x: 700, y: 4700 }, { x: 920, y: 4900 },
            { x: 320, y: 5650 }, { x: 820, y: 5910 }, { x: 1290, y: 6180 }, { x: 520, y: 6430 },
            { x: 420, y: 9620 }, { x: 1180, y: 9860 }, { x: 860, y: 10220 },
          ],
        },
        {
          kind: 'swallowtail',
          at: [{ x: 820, y: 6920 }, { x: 760, y: 7320 }, { x: 560, y: 7710 }],
        },
        {
          kind: 'anglerFish',
          at: [{ x: 600, y: 8095 }, { x: 800, y: 8655 }],
        },
      ],
      mollusks: {
        nests: [
          { x: 1010, y: 2900, count: 3 },
          { x: 620, y: 3390, count: 2 },
          { x: 800, y: 5160, count: 3 },
          // Pockets above the shelves: the current carries you in and has to be fought on the way out.
          { x: 1240, y: 5440, count: 2 },
          { x: 380, y: 5980, count: 3 },
          { x: 1080, y: 6930, count: 2 },
          { x: 520, y: 7330, count: 2 },
          { x: 740, y: 8095, count: 1 },
          { x: 660, y: 8655, count: 1 },
          { x: 800, y: 9460, count: 2 },
          { x: 520, y: 9960, count: 2 },
          { x: 1080, y: 10360, count: 2 },
        ],
      },
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
