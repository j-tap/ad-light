import Phaser from 'phaser';
import Label from 'phaser3-rex-plugins/templates/ui/label/Label';

export type BackgroundAlign = 'center' | 'top' | 'bottom';

const ALIGN_KEY = 'bgAlign';
const BUTTON_WIDTH = 220;
const BUTTON_HEIGHT = 80;

export class GUI {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createButton(x: number, y: number, label: string, onClick: () => void): Label {
    const background = this.scene.add.image(0, 0, 'btn')
      .setDisplaySize(BUTTON_WIDTH, BUTTON_HEIGHT)
      .setOrigin(0.5);

    const button = new Label(this.scene, {
      x,
      y,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      align: 'center',
      background,
      text: this.scene.add.text(0, 0, label, { fontSize: '24px', color: '#dcdcdc' }),
      space: { left: 10, right: 10, top: 10, bottom: 10 },
    });

    this.scene.add.existing(button);

    return button
      .layout()
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick)
      .on('pointerover', () => background.setTint(0xcccccc))
      .on('pointerout', () => background.clearTint()) as Label;
  }

  createFullscreenBackground(textureKey: string, align: BackgroundAlign = 'center') {
    const background = this.scene.add.image(0, 0, textureKey)
      .setOrigin(0.5)
      .setScrollFactor(0);

    background.setData(ALIGN_KEY, align);
    this.resizeFullscreenBackground(background);

    return background;
  }

  resizeFullscreenBackground(background: Phaser.GameObjects.Image) {
    const { width, height } = this.scene.scale;

    background.setScale(Math.max(width / background.width, height / background.height));

    switch (background.getData(ALIGN_KEY) as BackgroundAlign) {
      case 'top':
        background.setPosition(width / 2, background.displayHeight / 2);
        break;
      case 'bottom':
        background.setPosition(width / 2, height - background.displayHeight / 2);
        break;
      default:
        background.setPosition(width / 2, height / 2);
    }
  }
}
