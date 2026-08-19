import GameScene from '../GameScene';
import { config } from '../../config';

export default class Level1Scene extends GameScene {
  constructor() {
    super('Level1Scene', config.levels[1]);
  }
}
