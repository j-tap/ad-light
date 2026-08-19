/**
 * End-to-end sanity run against the dev server. Playwright is not a project dependency,
 * so run it from a scratch folder that has it installed:
 *   bun run dev
 *   mkdir -p /tmp/adlight-smoke && cd /tmp/adlight-smoke && bun add playwright
 *   cp <repo>/.dev/smoke-test.mjs . && SMOKE_URL=http://localhost:5173/ bun smoke-test.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL ?? 'http://localhost:5173/';
const problems = [];
const notes = [];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function report(name, ok, detail = '') {
  const status = ok ? 'ok  ' : 'FAIL';
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) problems.push(`${name}${detail ? `: ${detail}` : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });

page.setDefaultTimeout(90000);

page.on('console', message => {
  const type = message.type();
  if (type === 'error' || type === 'warning') {
    notes.push(`console.${type}: ${message.text()}`);
  }
});
page.on('pageerror', error => {
  console.log(`     pageerror: ${error.message}`);
  problems.push(`pageerror: ${error.message}`);
});

await page.goto(URL, { waitUntil: 'load' });

const activeScenes = () => page.evaluate(() =>
  window.game.scene.getScenes(true).map(scene => scene.scene.key)
);

const levelState = () => page.evaluate(() => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  if (!scene) return null;

  const player = scene.player;

  return {
    key: scene.scene.key,
    health: player.getHealth(),
    alive: player.isAlive(),
    lightRatio: player.getLightRatio(),
    lightRadius: player.getLightRadius(),
    mollusks: scene.gameManager.mollusks.length,
    enemies: scene.gameManager.enemies.length,
    score: scene.gameManager.getScore(),
    tweens: scene.tweens.getTweens().length,
    timers: scene.time._active ? scene.time._active.length : -1,
    sounds: window.game.sound.sounds.length,
    fps: Math.round(window.game.loop.actualFps),
  };
});

/**
 * Light transitions are eased and the headless renderer is slow, so wait for the radius
 * to hold steady over several samples instead of guessing a delay.
 */
async function waitForStableRadius() {
  let previous = Number.NaN;
  let stable = 0;

  for (let i = 0; i < 60; i++) {
    const state = await levelState();

    stable = Math.abs(state.lightRadius - previous) < 1 ? stable + 1 : 0;

    if (stable >= 4) return state;

    previous = state.lightRadius;
    await wait(150);
  }

  return levelState();
}

await page.waitForFunction(
  () => window.game?.scene.getScenes(true).some(s => s.scene.key === 'StartScene'),
  null,
  { timeout: 60000 }
);
report('preload finished, menu shown', true, (await activeScenes()).join(', '));

await page.keyboard.press('Enter');
await page.waitForFunction(
  () => window.game.scene.getScenes(true).some(s => s.scene.key.startsWith('Level')),
  null,
  { timeout: 30000 }
);

const start = await levelState();
report('level started', Boolean(start), start ? `${start.key}, enemies ${start.enemies}, mollusks ${start.mollusks}` : 'no level scene');

await page.keyboard.down('ArrowRight');
await wait(1500);
await page.keyboard.up('ArrowRight');

const afterMove = await levelState();
report('light drains while playing', afterMove.lightRatio < start.lightRatio,
  `${start.lightRatio.toFixed(3)} -> ${afterMove.lightRatio.toFixed(3)}`);
report('light radius follows fuel', afterMove.lightRadius < start.lightRadius,
  `${Math.round(start.lightRadius)} -> ${Math.round(afterMove.lightRadius)}`);

await page.keyboard.down('Shift');
const dimmed = await waitForStableRadius();
await page.keyboard.up('Shift');
const undimmed = await waitForStableRadius();

report('shift dims the light', dimmed.lightRadius < afterMove.lightRadius * 0.4,
  `${Math.round(afterMove.lightRadius)} -> ${Math.round(dimmed.lightRadius)}`);
