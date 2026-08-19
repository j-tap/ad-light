import Phaser from 'phaser';

export class MovementController {
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly keys: Phaser.Input.Keyboard.Key[][];
  private readonly touchVector = new Phaser.Math.Vector2(0, 0);
  private readonly direction = new Phaser.Math.Vector2(0, 0);
  private enabled = true;

  constructor(sprite: Phaser.Physics.Arcade.Sprite) {
    this.sprite = sprite;

    const keyboard = sprite.scene.input.keyboard;
    const Codes = Phaser.Input.Keyboard.KeyCodes;

    this.keys = [
      [Codes.LEFT, Codes.A],
      [Codes.RIGHT, Codes.D],
      [Codes.UP, Codes.W],
      [Codes.DOWN, Codes.S],
    ].map(codes => codes.map(code => keyboard.addKey(code)));

    this.createTouchControls();
  }

  update(speed: number) {
    if (!this.enabled) return;

    const direction = this.getInputDirection();

    if (direction.lengthSq() === 0) return;

    this.sprite.setVelocity(direction.x * speed, direction.y * speed);

    if (direction.x !== 0) {
      this.sprite.setFlipX(direction.x < 0);
    }
  }

  isMoving(threshold = 1): boolean {
    const body = this.sprite.body;

    return body
      ? Math.abs(body.velocity.x) > threshold || Math.abs(body.velocity.y) > threshold
      : false;
  }

  isInputActive(): boolean {
    return this.enabled && this.getInputDirection().lengthSq() > 0;
  }

  disable() {
    this.enabled = false;
    this.touchVector.set(0, 0);
  }

  /** Normalized so diagonal input does not move faster than a single axis. */
  private getInputDirection(): Phaser.Math.Vector2 {
    const [left, right, up, down] = this.keys;
    const direction = this.direction.set(0, 0);

    if (this.isGroupDown(left)) direction.x -= 1;
    if (this.isGroupDown(right)) direction.x += 1;
    if (this.isGroupDown(up)) direction.y -= 1;
    if (this.isGroupDown(down)) direction.y += 1;

    if (direction.lengthSq() === 0) {
      return direction.copy(this.touchVector);
    }

    return direction.normalize();
  }

  private isGroupDown(keys: Phaser.Input.Keyboard.Key[]) {
    return keys.some(key => key.isDown);
  }

  private createTouchControls() {
    const input = this.sprite.scene.input;

    input.on(Phaser.Input.Events.POINTER_DOWN, this.updateTouchDirection, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.updateTouchDirection, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.resetTouchDirection, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.resetTouchDirection, this);
  }

  private updateTouchDirection(pointer: Phaser.Input.Pointer) {
    if (!pointer.isDown) return;

    this.touchVector
      .set(pointer.worldX - this.sprite.x, pointer.worldY - this.sprite.y)
      .normalize();
  }

  private resetTouchDirection() {
    this.touchVector.set(0, 0);
  }
}
