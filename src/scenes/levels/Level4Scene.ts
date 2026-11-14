import Phaser from 'phaser';
import GameScene from '../GameScene';
import { config } from '../../config';
import { CoralGarden } from '../../game/CoralGarden';
import { ThermalVent } from '../../game/ThermalVent';

type Stage = 'dive' | 'eruption' | 'ride' | 'garden' | 'ending';

const settings = config.trench;
const BUBBLE_TEXTURE = 'bubbleTexture';

/**
 * The last level: a dive to the bottom of the trench, and then the way back up. The climb is
 * the ending itself, so everything after the vent is scripted here instead of in WinScene.
 */
export default class Level4Scene extends GameScene {
  private stage: Stage = 'dive';
  private stageTime = 0;
  private vent!: ThermalVent;
  private garden!: CoralGarden;
  private ridePath = new Float32Array(0);
  private rideRow = 0;
  private rideSpeed = 0;
  private rideAngle = -Math.PI / 2;
  private trail?: Phaser.GameObjects.Particles.ParticleEmitter;
  private victoryMusic?: Phaser.Sound.BaseSound;
  private nextHint = 0;
  private activeHint = '';
  private ceilingHintShown = false;
  private endingLines: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Level4Scene', config.levels[4]);
  }

  create() {
    this.stage = 'dive';
    this.stageTime = 0;
    this.nextHint = 0;
    this.activeHint = '';
    this.ceilingHintShown = false;
    this.endingLines = [];
    this.trail = undefined;
    this.victoryMusic = undefined;

    super.create();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Handed over to WinScene on a clean finish; anything else must not leave it playing.
      this.victoryMusic?.destroy();
      this.victoryMusic = undefined;
    });
  }

  update(time: number, delta: number) {
    super.update(time, delta);

    this.vent.update(delta);

    if (this.stage !== 'dive' || !this.gameManager.isPlaying()) return;

    this.stageTime += delta;
    this.updateHints();

    if (this.hasReachedVent()) {
      this.gameManager.winGame();
    }
  }

  protected createLevel() {
    super.createLevel();

    const { width, height } = this.worldSize();

    this.vent = new ThermalVent(this, height - settings.walls.floorHeight);

    if (this.walls) {
      this.garden = new CoralGarden(this, this.walls, width);
    }
  }

  protected goalLabel() {
    const { surfaceMeters, metersPerPx } = settings.depthMeter;
    const meters = Math.round(surfaceMeters + this.player.getSprite().y * metersPerPx);

    return `Depth ${meters} m`;
  }

  /** Reaching the vent decides the level; what follows is the ride home. */
  protected completeLevel() {
    const { finale } = settings;

    this.showLevelResult();
    this.time.delayedCall(finale.resultHoldMs, () => this.hud.hideResult());
    this.hud.hideGameplay();
    this.hud.clearHint();

    this.enter('eruption');
    this.stopMusic(finale.musicFadeMs);
    this.sound.play('depth', { volume: 0.5 });
    this.cameras.main.shake(finale.rumbleMs, finale.rumbleIntensity);
    this.cameraDirector.reset();

    this.vent.erupt();
    this.player.setScripted(true);
    this.player.refillLight(config.player.light.fuelMax);

    const mouth = this.vent.getMouth();

    this.tweens.add({
      targets: this.player.getSprite(),
      x: mouth.x,
      y: mouth.y - config.terrain.playerRadius * 2,
      duration: finale.gatherMs,
      ease: 'Sine.easeInOut',
    });
  }

  protected updateAfterGame(_time: number, delta: number) {
    this.stageTime += delta;

    switch (this.stage) {
      case 'eruption':
        this.player.updateScripted(delta, false);

        if (this.stageTime >= settings.finale.liftDelayMs) this.beginRide();
        break;
      case 'ride':
        this.updateRide(delta);
        break;
      case 'garden':
        this.updateGarden(_time, delta);
        break;
      case 'ending':
        this.player.updateScripted(delta, false);
        break;
    }
  }

  private enter(stage: Stage) {
    this.stage = stage;
    this.stageTime = 0;
  }

  private hasReachedVent() {
    const sprite = this.player.getSprite();
    const mouth = this.vent.getMouth();
    const { triggerRadius, triggerDepth } = settings.vent;

    return Phaser.Math.Distance.Between(sprite.x, sprite.y, mouth.x, mouth.y) < triggerRadius
      || sprite.y > this.worldSize().height - triggerDepth;
  }

  /** Each line appears once, when the fish first sinks to its depth. */
  private updateHints() {
    const hint = settings.hints[this.nextHint];

    if (!hint || this.stageTime < settings.startHintDelayMs || this.player.getSprite().y < hint.y) return;

    this.nextHint++;
    this.showHint(hint.text);
  }

  private showHint(text: string) {
    this.activeHint = text;
    this.hud.setHint(text);
    this.time.delayedCall(config.tutorial.hintHoldMs, () => this.hud.clearHintIf(text));
  }

  private beginRide() {
    const { ride, finale } = settings;
    const sprite = this.player.getSprite();

    this.enter('ride');
    this.tweens.killTweensOf(sprite);
    this.buildRidePath();
    this.rideSpeed = ride.startSpeed;
    this.rideAngle = -Math.PI / 2;
    sprite.setFlipX(false);

    this.victoryMusic = this.sound.add('victory', { volume: finale.victoryVolume });
    this.victoryMusic.play();

    this.trail = this.add.particles(0, 0, BUBBLE_TEXTURE, {
      follow: sprite,
      lifespan: ride.trail.lifespanMs,
      speedY: { min: ride.trail.speed.min, max: ride.trail.speed.max },
      speedX: { min: -ride.trail.drift, max: ride.trail.drift },
      scale: { start: ride.trail.scale, end: 0 },
      alpha: { start: 0.55, end: 0 },
      tint: ride.trail.tint,
      frequency: ride.trail.everyMs,
    }).setDepth(config.render.player - 1);

    const camera = this.cameras.main;

    camera.setLerp(1, 1);
    this.tweens.add({
      targets: camera.followOffset,
      y: ride.cameraOffsetY,
      duration: ride.cameraOffsetMs,
      ease: 'Sine.easeInOut',
    });
  }

  /** Centre line of the shaft, smoothed so the fish swings past ledges instead of jerking. */
  private buildRidePath() {
    const walls = this.walls;

    if (!walls) return;

    const { step, smoothRows, wallMargin } = settings.ride;
    const rows = Math.ceil(this.worldSize().height / step) + 1;
    let path = new Float32Array(rows);

    for (let row = 0; row < rows; row++) {
      path[row] = walls.centerAt(row * step);
    }

    for (let pass = 0; pass < 2; pass++) {
      const smoothed = new Float32Array(rows);

      for (let row = 0; row < rows; row++) {
        let sum = 0;
        let count = 0;

        for (let near = Math.max(row - smoothRows, 0); near <= Math.min(row + smoothRows, rows - 1); near++) {
          sum += path[near];
          count++;
        }

        smoothed[row] = sum / count;
      }

      path = smoothed;
    }

    for (let row = 0; row < rows; row++) {
      path[row] = walls.clampX(path[row], row * step, wallMargin);
    }

    this.ridePath = path;
    this.rideRow = Math.floor(this.player.getSprite().y / step);
  }

  /**
   * The path is walked point by point at a steady speed along its length, so the long sideways
   * stretches under the shelves take as long as they should instead of happening in one frame.
   */
  private updateRide(delta: number) {
    const { ride } = settings;
    const sprite = this.player.getSprite();
    const seconds = delta / 1000;
    const braking = Math.max((sprite.y - ride.arriveY) * ride.brake, ride.endSpeed);
    const fromX = sprite.x;
    const fromY = sprite.y;

    this.rideSpeed = Math.min(this.rideSpeed + ride.acceleration * seconds, ride.maxSpeed, braking);

    let budget = this.rideSpeed * seconds;
    let x = fromX;
    let y = fromY;

    while (budget > 0 && y > ride.arriveY) {
      const targetRow = Math.max(this.rideRow - 1, 0);
      const targetX = this.ridePath[targetRow];
      const targetY = targetRow * ride.step;
      const distance = Phaser.Math.Distance.Between(x, y, targetX, targetY);

      if (distance > budget) {
        x += ((targetX - x) / distance) * budget;
        y += ((targetY - y) / distance) * budget;
        break;
      }

      budget -= distance;
      x = targetX;
      y = targetY;
      this.rideRow = targetRow;

      if (targetRow === 0) break;
    }

    const heading = Math.atan2(y - fromY, x - fromX);

    this.rideAngle = Phaser.Math.Angle.RotateTo(this.rideAngle, heading, ride.turnRate * (delta / (1000 / 30)));
    sprite.setPosition(x, y).setRotation(this.rideAngle);

    this.player.updateScripted(delta, true);
    this.updateDepthPressure();

    if (y <= ride.arriveY) this.beginGarden();
  }

  private beginGarden() {
    const { garden, ride } = settings;
    const walls = this.walls;
    const camera = this.cameras.main;

    this.enter('garden');
    this.trail?.stop();
    this.currentsEnabled = false;

    if (walls && this.terrain) {
      // Seals the neck, with open water above: the updraft is what holds the fish up from now on.
      this.terrain.addPolyline([
        { x: walls.leftAt(garden.plugY) - garden.plugPad, y: garden.plugY },
        { x: walls.rightAt(garden.plugY) + garden.plugPad, y: garden.plugY },
      ]);
      this.createUpdraft(walls.centerAt(garden.plugY), walls.rightAt(garden.plugY) - walls.leftAt(garden.plugY));
    }

    this.player.setScripted(false);
    this.player.getSprite().setVelocity(0, -ride.exitSpeed);

    camera.setLerp(0.1, 0.1);
    this.tweens.add({
      targets: camera.followOffset,
      y: 0,
      duration: ride.cameraOffsetMs * 2,
      ease: 'Sine.easeInOut',
    });

    this.time.delayedCall(garden.hintDelayMs, () => {
      if (this.stage === 'garden') this.showHint(garden.hint);
    });
  }

  private createUpdraft(x: number, width: number) {
    const { updraft, plugY } = settings.garden;

    this.add.particles(x, plugY + 40, BUBBLE_TEXTURE, {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-width / 2, 0, width, 60) },
      lifespan: updraft.lifespanMs,
      speedY: { min: -updraft.speed.max, max: -updraft.speed.min },
      speedX: { min: -14, max: 14 },
      scale: { start: updraft.scale, end: 0 },
      alpha: { start: 0.5, end: 0 },
      frequency: updraft.everyMs,
    }).setDepth(config.render.scenery + 1);
  }

  private updateGarden(time: number, delta: number) {
    const { garden } = settings;
    const sprite = this.player.getSprite();
    const coral = this.garden.getGreatCoral();

    this.player.update(time, delta);
    this.updateDepthPressure();

    if (sprite.y < garden.ceilingY) {
      sprite.y += (garden.ceilingY - sprite.y) * garden.ceilingPush * (delta / (1000 / 30));

      if (!this.ceilingHintShown) {
        this.ceilingHintShown = true;
        this.showHint(garden.ceilingHint);
      }
    }

    const arrived = Phaser.Math.Distance.Between(sprite.x, sprite.y, coral.x, coral.y) < garden.reachRadius;

    if (arrived || this.stageTime >= garden.timeoutMs) this.beginEnding();
  }

  private beginEnding() {
    const { garden, ending } = settings;
    const sprite = this.player.getSprite();
    const coral = this.garden.getGreatCoral();
    const restX = coral.x + garden.restOffset.x;
    const restY = coral.y + garden.restOffset.y;
    const camera = this.cameras.main;

    this.enter('ending');
    this.hud.clearHintIf(this.activeHint);
    this.player.setScripted(true);
    sprite.setFlipX(restX > coral.x);

    this.tweens.add({
      targets: sprite,
      x: restX,
      y: restY,
      duration: garden.settleMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tweens.add({
          targets: sprite,
          y: restY + garden.bobPx,
          duration: garden.bobMs,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    camera.stopFollow();
    camera.pan(restX + ending.panOffset.x, restY + ending.panOffset.y, ending.zoomMs, 'Sine.easeInOut');
    camera.zoomTo(ending.zoom, ending.zoomMs, 'Sine.easeInOut');

    this.createEndingLines();

    const total = ending.lineEveryMs * ending.lines.length + ending.holdMs;

    this.time.delayedCall(total, () => this.finish());
    this.time.delayedCall(ending.skipAfterMs, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.finish());
      this.input.keyboard?.once('keydown-ENTER', () => this.finish());
      this.input.keyboard?.once('keydown-SPACE', () => this.finish());
    });
  }

  private createEndingLines() {
    const { ending } = settings;

    this.endingLines = ending.lines.map((line, index) => {
      const text = this.add.text(0, 0, line, {
        fontSize: '26px',
        fontFamily: 'Arial',
        color: '#eaf6ff',
        align: 'center',
        stroke: '#061018',
        strokeThickness: 5,
      })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(config.camera.overlayDepth + 1)
        .setAlpha(0);

      this.tweens.add({
        targets: text,
        alpha: 1,
        delay: index * ending.lineEveryMs,
        duration: ending.lineFadeMs,
        ease: 'Sine.easeOut',
      });

      return text;
    });

    this.addToUi(this.endingLines);
    this.onLayout();
  }

  protected onLayout() {
    const { lineSpacing, bottomMargin } = settings.ending;
    const top = this.scale.height - bottomMargin - (this.endingLines.length - 1) * lineSpacing;

    this.endingLines.forEach((text, index) => {
      text.setPosition(this.scale.width / 2, top + index * lineSpacing);
    });
  }

  private finish() {
    const music = this.victoryMusic;

    this.victoryMusic = undefined;
    this.fadeToScene('WinScene', { music });
  }
}
