import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';

export const config = {
  player: {
    maxHealth: 1,
    speed: 260,
    lightRadius: 350,
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
      enemyCount: 6,
      molluskCount: 5,
      width: 5000,
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
      fps: 60,
      timeScale: 1,
      fixedStep: true,
      useTree: true,
      debug: false,
    },
  },
  fps: {
    target: 60,
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
