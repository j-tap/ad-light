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
  private readonly waveInterval: number = 300;
  private readonly waveTexture = 'waveTexture';
  private readonly scene: Phaser.Scene;
  private sprite: Phaser.Physics.Arcade.Sprite;
  private light: Phaser.GameObjects.Light;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private idleTween?: Phaser.Tweens.Tween;
  private movementController!: MovementController;
  private bubbleEmitter!: BubbleEmitter;
  private isWaveTextureCreated = false;
  private wasMovingLastFrame = false;
  private isInvulnerable = false;
  private alive = true;
  private moveWaveTimer = 0;
  private pulseTime = 0;
  private health = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.health = this.healthMax;
    this.createSprite();
    this.createInput();
    this.bubbleEmitter = new BubbleEmitter(this.scene, this.sprite);
    this.movementController = new MovementController(this.sprite, this.cursors);
  }

  update(time: number, delta: number) {
    if (!this.alive) return;

    this.moveWaveTimer += delta;

    const isInputActive = this.movementController.isInputActive();
    const isMoving = this.isMoving(this.speed / 3.3);

    if (isInputActive && !this.wasMovingLastFrame) {
      this.bubbleEmitter.emitBurst();
    }

    if (isMoving && this.moveWaveTimer >= this.waveInterval) {
      this.moveWaveTimer = 0;
      this.createMoveWave();
    }

    this.movementController.update(this.speed);
    this.handleAnimations(isMoving);

    this.wasMovingLastFrame = isInputActive;

    this.updateLight();
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

  setInvulnerable(value:boolean = true) {
    this.isInvulnerable = value;
  }

  isAlive() {
    return this.alive;
  }

  isMoving(threshold: number) {
    return this.movementController.isMoving(threshold)
  }

  canInvulnerable() {
    return this.isInvulnerable;
  }

  takeDamage(amount: number = 1) {
    if (!this.alive || this.isInvulnerable) return;

    this.setHealth(Math.max(0, this.health - amount));

    if (this.health <= 0) {
      this.scene.time.delayedCall(0, () => {
        this.die();
      })
    } else {
      this.scene.sound.add('fishBubble').play();
      this.becomeInvulnerable();
    }
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

    this.createTextures()
    this.setHealth(this.healthMax);

    this.scene.events.on('player-move-start', (direction: string | null) => {
      //
    });
  }

  private createInput() {
    this.cursors = this.scene.input.keyboard.createCursorKeys();
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

  private createMoveWave() {
    if (!this.isWaveTextureCreated) {
      const wave = this.scene.add.graphics();
      wave.fillStyle(0x88CCEE, 0.5);
      const outerWidth = 60;
      const outerHeight = 30;
      const innerWidth = 48;
      const innerHeight = 24;
      const centerX = 30;
      const centerY = 30;
      wave.beginPath();
      wave.fillEllipse(centerX, centerY, outerWidth, outerHeight);
      wave.beginPath();
      wave.fillStyle(0x000000, 1);
      wave.fillEllipse(centerX, centerY, innerWidth, innerHeight);
      wave.closePath();
      wave.generateTexture(this.waveTexture, 60, 30);
      wave.destroy();
      this.isWaveTextureCreated = true;
    }

    const velocityX = this.sprite.body.velocity.x;
    const velocityY = this.sprite.body.velocity.y;

    let angle = 0;

    if (Math.abs(velocityX) > Math.abs(velocityY)) {
      angle = velocityX > 0 ? 270 : 90;
    } else {
      angle = velocityY > 0 ? 0 : 180;
    }

    const sprite = this.scene.add.image(this.sprite.x, this.sprite.y, this.waveTexture)
      .setOrigin(0.5)
      .setAlpha(0.4)
      .setScale(0.1)
      .setDepth(5)
      .setAngle(angle);

    sprite.postFX.addBlur(10);

    this.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      scale: 2.5,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => sprite.destroy()
    });
  }

  private createDeathParticles() {
    const particles = this.scene.add.particles(this.sprite.x, this.sprite.y, 'bones', {
      lifespan: 5000,
      speed: { min: 10, max: 40 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.3, end: 1 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      gravityY: 20,
      delay: { min: 0, max: 100 },
      blendMode: Phaser.BlendModes.ADD
    });

    particles.explode(15);
  }

  private createTextures() {
    const bone = this.scene.add.graphics();
    bone.fillStyle(0xffffff, 1);

    const width = 6;
    const height = 18;
    const points = [
      { x: width / 2, y: 0 },
      { x: 0, y: height },
      { x: width, y: height },
    ];

    bone.beginPath();
    bone.fillPoints(points, true);
    bone.closePath();
    bone.setAlpha(.3)
    bone.generateTexture('bones', width, height);
    bone.destroy();
  }
}
