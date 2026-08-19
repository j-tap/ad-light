import GameScene from '../GameScene';
import { config } from '../../config';

export default class Level4Scene extends GameScene {
  constructor() {
    super('Level4Scene', config.levels[4]);
  }
}
