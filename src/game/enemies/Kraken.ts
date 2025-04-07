export class EnemyKraken {
  private scene: Phaser.Scene;
  private readonly sprite: Phaser.Physics.Arcade.Image;
  private readonly mouthCollider: Phaser.GameObjects.Rectangle;
  private readonly mouthOffsetX = 200;
  private readonly mouthOffsetY = 150;
  private speed = 0.016;
  private isHunting: boolean;
  private wobbleTime = 0;
  private wobbleSpeed = 0.005;
  private wobbleAmount = 5;


  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = this.createSprite(x, y);
    this.mouthCollider = this.createMouthCollider();
  }

  update(delta: number, playerX: number, playerY: number) {
    this.facePlayer(playerX);

    if (this.isHunting) {
      const mouthX = this.sprite.x + (this.sprite.flipX ? -this.mouthOffsetX : this.mouthOffsetX);
      const mouthY = this.sprite.y + this.mouthOffsetY;

      const dx = (playerX - mouthX) * this.speed;
      const dy = (playerY - mouthY) * this.speed * 20;

      this.sprite.x += dx;
      this.sprite.y += dy;
    }

    this.updateMouthCollider();
    this.applyWobble(delta);
  }

  getMouthCollider() {
    return this.mouthCollider;
  }

  setIsHunting(isHunting: boolean) {
    this.isHunting = isHunting;
  }

  private createSprite(x: number, y: number) {
    this.isHunting = false;

    const sprite = this.scene.physics.add.image(x, y, 'kraken')
      .setOrigin(0.5)
      .setImmovable(true)
      .setPipeline('Light2D');

    sprite.body.allowGravity = false;
    sprite.setSize(sprite.width / 2, sprite.height / 2);

    return sprite;
  }

  private createMouthCollider() {
    const rect = this.scene.add.rectangle(
      this.sprite.x,
      this.sprite.y,
      300,
      200,
      0xff0000,
      0
    );
    this.scene.physics.add.existing(rect);

    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setImmovable(true);

    return rect;
  }

  private updateMouthCollider() {
    const offsetX = this.sprite.flipX ? -this.mouthOffsetX : this.mouthOffsetX;
    this.mouthCollider.setPosition(
      this.sprite.x + offsetX,
      this.sprite.y + this.mouthOffsetY
    );

    const body = this.mouthCollider.body as Phaser.Physics.Arcade.Body;
    // body.setOffset(this.sprite.flipX ? -180 : 180, 150);
  }

  private facePlayer(playerX: number) {
    const distanceX = playerX - this.sprite.x;
    if (Math.abs(distanceX) > 30) {
      this.sprite.setFlipX(distanceX < 0);
    }
  }

  private applyWobble(delta: number) {
    this.wobbleTime += delta;

    const angle = Math.sin(this.wobbleTime * this.wobbleSpeed) * this.wobbleAmount;
    this.sprite.setAngle(angle);
  }

  getSprite() {
    return this.sprite;
  }
}