report('light restores after shift', undimmed.lightRadius > dimmed.lightRadius * 2,
  `${Math.round(dimmed.lightRadius)} -> ${Math.round(undimmed.lightRadius)}`);

const refilled = await page.evaluate(() => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const before = scene.player.getLightRatio();
  scene.player.refillLight(25);
  return { before, after: scene.player.getLightRatio() };
});
report('mollusk refill raises fuel', refilled.after > refilled.before,
  `${refilled.before.toFixed(3)} -> ${refilled.after.toFixed(3)}`);

const darkness = await page.evaluate(async () => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const player = scene.player;
  const before = player.getHealth();

  player.lightFuel.fuel = 0;
  player.darknessTimer = 14990;

  await new Promise(resolve => setTimeout(resolve, 400));

  const after = player.getHealth();
  player.refillLight(100);

  return { before, after };
});
report('total darkness damages the player', darkness.after < darkness.before,
  `health ${darkness.before} -> ${darkness.after}`);

const enemyCheck = await page.evaluate(() => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const enemies = scene.gameManager.enemies;
  const anglers = enemies.filter(e => e.constructor.name === 'AnglerFish');

  return {
    count: enemies.length,
    anglers: anglers.length,
    withHitArea: enemies.filter(e => Boolean(e.getHitArea())).length,
    armed: anglers.filter(e => e.canDamage()).length,
    nearPost: anglers.filter(e =>
      Math.hypot(e.getSprite().x - e.postX, e.getSprite().y - e.postY) < 200).length,
  };
});
report('enemies spawned with hit areas', enemyCheck.withHitArea === enemyCheck.count,
  `${enemyCheck.withHitArea}/${enemyCheck.count}`);
report('idle anglers are harmless', enemyCheck.armed === 0,
  `${enemyCheck.armed} of ${enemyCheck.anglers} armed`);
report('anglers hold their post', enemyCheck.nearPost === enemyCheck.anglers,
  `${enemyCheck.nearPost}/${enemyCheck.anglers} near post`);

const detection = await page.evaluate(() => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const enemy = scene.gameManager.enemies[0];
  const playerSprite = scene.player.getSprite();
  const noise = scene.gameManager.getNoiseField();

  enemy.getSprite().setPosition(playerSprite.x + 250, playerSprite.y);

  const dimContext = {
    playerX: playerSprite.x,
    playerY: playerSprite.y,
    isPlayerAlive: true,
    playerLightRadius: 90,
    noise,
  };

  noise.reset();
  const hiding = enemy.sensePlayer(dimContext);

  noise.emit(playerSprite.x, playerSprite.y, 1);
  const loud = enemy.sensePlayer(dimContext);

  noise.reset();
  const litUp = enemy.sensePlayer({ ...dimContext, playerLightRadius: 500 });

  return { hiding, loud, litUp };
});

report('dim and still player stays unnoticed at 250px', detection.hiding === 0,
  `level ${detection.hiding.toFixed(2)}`);
report('loud movement gives the player away', detection.loud > 0.35,
  `level ${detection.loud.toFixed(2)}`);
report('bright light gives the player away', detection.litUp > 0.35,
  `level ${detection.litUp.toFixed(2)}`);

const pings = await page.evaluate(async () => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  scene.gameManager.getNoiseField().reset();
  return scene.gameManager.getNoiseField().pings.filter(p => p.active).length;
});
report('noise field starts quiet', pings === 0, `${pings} active pings`);

await page.keyboard.down('ArrowLeft');
await wait(800);
const movingPings = await page.evaluate(() =>
  window.game.scene.getScenes(true)
    .find(s => s.scene.key.startsWith('Level'))
    .gameManager.getNoiseField().pings.filter(p => p.active).length
);
await page.keyboard.up('ArrowLeft');
report('swimming emits noise pings', movingPings > 0, `${movingPings} active pings`);

