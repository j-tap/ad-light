import Phaser from 'phaser';
import { MovementController } from './MovementController';
import { BubbleEmitter } from './BubbleEmitter';
import { LightFuel } from './systems/LightFuel';
import { NoiseField } from './systems/NoiseField';
import { Terrain } from './systems/Terrain';
import { ensureTexture } from './textures';
import { config, REFERENCE_FRAME_MS, LevelLighting, Point } from '../config';

const WAVE_TEXTURE = 'waveTexture';
const BONE_TEXTURE = 'bones';

const lightSettings = config.player.light;
/** The fish is kept out of rock as two circles, one towards each end of its body. */
const TERRAIN_OFFSETS = [-config.terrain.playerSpread, config.terrain.playerSpread];

export class Player {
  private readonly healthMax: number = config.player.maxHealth;
  private readonly speed: number = config.player.speed;
  private readonly idleRotationDeg: number = 2;
  private readonly idleDuration: number = 1800;
  private readonly waveInterval: number = 300;
  private readonly scene: Phaser.Scene;
  private readonly noiseField: NoiseField;
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly light: Phaser.GameObjects.Light;
  private readonly lightFuel = new LightFuel();
  private readonly movementController: MovementController;
  private readonly bubbleEmitter: BubbleEmitter;
  private readonly sneakKey?: Phaser.Input.Keyboard.Key;
  private idleTween?: Phaser.Tweens.Tween;
  private wasMovingLastFrame = false;
  private blinking = false;
  private shielded = false;
  private scripted = false;
  private alive = true;
  private moveWaveTimer = 0;
  private darknessTimer = 0;
  private pulseTime = 0;
  private lightDrainMultiplier = 1;
  private stunEndTime = 0;
  private health: number;

  constructor(scene: Phaser.Scene, noiseField: NoiseField, spawn: Point) {
    this.scene = scene;
    this.noiseField = noiseField;
    this.health = this.healthMax;
    this.sprite = this.createSprite(spawn.x, spawn.y);
    this.light = this.createLight();
    this.bubbleEmitter = new BubbleEmitter(this.scene, this.sprite);
    this.movementController = new MovementController(this.sprite);
    this.sneakKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.createTextures();
  }

  update(delta: number) {
    if (!this.alive) return;

    this.moveWaveTimer += delta;

    const isInputActive = this.movementController.isInputActive();
    const isMoving = this.isMoving(config.player.movingThreshold);
    const sneaking = this.isSneaking();

    if (isInputActive && !this.wasMovingLastFrame) {
      this.bubbleEmitter.emitBurst();
    }

    // A sneaking fish leaves no ripples, and the ripples are the noise hunters hear.
    if (isMoving && !sneaking && this.moveWaveTimer >= this.waveInterval) {
      this.moveWaveTimer = 0;
      this.createMoveWave();
    }

    if (this.isStunned()) {
      this.sprite.setVelocity(0, 0);
      this.handleAnimations(false);
    } else {
      this.movementController.update(sneaking ? this.speed * config.player.sneakSpeedFactor : this.speed);
      this.handleAnimations(isMoving);
    }

    this.wasMovingLastFrame = isInputActive;

    this.lightFuel.update(delta, sneaking, this.lightDrainMultiplier);
    this.updateLight(delta);
    this.updateDarknessPressure(delta);
  }

  /**
   * Hands the fish over to a cutscene for good: input and physics are switched off and it
   * passes through rock, while the light keeps running through updateScripted.
   */
  beginScripted() {
    this.scripted = true;
    this.movementController.disable();
    this.sprite.setVelocity(0, 0);
    (this.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.stopIdleTween();
  }

  updateScripted(delta: number) {
    if (this.sprite.anims.isPlaying) {
      this.sprite.stop();
      this.sprite.setFrame(1);
    }

    this.lightFuel.update(delta, false, this.lightDrainMultiplier);
    this.updateLight(delta);
  }

  isScripted() {
    return this.scripted;
  }

  /** Pushes the fish out of solid rock and returns how hard it ran into it, in px/s. */
  resolveTerrain(terrain: Terrain) {
    const { playerRadius } = config.terrain;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    let impact = 0;

    for (const offset of TERRAIN_OFFSETS) {
      const contact = terrain.resolveCircle(this.sprite.x + offset, this.sprite.y, playerRadius);

      if (!contact.hit) continue;

      this.sprite.setPosition(contact.x - offset, contact.y);

      const into = -(body.velocity.x * contact.normalX + body.velocity.y * contact.normalY);

      if (into <= 0) continue;

      body.velocity.x += contact.normalX * into;
      body.velocity.y += contact.normalY * into;
      impact = Math.max(impact, into);
    }

    return impact;
  }

  getSprite() {
    return this.sprite;
  }

  getLightRatio() {
    return this.lightFuel.getRatio();
  }

  getLightRadius() {
    return this.lightFuel.getRadius();
  }

  isInputActive() {
    return this.movementController.isInputActive();
  }

  /** Holding the sneak key trades speed and sight for stealth: dim light, slow and silent swimming. */
  isSneaking() {
    return this.sneakKey?.isDown === true;
  }

  refillLight(amount: number) {
    this.lightFuel.refill(amount);
    this.darknessTimer = 0;
  }

  setLightDrainMultiplier(multiplier: number) {
    this.lightDrainMultiplier = multiplier;
  }

  applyLightProfile(profile: LevelLighting) {
    if (profile.fuelStart !== undefined) {
      this.lightFuel.setFuel(profile.fuelStart);
    }

    if (profile.drainMultiplier !== undefined) {
      this.lightDrainMultiplier = profile.drainMultiplier;
    }

    if (profile.radiusMultiplier !== undefined) {
      this.lightFuel.setRadiusMultiplier(profile.radiusMultiplier);
    }
  }

  getHealth() {
    return this.health;
  }

  setHealth(health: number) {
    this.health = Phaser.Math.Clamp(health, 0, this.healthMax);
  }

  /** A lasting shield for scripted moments; the blink after a hit runs on its own flag, `blinking`. */
  setInvulnerable(value: boolean = true) {
    this.shielded = value;
  }

  isAlive() {
    return this.alive;
  }

  stun(durationMs: number) {
    this.stunEndTime = Math.max(this.stunEndTime, this.scene.time.now + durationMs);
    this.sprite.setVelocity(0, 0);
  }

  isStunned() {
    return this.alive && this.scene.time.now < this.stunEndTime;
  }

  isMoving(threshold: number) {
    return this.movementController.isMoving(threshold);
  }

  isImmune() {
    return this.blinking || this.shielded;
  }

  takeDamage(amount: number = 1) {
    if (!this.alive || this.isImmune()) return;

    this.setHealth(this.health - amount);
    this.noiseField.emit(this.sprite.x, this.sprite.y, 1);
    this.scene.events.emit('player-damaged');

    if (this.health <= 0) {
      this.scene.time.delayedCall(0, () => this.die());
    } else {
      this.scene.sound.play('fishBubble');
      this.becomeInvulnerable();
    }
  }

  die() {
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
      this.scene.sound.play('fishBubble', { volume: 1 });
    });

