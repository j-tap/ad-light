import GameScene from '../GameScene';
import { config } from '../../config';

export default class Level2Scene extends GameScene {
  constructor() {
    super('Level2Scene', config.levels[2]);
  }
}