const jelly = await page.evaluate(async () => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const enemy = scene.gameManager.enemies.find(e => e.constructor.name === 'Jellyfish');

  if (!enemy) return null;

  const playerSprite = scene.player.getSprite();
  const sprite = enemy.getSprite();

  sprite.setPosition(playerSprite.x + 210, playerSprite.y - 40);

  const samples = [];

  // Let a frame run so the glow catches up with the teleport before sampling.
  await new Promise(resolve => setTimeout(resolve, 600));

  for (let i = 0; i < 12; i++) {
    samples.push({ y: sprite.y, scaleY: sprite.scaleY, glowY: enemy.glow.y, alpha: enemy.glow.alpha });
    await new Promise(resolve => setTimeout(resolve, 120));
  }

  return {
    damaging: enemy.canDamage(),
    unlit: sprite.pipeline?.name !== 'Light2D',
    drifts: new Set(samples.map(s => Math.round(s.y))).size > 1,
    pulses: new Set(samples.map(s => Math.round(s.scaleY * 100))).size > 1,
    // Sampling is not frame synced, so allow the glow to trail by a single slow frame.
    maxGlowOffset: Math.round(Math.max(...samples.map(s => Math.abs(s.glowY - s.y)))),
    spriteY: Math.round(sprite.y),
    worldBottom: Math.round(scene.physics.world.bounds.bottom),
    glowPulses: new Set(samples.map(s => Math.round(s.alpha * 100))).size > 1,
  };
});

if (jelly) {
  report('jellyfish stings on contact', jelly.damaging === true);
  report('jellyfish glows on its own', jelly.unlit === true);
  report('jellyfish drifts and pulses', jelly.drifts && jelly.pulses,
    `drift ${jelly.drifts}, pulse ${jelly.pulses}`);
  report('jellyfish glow tracks the body', jelly.maxGlowOffset < 20 && jelly.glowPulses,
    `offset ${jelly.maxGlowOffset}px, pulse ${jelly.glowPulses}, y ${jelly.spriteY} of ${jelly.worldBottom}`);
  await page.screenshot({ path: '/tmp/adlight-jellyfish.png' });
} else {
  report('jellyfish spawned', false, 'not found on the level');
}

const beforeLunge = await levelState();
report('player survived the exploration phase', beforeLunge?.alive === true,
  beforeLunge ? `health ${beforeLunge.health}, scene ${beforeLunge.key}` : 'no level scene');

const lunge = await page.evaluate(async () => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const enemy = scene.gameManager.enemies[0];
  const playerSprite = scene.player.getSprite();
  const states = [];

  if (!playerSprite.body) {
    return {
      error: 'player sprite was destroyed',
      scenes: window.game.scene.getScenes(true).map(s => s.scene.key),
      status: scene.sys.settings.status,
      alive: scene.player.isAlive(),
      health: scene.player.getHealth(),
      state: scene.gameManager.state,
    };
  }

  // Pin the player so its slow sinking cannot drift it out of the lunge range, and make it
  // invulnerable so repeated strikes do not end the run before the later checks.
  scene.player.setInvulnerable(true);
  playerSprite.body.setAllowGravity(false);
  playerSprite.setVelocity(0, 0);

  enemy.getSprite().setPosition(playerSprite.x + 90, playerSprite.y);
  enemy.postX = playerSprite.x + 90;
  enemy.postY = playerSprite.y;

  for (let i = 0; i < 60; i++) {
    // The damage cooldown clears the flag, so keep re-arming it for the whole probe.
    scene.player.setInvulnerable(true);
    scene.gameManager.getNoiseField().emit(playerSprite.x, playerSprite.y, 1);
    states.push(enemy.state);
    await new Promise(resolve => setTimeout(resolve, 60));
  }

  enemy.getSprite().setPosition(playerSprite.x + 900, playerSprite.y);
  playerSprite.body.setAllowGravity(true);
  scene.player.setHealth(3);
  scene.player.setInvulnerable(false);

  return { states: [...new Set(states)].sort() };
});
report('angler telegraphs and lunges when the player comes close', lunge.states?.includes(2) === true,
  lunge.error ? JSON.stringify(lunge) : `states seen: ${lunge.states.join(',')}`);

