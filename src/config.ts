import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';

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

export interface LevelConfig {
  width: number,
  enemies: EnemiesConfig,
  mollusks: MolluskConfig,
}

export interface GameConfig {
  player: {
    maxHealth: number,
    speed: number,
    lightRadius: number,
  },
  enemy: {
    anglerFish: {
      speed: number,
      lightRadius: number,
      distanceVision: number,
    }
  },
  mollusk: {
    lightRadius: number,
  },
  levels: {
    [key: number]: LevelConfig,
  }
}

export const VERSION = __APP_VERSION__;

export const config = {
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
      enemies: {
        count: 8,
      },
      mollusks: {
        count: 7,
      },
    },
    2: {
      width: 8000,
      enemies: {
        count: 12,
      },
      mollusks: {
        count: 15,
      },
    },
    3: {
      width: 12000,
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
  }
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
  },
  scene: [],
  plugins: {
    scene: [
      { key: 'rexUI', plugin: UIPlugin, mapping: 'rexUI' }
    ]
  },
  input: { mouse: true, touch: true, keyboard: true },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
}