    this.scene.events.emit('player-died');
  }

  /** 0 at the noise threshold, 1 at full speed: how loud the current movement is. */
  private getSpeedRatio() {
    const { movingThreshold } = config.player;
    const speed = this.sprite.body?.velocity.length() ?? 0;

    return Phaser.Math.Clamp((speed - movingThreshold) / (this.speed - movingThreshold), 0, 1);
  }

  private createSprite(x: number, y: number) {
    const sprite = this.scene.physics.add.sprite(x, y, 'player')
      .setCollideWorldBounds(true)
      .setDamping(true)
      .setDrag(0.25)
      .setMaxVelocity(this.speed);

    sprite.setSize(100, 56);
    sprite.setPipeline('Light2D');
    sprite.setDepth(config.render.player);

    return sprite;
  }

  private createLight() {
    return this.scene.lights.addLight(
      this.sprite.x,
      this.sprite.y,
      this.lightFuel.getRadius(),
      0xcff1ff,
      1
    );
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
      rotation: {
        from: Phaser.Math.DegToRad(-this.idleRotationDeg),
        to: Phaser.Math.DegToRad(this.idleRotationDeg),
      },
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

  private updateLight(delta: number) {
    this.light.x = this.sprite.x;
    this.light.y = this.sprite.y;
    this.pulseTime += this.lightFuel.getPulseSpeed() * (delta / REFERENCE_FRAME_MS);
    this.light.radius = this.lightFuel.getRadius();
    this.light.intensity = this.lightFuel.getIntensity(this.pulseTime);
  }

  /** Total darkness is survivable but slowly crushes the player, so it stays a threat. */
  private updateDarknessPressure(delta: number) {
    if (!this.lightFuel.isEmpty()) {
      this.darknessTimer = 0;
      return;
    }

    if (this.darknessTimer === 0) {
      this.scene.sound.play('depth', { volume: 0.4 });
    }

    this.darknessTimer += delta;

    if (this.darknessTimer >= lightSettings.darknessGraceMs) {
      this.darknessTimer = 0;
      this.takeDamage(1);
    }
  }

  private becomeInvulnerable() {
    this.blinking = true;

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0 },
      duration: 100,
      yoyo: true,
      repeat: 5,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.blinking = false;
        this.sprite.setAlpha(1);
      }
    });
  }

  private createMoveWave() {
    const velocity = this.sprite.body.velocity;
    let angle: number;

    if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
      angle = velocity.x > 0 ? 270 : 90;
    } else {
      angle = velocity.y > 0 ? 0 : 180;
    }

    this.noiseField.emit(this.sprite.x, this.sprite.y, this.getSpeedRatio());

    const wave = this.scene.add.image(this.sprite.x, this.sprite.y, WAVE_TEXTURE)
      .setOrigin(0.5)
      .setAlpha(0.4)
      .setScale(0.1)
      .setToTop()
      .setAngle(angle);

    wave.postFX.addBlur(10);

    this.scene.tweens.add({
      targets: wave,
      alpha: 0,
      scale: 2.5,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => wave.destroy()
    });
  }

  private createDeathParticles() {
    const particles = this.scene.add.particles(this.sprite.x, this.sprite.y, BONE_TEXTURE, {
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
    this.scene.time.delayedCall(5100, () => particles.destroy());
  }

  private createTextures() {
    ensureTexture(this.scene, BONE_TEXTURE, 6, 18, graphics => {
      const width = 6;
      const height = 18;

      graphics.fillStyle(0xffffff, 1);
      graphics.fillPoints([
        { x: width / 2, y: 0 },
        { x: 0, y: height },
        { x: width, y: height },
      ], true);
      graphics.setAlpha(0.3);
    });

    ensureTexture(this.scene, WAVE_TEXTURE, 60, 30, graphics => {
      const centerX = 30;
      const centerY = 30;

      graphics.fillStyle(0x88CCEE, 0.5);
      graphics.fillEllipse(centerX, centerY, 60, 30);
      graphics.fillStyle(0x000000, 1);
      graphics.fillEllipse(centerX, centerY, 48, 24);
    });
  }
}
