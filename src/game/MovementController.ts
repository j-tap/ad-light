import Phaser from 'phaser';

export class MovementController {
  private keys: { [key: string]: Phaser.Input.Keyboard.Key };
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private sprite: Phaser.Physics.Arcade.Sprite;

  private touchVector = new Phaser.Math.Vector2(0, 0);

  constructor(sprite: Phaser.Physics.Arcade.Sprite, cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    this.sprite = sprite;
    this.cursors = cursors;

    this.keys = {
      left: cursors.left,
      right: cursors.right,
      up: cursors.up,
      down: cursors.down,
      moveLeft: sprite.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      moveRight: sprite.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      moveUp: sprite.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      moveDown: sprite.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    };

    this.createTouchControls();
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
    return (
      this.touchVector.length() > 0 ||
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

    if (left.isDown || moveLeft.isDown || this.touchVector.x < -0.2) {
      this.sprite.setVelocityX(-speed);
      this.sprite.setFlipX(true);
    } else if (right.isDown || moveRight.isDown || this.touchVector.x > 0.2) {
      this.sprite.setVelocityX(speed);
      this.sprite.setFlipX(false);
    } else {
      this.sprite.setVelocityX(this.sprite.body.velocity.x * 0.95);
    }
  }

  private handleVerticalMovement(speed: number) {
    const { up, down, moveUp, moveDown } = this.keys;

    if (up.isDown || moveUp.isDown || this.touchVector.y < -0.2) {
      this.sprite.setVelocityY(-speed);
    } else if (down.isDown || moveDown.isDown || this.touchVector.y > 0.2) {
      this.sprite.setVelocityY(speed);
    } else {
      this.sprite.setVelocityY(this.sprite.body.velocity.y * 0.95);
    }
  }

  private createTouchControls() {
    const scene = this.sprite.scene;

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.updateTouchDirection(pointer);
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        this.updateTouchDirection(pointer);
      }
    });

    scene.input.on('pointerup', () => {
      this.touchVector.set(0, 0);
    });
  }

  private updateTouchDirection(pointer: Phaser.Input.Pointer) {
    const sprite = this.sprite;
    this.touchVector.set(
      pointer.worldX - sprite.x,
      pointer.worldY - sprite.y
    ).normalize();
  }

  disable() {
    this.cursors = undefined as any;
    this.keys = {} as any;
    this.touchVector.set(0, 0);
  }
}
