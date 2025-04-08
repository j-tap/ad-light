import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';

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
    lightRadius: 60,
  },
  levels: {
    1: {
      enemyCount: 8,
      molluskCount: 7,
      width: 5000,
    },
    2: {
      enemyCount: 12,
      molluskCount: 15,
      width: 8000,
    },
    3: {
      enemyCount: 0,
      molluskCount: 15,
      width: 12000,
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
