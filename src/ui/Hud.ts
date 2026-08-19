import Phaser from 'phaser';
import { config } from '../config';

const DEPTH = 100;
const MARGIN = 20;
const HEART_SPACING = 40;
const HEART_ROW_Y = 70;

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly molluskText: Phaser.GameObjects.Text;
  private readonly hearts: Phaser.GameObjects.Text[] = [];
  private lastCollected = -1;
  private lastTotal = -1;
  private lastHealth = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.molluskText = this.scene.add.text(0, 0, '', {
      fontSize: '24px',
      color: '#dcdcdc',
      fontFamily: 'Arial',
    });

    for (let i = 0; i < config.player.maxHealth; i++) {
      this.hearts.push(this.scene.add.text(0, 0, '❤️', { fontSize: '32px' }).setAlpha(0.6));
    }

    this.elements().forEach(element => element.setScrollFactor(0).setDepth(DEPTH));
    this.layout();
  }

  setMollusks(collected: number, total: number) {
    if (collected === this.lastCollected && total === this.lastTotal) return;

    this.lastCollected = collected;
    this.lastTotal = total;
    this.molluskText.setText(`Mollusks: ${collected}/${total}`);
  }

  setHealth(health: number) {
    if (health === this.lastHealth) return;

    this.lastHealth = health;
    this.hearts.forEach((heart, index) => heart.setVisible(index < health));
  }

  layout() {
    this.molluskText.setPosition(MARGIN, MARGIN);
    this.hearts.forEach((heart, index) => {
      heart.setPosition(MARGIN + index * HEART_SPACING, HEART_ROW_Y);
    });
  }

  private elements(): Phaser.GameObjects.Text[] {
    return [this.molluskText, ...this.hearts];
  }
}
