import Phaser from 'phaser';
import { config } from './config';
import BootScene from './scenes/BootScene';
import PreloadScene from './scenes/PreloadScene';
import StartScene from './scenes/StartScene';
import GameScene from './scenes/GameScene';
import PauseScene from './scenes/PauseScene';
import EndScene from './scenes/EndScene';

config.scene = [BootScene, PreloadScene, StartScene, GameScene, PauseScene, EndScene];

new Phaser.Game(config);
