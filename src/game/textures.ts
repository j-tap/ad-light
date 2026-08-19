import Phaser from 'phaser';

/**
 * Textures are shared game-wide, so generated ones are created only on first request
 * and reused by every scene afterwards.
 */
export const DEPTH_GRADIENT = 'depthGradient';

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

export function ensureDepthGradient(scene: Phaser.Scene) {
  return ensureTexture(scene, DEPTH_GRADIENT, 8, 512, graphics => {
    graphics.fillGradientStyle(0x0a1119, 0x0a1119, 0x02040a, 0x02040a, 1);
    graphics.fillRect(0, 0, 8, 512);
  });
}

export const EMPTY_TEXTURE = 'emptyTexture';

export function ensureEmptyTexture(scene: Phaser.Scene) {
  return ensureTexture(scene, EMPTY_TEXTURE, 4, 4, graphics => {
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, 4, 4);
  });
}

