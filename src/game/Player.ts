import Phaser from 'phaser';
import { MovementController } from './MovementController';
import { BubbleEmitter } from './BubbleEmitter';
import { config } from '../config';

export class Player {
  private readonly healthMax: number = config.player.maxHealth;
  private readonly lightRadius: number = config.player.lightRadius;
  private readonly speed: number = config.player.speed;
  private readonly idleRotationDeg: number = 2;
  private readonly idleDuration: number = 1800;
  private readonly scene: Phaser.Scene;
  private sprite: Phaser.Physics.Arcade.Sprite;
  private light: Phaser.GameObjects.Light;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private idleTween?: Phaser.Tweens.Tween;
  private movementController!: MovementController;
  private bubbleEmitter!: BubbleEmitter;
  private wasMovingLastFrame = false;
  private isInvulnerable = false;
  private pulseTime = 0;
  private health = 0;
  private alive = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.health = this.healthMax;
    this.createSprite();
    this.createInput();
    this.bubbleEmitter = new BubbleEmitter(this.scene, this.sprite);
    this.movementController = new MovementController(this.sprite, this.cursors);
  }

  private createSprite() {
    this.sprite = this.scene.physics.add.sprite(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      'player'
    ).setCollideWorldBounds(true)
      .setDamping(true)
      .setDrag(0.25)
      .setMaxVelocity(this.speed);

    this.sprite.setSize(100, 56);
    this.sprite.setPipeline('Light2D');

    this.light = this.scene.lights.addLight(
      this.sprite.x,
      this.sprite.y,
      this.lightRadius,
      0xcff1ff,
      2
    );

    this.setHealth(this.healthMax);
  }

  private createInput() {
    this.cursors = this.scene.input.keyboard.createCursorKeys();
  }

  update(time: number, delta: number) {
    if (!this.alive) return;

    const isInputActive = this.movementController.isInputActive();
    const isMoving = this.movementController.isMoving(this.speed / 10);

    if (isInputActive && !this.wasMovingLastFrame) {
      this.bubbleEmitter.emitBurst();
    }

    this.movementController.update(this.speed);
    this.handleAnimations(isMoving);

    this.wasMovingLastFrame = isInputActive;

    this.updateLight();
  }

  private handleAnimations(isMoving: boolean) {
    if (isMoving) {
      if (!this.sprite.anims.isPlaying || this.sprite.anims.getName() !== 'swim') {
        this.sprite.play('swim', true);
      }
      this.stopIdleTween();
    } else {
      if (this.sprite.anims.isPlaying) {
        this.sprite.stop();
        this.sprite.setFrame(1);
      }
      this.startIdleTween();
    }
  }

  private startIdleTween() {
    if (this.idleTween) return;
    this.idleTween = this.scene.tweens.add({
      targets: this.sprite,
      rotation: { from: Phaser.Math.DegToRad(-this.idleRotationDeg), to: Phaser.Math.DegToRad(this.idleRotationDeg) },
      yoyo: true,
      repeat: -1,
      duration: this.idleDuration,
      ease: 'Sine.easeInOut'
    });
  }

  private stopIdleTween() {
    this.idleTween?.stop();
    this.idleTween = undefined;
    this.sprite.rotation = 0;
  }

  private updateLight() {
    this.light.x = this.sprite.x;
    this.light.y = this.sprite.y;
    this.pulseTime += 0.02;
    this.light.intensity = 2.5 + Math.sin(this.pulseTime) * 0.5;
  }

  getSprite() {
    return this.sprite;
  }

  getHealth() {
    return this.health;
  }

  setHealth(health: number) {
    this.health = Math.max(0, Math.min(this.healthMax, health));
  }

  isAlive() {
    return this.alive;
  }

  canInvulnerable() {
    return this.isInvulnerable;
  }

  takeDamage(amount: number = 1) {
    if (!this.alive || this.isInvulnerable) return;

    this.setHealth(this.health - amount);

    if (this.health <= 0) {
      this.die();
    } else {
      const fishSound = this.scene.sound.add('fishBubble');
      fishSound.play();
      this.becomeInvulnerable();
    }
  }

  private becomeInvulnerable() {
    this.isInvulnerable = true;

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0 },
      duration: 100,
      yoyo: true,
      repeat: 5,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.isInvulnerable = false;
        this.sprite.setAlpha(1);
      }
    });
  }

  die() {
    const bubbleSound = this.scene.sound.add('fishBubble', { volume: 1 });
    this.alive = false;
    this.movementController.disable();
    this.sprite.stop();
    this.stopIdleTween();
    this.bubbleEmitter.stop();

    this.sprite.setTexture('fishBone');
    this.sprite.setTint(0x666666);

    this.sprite.setFlipY(true);
    (this.sprite.body as Phaser.Physics.Arcade.Body).allowGravity = true;
    this.sprite.setDrag(0.98);
    this.sprite.setAngularVelocity(Phaser.Math.Between(-30, 30));
    this.sprite.setVelocity(
      Phaser.Math.Between(-30, 30),
      Phaser.Math.Between(20, 60)
    );
    this.createDeathParticles();

    this.scene.time.delayedCall(700, () => {
      bubbleSound.play();
    })

    this.scene.events.emit('player-died');
  }

  private createDeathParticles() {
    const particles = this.scene.add.particles(this.sprite.x, this.sprite.y, 'bubbleParticle', {
      lifespan: 1500,
      speed: { min: 30, max: 80 },
      angle: { min: 220, max: 320 },
      scale: { start: 0.3, end: 1 },
      alpha: { start: 1, end: 0 },
      gravityY: -50,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    });

    particles.explode(20);
  }
}
