import Phaser from 'phaser';
import { phaserConfig } from './config';
import BootScene from './scenes/BootScene';
import PreloadScene from './scenes/PreloadScene';
import StartScene from './scenes/StartScene';
import PauseScene from './scenes/PauseScene';
import GameOverScene from './scenes/GameOverScene';
import WinScene from './scenes/WinScene';
import EndScene from './scenes/EndScene';

type SceneModule = { default: new () => Phaser.Scene };

const levelScenes = Object.values(
  import.meta.glob<SceneModule>('./scenes/levels/*.ts', { eager: true })
).map(module => module.default);

phaserConfig.scene = [
  BootScene,
  PreloadScene,
  StartScene,
  PauseScene,
  GameOverScene,
  WinScene,
  EndScene,
  ...levelScenes,
];

new Phaser.Game(phaserConfig);
