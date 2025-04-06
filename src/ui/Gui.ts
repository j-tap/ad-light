import Phaser from 'phaser'

export class GUI {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createButton(x: number, y: number, label: string, onClick: () => void) {
    const btnWidth = 220;
    const btnHeight = 80;

    const background = this.scene.add.image(0, 0, 'btn')
      .setDisplaySize(btnWidth, btnHeight)
      .setInteractive()
      .setOrigin(0.5);

    return (this.scene as any).rexUI.add.label({
      x,
      y,
      width: btnWidth,
      height: btnHeight,
      align: 'center',
      background,
      text: this.scene.add.text(0, 0, label, {fontSize: '24px', color: '#dcdcdc'}),
      space: {left: 10, right: 10, top: 10, bottom: 10}
    })
      .layout()
      .setInteractive({useHandCursor: true})
      .on('pointerdown', onClick)
      .on('pointerover', () => {
        background.setTint(0xcccccc);
      })
      .on('pointerout', () => {
        background.clearTint();
      });
  }

  createText() {
    //
  }

  createFullscreenBackground(
    textureKey: string, align: 'center' | 'top' | 'bottom' = 'center'
  ) {
    const bg = this.scene.add.image(this.scene.scale.width / 2, this.scene.scale.height / 2, textureKey)
      .setOrigin(0.5)
      .setScrollFactor(0);

    const scaleX = this.scene.scale.width / bg.width;
    const scaleY = this.scene.scale.height / bg.height;
    const scale = Math.max(scaleX, scaleY);

    bg.setScale(scale);

    (bg as any).bgAlignType = align;

    this.updateBackgroundPosition(bg);

    return bg;
  }

  resizeFullscreenBackground(bg: Phaser.GameObjects.Image) {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const scale = Math.max(scaleX, scaleY);

    bg.setScale(scale);

    this.updateBackgroundPosition(bg);
  }

  private updateBackgroundPosition(bg: Phaser.GameObjects.Image) {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const align = (bg as any).bgAlignType;

    if (align === 'bottom') {
      bg.setPosition(width / 2, height - (bg.height * bg.scaleY) / 2);
    } else if (align === 'top') {
      bg.setPosition(width / 2, (bg.height * bg.scaleY) / 2);
    } else { // center
      bg.setPosition(width / 2, height / 2);
    }
  }
}
