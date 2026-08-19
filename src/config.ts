import Phaser from 'phaser';

export interface EnemiesConfig {
  count: number,
}

export interface MolluskConfig {
  count: number,
  indent?: {
    top?: number,
    bottom?: number,
    left?: number,
    right?: number,
  },
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
  enemies: EnemiesConfig,
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
  player: {
    maxHealth: 3,
    speed: 260,
    lightRadius: 450,
  },
  enemy: {
    anglerFish: {
      speed: 100,
      lightRadius: 46,
      distanceVision: 300,
    }
  },
  mollusk: {
    lightRadius: 100,
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
      enemies: {
        count: 8,
      },
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
      enemies: {
        count: 12,
      },
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
      enemies: {
        count: 0,
      },
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
