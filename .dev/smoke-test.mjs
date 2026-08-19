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

// Headless frames are slow and Phaser clamps delta, so game time crawls: poll, do not sleep.
const tutorial = await page.evaluate(async () => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const hint = scene.hud.hintText;
  const zone = 900;
  const playerX = scene.player.getSprite().x;

  for (let i = 0; i < 100 && hint.alpha < 0.9; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return {
    text: hint.text,
    alpha: hint.alpha,
    enemiesInZone: scene.gameManager.enemies.filter(e => e.getSprite().x < zone).length,
    mollusksAhead: scene.gameManager.mollusks
      .filter(m => m.getSprite().x > playerX && m.getSprite().x - playerX < 1000).length,
    freeScore: scene.gameManager.getScore(),
  };
});

report('movement is taught first while the player is idle', tutorial.text.includes('swim'),
  `"${tutorial.text}" at alpha ${tutorial.alpha.toFixed(2)}`);
report('opening mollusks are out of reach until the player swims', tutorial.freeScore === 0,
  `${tutorial.freeScore} collected without input`);
report('teaching zone is kept clear of enemies', tutorial.enemiesInZone === 0,
  `${tutorial.enemiesInZone} enemies before x=900`);
report('teaching zone lays a mollusk trail ahead', tutorial.mollusksAhead >= 3,
  `${tutorial.mollusksAhead} mollusks within 1000px ahead`);

await page.screenshot({ path: '/tmp/adlight-tutorial.png' });

await page.keyboard.down('ArrowRight');
await wait(1500);
await page.keyboard.up('ArrowRight');

const hintAfterMove = await page.evaluate(() => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const hint = scene.hud.hintText;

  return { text: hint.text, alpha: hint.alpha };
});
report('movement hint gives way once the player swims',
  hintAfterMove.alpha < 0.5 || hintAfterMove.text !== tutorial.text,
  `now "${hintAfterMove.text}" at alpha ${hintAfterMove.alpha.toFixed(2)}`);

// Collecting refills the light, so start from a full tank to measure the drain itself.
const drain = await page.evaluate(async () => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const player = scene.player;

  player.refillLight(100);

  const before = { ratio: player.getLightRatio(), radius: player.getLightRadius() };

  for (let i = 0; i < 60 && player.getLightRatio() >= before.ratio; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { before, ratio: player.getLightRatio(), radius: player.getLightRadius() };
});

report('light drains while playing', drain.ratio < drain.before.ratio,
  `${drain.before.ratio.toFixed(3)} -> ${drain.ratio.toFixed(3)}`);
report('light radius follows fuel', drain.radius < drain.before.radius,
  `${Math.round(drain.before.radius)} -> ${Math.round(drain.radius)}`);

const afterMove = await levelState();

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

const nests = await page.evaluate(async () => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const mollusks = scene.gameManager.mollusks;
  const points = mollusks.map(m => ({ x: m.getSprite().x, y: m.baseY }));

  // Group by proximity: a nest is a chain of mollusks within one nest diameter.
  const groups = [];

  points.forEach(point => {
    const group = groups.find(members =>
      members.some(member => Math.hypot(member.x - point.x, member.y - point.y) < 300));

    if (group) group.push(point);
    else groups.push([point]);
  });

  const near = mollusks[0];
  const sprite = near.getSprite();
  const player = scene.player.getSprite();

  sprite.x = player.x + 120;
  near.baseY = player.y;

  const far = mollusks[mollusks.length - 1];

  far.getSprite().x = player.x + 4000;
  far.baseY = player.y;

  const samples = { near: [], far: [] };

  for (let i = 0; i < 25; i++) {
    samples.near.push(near.light.intensity);
    samples.far.push(far.light.intensity);
    await new Promise(resolve => setTimeout(resolve, 80));
  }

  const swing = values => Math.max(...values) - Math.min(...values);

  return {
    total: mollusks.length,
    groups: groups.length,
    nearSwing: swing(samples.near),
    farSwing: swing(samples.far),
  };
});

report('mollusks spawn in nests', nests.groups < nests.total && nests.groups > 0,
  `${nests.total} mollusks in ${nests.groups} nests`);
report('mollusk pulse reacts to the player', nests.nearSwing > nests.farSwing,
  `swing near ${nests.nearSwing.toFixed(2)} vs far ${nests.farSwing.toFixed(2)}`);

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

  const zooms = [];

  for (let i = 0; i < 60; i++) {
    // The damage cooldown clears the flag, so keep re-arming it for the whole probe.
    scene.player.setInvulnerable(true);
    scene.gameManager.getNoiseField().emit(playerSprite.x, playerSprite.y, 1);
    states.push(enemy.state);
    zooms.push(scene.cameras.main.zoom);
    await new Promise(resolve => setTimeout(resolve, 60));
  }

  enemy.getSprite().setPosition(playerSprite.x + 900, playerSprite.y);
  playerSprite.body.setAllowGravity(true);
  scene.player.setHealth(3);
  scene.player.setInvulnerable(false);

  return {
    states: [...new Set(states)].sort(),
    maxZoom: Math.max(...zooms),
    uiZoom: scene.uiCamera.zoom,
  };
});
report('angler telegraphs and lunges when the player comes close', lunge.states?.includes(2) === true,
  lunge.error ? JSON.stringify(lunge) : `states seen: ${lunge.states.join(',')}`);
report('camera pushes in during a chase', lunge.maxZoom > 1.01,
  `zoom reached ${lunge.maxZoom?.toFixed(3)}`);
report('interface keeps its own scale', lunge.uiZoom === 1, `ui zoom ${lunge.uiZoom}`);

const damageFx = await page.evaluate(async () => {
  const scene = window.game.scene.getScenes(true).find(s => s.scene.key.startsWith('Level'));
  const overlay = scene.cameraDirector.getOverlay();

  scene.player.setHealth(3);
  scene.player.setInvulnerable(false);
  scene.player.takeDamage(1);

  // Both effects start synchronously and are short, so read them before the next frame.
  const flashed = overlay.alpha;
  const shaking = scene.cameras.main.shakeEffect.isRunning;

  await new Promise(resolve => setTimeout(resolve, 1200));

  scene.player.setHealth(3);

  return { flashed, shaking, faded: overlay.alpha };
});

report('damage flashes the screen', damageFx.flashed > 0.05 && damageFx.faded < 0.05,
  `alpha ${damageFx.flashed.toFixed(2)} -> ${damageFx.faded.toFixed(2)}`);
report('damage shakes the camera', damageFx.shaking === true);

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
