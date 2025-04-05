import Phaser from 'phaser';

export class MovementController {
  private keys: { [key: string]: Phaser.Input.Keyboard.Key };

  constructor(private sprite: Phaser.Physics.Arcade.Sprite, private cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    this.keys = {
      left: this.cursors.left,
      right: this.cursors.right,
      up: this.cursors.up,
      down: this.cursors.down,
      moveLeft: this.sprite.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      moveRight: this.sprite.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      moveUp: this.sprite.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      moveDown: this.sprite.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    };
  }

  update(speed: number) {
    if (!this.cursors) return;

    this.handleHorizontalMovement(speed);
    this.handleVerticalMovement(speed);
  }

  isMoving(threshold: number): boolean {
    if (!this.sprite.body) return false;
    return Math.abs(this.sprite.body.velocity.x) > threshold || Math.abs(this.sprite.body.velocity.y) > threshold;
  }

  isInputActive(): boolean {
    if (!this.cursors) return false;
    return (
      this.keys.moveLeft.isDown ||
      this.keys.moveRight.isDown ||
      this.keys.moveUp.isDown ||
      this.keys.moveDown.isDown ||
      this.cursors.left.isDown ||
      this.cursors.right.isDown ||
      this.cursors.up.isDown ||
      this.cursors.down.isDown
    );
  }

  private handleHorizontalMovement(speed: number) {
    const { left, right, moveLeft, moveRight } = this.keys;

    if (left.isDown || moveLeft.isDown) {
      this.sprite.setVelocityX(-speed);
      this.sprite.setFlipX(true);
    } else if (right.isDown || moveRight.isDown) {
      this.sprite.setVelocityX(speed);
      this.sprite.setFlipX(false);
    } else {
      this.sprite.setVelocityX(this.sprite.body.velocity.x * 0.95);
    }
  }

  private handleVerticalMovement(speed: number) {
    const { up, down, moveUp, moveDown } = this.keys;

    if (up.isDown || moveUp.isDown) {
      this.sprite.setVelocityY(-speed);
    } else if (down.isDown || moveDown.isDown) {
      this.sprite.setVelocityY(speed);
    } else {
      this.sprite.setVelocityY(this.sprite.body.velocity.y * 0.95);
    }
  }

  disable() {
    this.cursors = undefined as any;
    this.keys = {} as any;
  }
}