await page.setViewportSize({ width: 800, height: 900 });
await wait(600);
await page.setViewportSize({ width: 1200, height: 700 });
await wait(600);
const afterResize = await levelState();
report('survives resize', afterResize?.alive === true,
  afterResize ? `fps ${afterResize.fps}` : `level gone, scenes: ${(await activeScenes()).join(', ')}`);

await page.keyboard.press('Escape');
await wait(600);
const paused = await activeScenes();
report('pause opens PauseScene', paused.includes('PauseScene'), paused.join(', '));

await page.keyboard.press('Escape');
await wait(800);

const completedLevel = (await levelState())?.key;

if (!completedLevel) {
  console.log('\nlevel scene is gone, skipping completion checks');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
}

await page.evaluate(() => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const manager = scene.gameManager;

  scene.player.setInvulnerable(true);
  [...manager.mollusks].forEach(mollusk => {
    manager.molluskBySprite.delete(mollusk.getSprite());
    mollusk.destroy();
  });
  manager.mollusks.length = 0;
});

let nextScenes = [];

try {
  await page.waitForFunction(
    key => !window.game.scene.getScenes(true).some(s => s.scene.key === key),
    completedLevel,
    { timeout: 30000 }
  );
  nextScenes = await activeScenes();
  report('level completion transitions forward', true, nextScenes.join(', '));
} catch {
  nextScenes = await activeScenes();
  report('level completion transitions forward', false, `stuck on ${nextScenes.join(', ')}`);
}

if (nextScenes.some(key => key.startsWith('Level'))) {
  await wait(2000);

  const nextLevel = await levelState();
  report('next level runs', Boolean(nextLevel), nextLevel
    ? `${nextLevel.key}, enemies ${nextLevel.enemies}, mollusks ${nextLevel.mollusks}`
    : 'no level');

  const kinds = await page.evaluate(() => {
    const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
    const counts = {};

    scene.gameManager.enemies.forEach(enemy => {
      const name = enemy.constructor.name;
      counts[name] = (counts[name] ?? 0) + 1;
    });

    return counts;
  });
  report('level mixes enemy kinds', Object.keys(kinds).length > 1, JSON.stringify(kinds));

  const blind = await page.evaluate(() => {
    const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
    const enemy = scene.gameManager.enemies.find(e => e.constructor.name === 'SwallowtailFish');

    if (!enemy) return null;

    const playerSprite = scene.player.getSprite();
    const noise = scene.gameManager.getNoiseField();

    enemy.getSprite().setPosition(playerSprite.x + 200, playerSprite.y);
    noise.reset();

    const context = {
      playerX: playerSprite.x,
      playerY: playerSprite.y,
      isPlayerAlive: true,
      playerLightRadius: 500,
      noise,
    };

    const inBrightLight = enemy.sensePlayer(context);

    noise.emit(playerSprite.x, playerSprite.y, 1);

    return { inBrightLight, afterNoise: enemy.sensePlayer(context) };
  });

  if (blind) {
    report('swallowtail ignores the player light', blind.inBrightLight === 0,
      `level ${blind.inBrightLight.toFixed(2)}`);
    report('swallowtail reacts to noise', blind.afterNoise > 0.35,
      `level ${blind.afterNoise.toFixed(2)}`);
  } else {
    report('swallowtail present on the level', false, 'not spawned');
  }

  await page.screenshot({ path: process.env.SMOKE_SHOT ?? '/tmp/adlight-level.png' });
}

const final = await page.evaluate(() => ({
  sounds: window.game.sound.sounds.length,
  textures: window.game.textures.getTextureKeys().length,
  fps: Math.round(window.game.loop.actualFps),
}));

console.log(`\nsounds ${final.sounds}, textures ${final.textures}, fps ${final.fps}`);

if (notes.length) {
  console.log('\nconsole output:');
  [...new Set(notes)].forEach(note => console.log(`  ${note}`));
}

await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  problems.forEach(problem => console.log(`  ${problem}`));
  process.exit(1);
}

console.log('\nall checks passed');
