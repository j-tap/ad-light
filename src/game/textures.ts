import Phaser from 'phaser';

/**
 * Textures are shared game-wide, so generated ones are created only on first request
 * and reused by every scene afterwards.
 */
const SOFT_GLOW = 'softGlow';
const SOFT_GLOW_SIZE = 128;
const BUBBLE = 'bubbleTexture';
const BUBBLE_SIZE = 32;

export function ensureTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void
): string {
  if (scene.textures.exists(key)) {
    return key;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);

  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();

  return key;
}

/** Canvas flavour of ensureTexture for art that needs curves, clipping and soft gradients. */
export function ensureCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void
): string {
  if (scene.textures.exists(key)) {
    return key;
  }

  const texture = scene.textures.createCanvas(key, Math.ceil(width), Math.ceil(height));

  if (!texture) return key;

  draw(texture.getContext());
  texture.refresh();

  return key;
}

export function solidTexture(scene: Phaser.Scene, key: string, color: string) {
  return ensureCanvasTexture(scene, key, 4, 4, context => {
    context.fillStyle = color;
    context.fillRect(0, 0, 4, 4);
  });
}

export function ensureBubbleTexture(scene: Phaser.Scene) {
  return ensureTexture(scene, BUBBLE, BUBBLE_SIZE, BUBBLE_SIZE, graphics => {
    graphics.fillStyle(0xadd8e6, 1);
    graphics.fillCircle(BUBBLE_SIZE / 2, BUBBLE_SIZE / 2, BUBBLE_SIZE / 2);
  });
}

/** White radial falloff, tinted and additively blended wherever something has to glow. */
export function ensureSoftGlow(scene: Phaser.Scene) {
  return ensureCanvasTexture(scene, SOFT_GLOW, SOFT_GLOW_SIZE, SOFT_GLOW_SIZE, context => {
    const half = SOFT_GLOW_SIZE / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);

    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, SOFT_GLOW_SIZE, SOFT_GLOW_SIZE);
  });
}

/** A glow that lights itself: it ignores the scene lights, so it stays visible in the dark. */
export function addSoftGlow(scene: Phaser.Scene, x: number, y: number, color: number) {
  return scene.add.image(x, y, ensureSoftGlow(scene))
    .setTint(color)
    .setBlendMode(Phaser.BlendModes.ADD);
}
