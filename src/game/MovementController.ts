import Phaser from 'phaser';

export class MovementController {
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private touchVector = new Phaser.Math.Vector2(0, 0);
  private isMovingEvent = false;
  private keys: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(sprite: Phaser.Physics.Arcade.Sprite, cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    this.sprite = sprite;
    this.cursors = cursors;

    const input = sprite.scene.input.keyboard;
    this.keys = {
      left: cursors.left,
      right: cursors.right,
      up: cursors.up,
      down: cursors.down,
      moveLeft: input.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      moveRight: input.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      moveUp: input.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      moveDown: input.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    };

    this.createTouchControls();
  }

  update(speed: number) {
    if (!this.cursors) return;

    this.handleInputEvents();
    this.handleMovement(speed);
  }

  isMoving(threshold = 1): boolean {
    return this.sprite.body
      ? Math.abs(this.sprite.body.velocity.x) > threshold || Math.abs(this.sprite.body.velocity.y) > threshold
      : false;
  }

  isInputActive(): boolean {
    const k = this.keys;
    return (
      this.touchVector.length() > 0 ||
      k.left.isDown || k.right.isDown || k.up.isDown || k.down.isDown ||
      k.moveLeft.isDown || k.moveRight.isDown || k.moveUp.isDown || k.moveDown.isDown
    );
  }

  disable() {
    this.cursors = undefined as any;
    this.keys = {} as any;
    this.touchVector.set(0, 0);
  }

  private handleInputEvents() {
    const active = this.isInputActive();

    if (active && !this.isMovingEvent) {
      this.isMovingEvent = true;
      this.sprite.scene.events.emit('player-move-start', this.getDirection());
    } else if (!active && this.isMovingEvent) {
      this.isMovingEvent = false;
    }
  }

  private handleMovement(speed: number) {
    const { left, right, up, down, moveLeft, moveRight, moveUp, moveDown } = this.keys;

    if (left.isDown || moveLeft.isDown || this.touchVector.x < -0.2) {
      this.sprite.setVelocityX(-speed);
      this.sprite.setFlipX(true);
    } else if (right.isDown || moveRight.isDown || this.touchVector.x > 0.2) {
      this.sprite.setVelocityX(speed);
      this.sprite.setFlipX(false);
    }

    if (up.isDown || moveUp.isDown || this.touchVector.y < -0.2) {
      this.sprite.setVelocityY(-speed);
    } else if (down.isDown || moveDown.isDown || this.touchVector.y > 0.2) {
      this.sprite.setVelocityY(speed);
    }
  }

  private createTouchControls() {
    const scene = this.sprite.scene;

    scene.input.on('pointerdown', this.updateTouchDirection, this);
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) this.updateTouchDirection(pointer);
    });
    scene.input.on('pointerup', () => this.touchVector.set(0, 0));
  }

  private updateTouchDirection(pointer: Phaser.Input.Pointer) {
    this.touchVector.set(
      pointer.worldX - this.sprite.x,
      pointer.worldY - this.sprite.y
    ).normalize();
  }

  private getDirection(): 'left' | 'right' | 'up' | 'down' | null {
    const { left, right, up, down, moveLeft, moveRight, moveUp, moveDown } = this.keys;

    if (left.isDown || moveLeft.isDown || this.touchVector.x < -0.2) return 'left';
    if (right.isDown || moveRight.isDown || this.touchVector.x > 0.2) return 'right';
    if (up.isDown || moveUp.isDown || this.touchVector.y < -0.2) return 'up';
    if (down.isDown || moveDown.isDown || this.touchVector.y > 0.2) return 'down';

    return null;
  }
}
