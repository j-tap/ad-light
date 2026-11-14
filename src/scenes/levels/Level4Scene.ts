import Phaser from 'phaser';
import GameScene from '../GameScene';
import { config, REFERENCE_FRAME_MS } from '../../config';
import { addRisingParticles } from '../../game/art/particles';
import { CoralGarden } from '../../game/CoralGarden';
import { Terrain } from '../../game/systems/Terrain';
import { ensureBubbleTexture } from '../../game/textures';
import { ThermalVent } from '../../game/ThermalVent';

type Stage = 'climb' | 'garden' | 'ending';

const settings = config.trench;

/**
 * The last level: the climb out of the trench, from the vent on its floor up to the coral
 * garden. Reaching the garden is the ending itself, so what follows the climb is scripted
 * here instead of in WinScene.
 */
export default class Level4Scene extends GameScene {
  private stage: Stage = 'climb';
  private stageTime = 0;
  private vent!: ThermalVent;
  private garden!: CoralGarden;
  private victoryMusic?: Phaser.Sound.BaseSound;
  private nextHint = 0;
  private depthMeters = Number.NaN;
  private depthLabel = '';
  private endingLines: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Level4Scene', config.levels[4]);
  }

  create() {
    this.stage = 'climb';
    this.stageTime = 0;
    this.nextHint = 0;
    this.depthMeters = Number.NaN;
    this.endingLines = [];
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

    if (this.stage !== 'climb' || !this.gameManager.isPlaying()) return;

    this.stageTime += delta;

    const hint = settings.hints[this.nextHint];

    if (hint && this.stageTime >= settings.startHintDelayMs && this.player.getSprite().y <= hint.y) {
      this.nextHint++;
      this.showHint(hint.text);
    }
  }

  protected createScenery() {
    const { width, height } = this.worldSize();

    this.vent = new ThermalVent(this, height - config.shaft.floorHeight);

    if (this.walls) {
      this.garden = new CoralGarden(this, this.walls, width);
    }
  }

  /** Once the fish is in the garden the way back down is closed, with open water above the plug. */
  protected buildTerrain(terrain: Terrain) {
    const { plugY, plugPad } = settings.garden;

    if (this.stage === 'climb' || !this.walls) return;

    terrain.addPolyline([
      { x: this.walls.leftAt(plugY) - plugPad, y: plugY },
      { x: this.walls.rightAt(plugY) + plugPad, y: plugY },
    ]);
  }

  protected goalLabel() {
    const { surfaceMeters, metersPerPx, stepMeters } = settings.depthMeter;
    const meters = Math.round((surfaceMeters + this.player.getSprite().y * metersPerPx) / stepMeters) * stepMeters;

    if (meters !== this.depthMeters) {
      this.depthMeters = meters;
      this.depthLabel = `Depth ${meters} m`;
    }

    return this.depthLabel;
  }

  /** Out of the neck and into the garden: the climb is over, the fish gets to look around. */
  protected completeLevel() {
    const { arrival, garden } = settings;

    this.showLevelResult();
    this.time.delayedCall(arrival.resultHoldMs, () => this.hud.hideResult());
    this.hud.hideGameplay();
    this.hud.clearHint();
    this.cameraDirector.reset();

    this.stopMusic(arrival.musicFadeMs);
    this.victoryMusic = this.sound.add('victory', { volume: arrival.victoryVolume });
    this.victoryMusic.play();

    this.enter('garden');
    this.rebuildTerrain();
    this.createUpdraft();

    this.time.delayedCall(garden.hintDelayMs, () => {
      if (this.stage === 'garden') this.showHint(garden.hint);
    });
  }

  protected updateAfterGame(delta: number) {
    this.stageTime += delta;

    if (this.stage === 'garden') {
      this.updateGarden(delta);
    } else if (this.stage === 'ending') {
      this.player.updateScripted(delta);
    }
  }

  protected onLayout() {
    const { lineSpacing, bottomMargin } = settings.ending;
    const top = this.scale.height - bottomMargin - (this.endingLines.length - 1) * lineSpacing;

    this.endingLines.forEach((text, index) => {
      text.setPosition(this.scale.width / 2, top + index * lineSpacing);
    });
  }

  private enter(stage: Stage) {
    this.stage = stage;
    this.stageTime = 0;
  }

  /** Bubbles rising out of the neck: the reason the fish is not sinking back into it. */
  private createUpdraft() {
    const { plugY, updraft } = settings.garden;
    const walls = this.walls;

    if (!walls) return;

    const left = walls.leftAt(plugY);

    addRisingParticles(this, left, plugY + updraft.depth, ensureBubbleTexture(this), updraft, {
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(0, 0, walls.rightAt(plugY) - left, updraft.depth),
      },
    }).setDepth(config.render.scenery + 1);
  }

  private updateGarden(delta: number) {
    const { garden } = settings;
    const sprite = this.player.getSprite();
    const coral = this.garden.getGreatCoral();

    this.player.update(delta);
    this.updateDepthPressure();

    if (sprite.y < garden.ceilingY) {
      sprite.y += (garden.ceilingY - sprite.y) * garden.ceilingPush * (delta / REFERENCE_FRAME_MS);
      this.showHintOnce(garden.ceilingHint);
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
    this.hud.clearHint();
    this.player.beginScripted();
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

    this.time.delayedCall(ending.lineEveryMs * ending.lines.length + ending.holdMs, () => this.finish());
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

  private finish() {
    const music = this.victoryMusic;

    this.victoryMusic = undefined;
    this.fadeToScene('WinScene', { music });
  }
}
