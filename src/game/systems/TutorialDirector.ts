import { GameManager } from '../GameManager';
import { Player } from '../Player';
import { Hud } from '../../ui/Hud';
import { config } from '../../config';

const settings = config.tutorial;

interface HintContext {
  elapsed: number,
  moved: boolean,
  score: number,
  lightRadius: number,
  molluskDistance: number,
  enemyDistance: number,
}

interface Hint {
  text: string,
  when: (context: HintContext) => boolean,
  /** Lesson already learned by itself, so the hint is dropped without showing. */
  skip?: (context: HintContext) => boolean,
  until?: (context: HintContext) => boolean,
  holdMs?: number,
}

const hints: Hint[] = [
  {
    text: 'Arrows or WASD to swim',
    when: context => context.elapsed >= settings.firstHintDelayMs,
    skip: context => context.moved,
    until: context => context.moved,
  },
  {
    text: 'Mollusks refill your light',
    when: context => context.molluskDistance <= context.lightRadius,
    skip: context => context.score > 0,
    until: context => context.score > 0,
    holdMs: config.hud.hintHoldMs,
  },
  {
    text: 'Hold SHIFT to sneak: dim, slow and silent, and hunters lose you',
    when: context => context.enemyDistance <= settings.hintEnemyDistance,
    holdMs: config.hud.hintHoldMs,
  },
  {
    text: 'ESC to pause',
    when: context => context.score > 0,
    holdMs: settings.escHintMs,
  },
];

/**
 * Teaches the rules by reacting to what the player is doing instead of front loading text:
 * every hint waits for its moment, shows once and leaves as soon as the lesson is learned.
 */
export class TutorialDirector {
  private readonly hud: Hud;
  private readonly player: Player;
  private readonly gameManager: GameManager;
  private readonly shown = new Set<Hint>();
  private elapsed = 0;
  private moved = false;
  private activeHint?: Hint;
  private activeTime = 0;

  constructor(hud: Hud, player: Player, gameManager: GameManager) {
    this.hud = hud;
    this.player = player;
    this.gameManager = gameManager;
  }

  update(delta: number) {
    this.elapsed += delta;
    this.moved = this.moved || this.player.isInputActive();

    if (this.shown.size === hints.length && !this.activeHint) return;

    const context = this.buildContext();

    if (this.activeHint) {
      this.activeTime += delta;

      const done = this.activeHint.until?.(context)
        || (this.activeHint.holdMs !== undefined && this.activeTime >= this.activeHint.holdMs);

      if (done) this.hide();

      return;
    }

    // Strictly in order: a lesson never jumps ahead of the one before it.
    const pending = hints.find(hint => !this.shown.has(hint));

    if (!pending) return;

    if (pending.skip?.(context)) {
      this.shown.add(pending);
      return;
    }

    if (pending.when(context)) this.show(pending);
  }

  hide() {
    if (!this.activeHint) return;

    this.activeHint = undefined;
    this.hud.clearHint();
  }

  private show(hint: Hint) {
    this.shown.add(hint);
    this.activeHint = hint;
    this.activeTime = 0;
    this.hud.setHint(hint.text);
  }

  private buildContext(): HintContext {
    const { x, y } = this.player.getSprite();

    return {
      elapsed: this.elapsed,
      moved: this.moved,
      score: this.gameManager.getScore(),
      lightRadius: this.player.getLightRadius(),
      molluskDistance: this.gameManager.getNearestMolluskDistance(x, y),
      enemyDistance: this.gameManager.getNearestEnemyDistance(x, y),
    };
  }
}
