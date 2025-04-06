import Phaser from 'phaser';
import { phaserConfig } from './config';
import BootScene from './scenes/BootScene';
import PreloadScene from './scenes/PreloadScene';
import StartScene from './scenes/StartScene';
import GameScene from './scenes/GameScene';
import PauseScene from './scenes/PauseScene';
import GameOverScene from './scenes/GameOverScene';
import WinScene from './scenes/WinScene';
import EndScene from './scenes/EndScene';

const levels = Object.values(
  import.meta.glob('./scenes/levels/*.ts', { eager: true })
).map((mod: any) => mod.default);

phaserConfig.scene = [
  BootScene,
  PreloadScene,
  StartScene,
  GameScene,
  PauseScene,
  GameOverScene,
  WinScene,
  EndScene,
  ...levels,
];

new Phaser.Game(phaserConfig);
