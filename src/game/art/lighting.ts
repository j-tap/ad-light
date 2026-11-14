import Phaser from 'phaser';

/** Height of every light above the surface, a constant baked into the Light2D fragment shader. */
const LIGHT_HEIGHT = 0.1;

/**
 * What the Light2D pipeline would show at a world point, as a tint. It repeats the shader's
 * own maths for a flat surface, for objects that cannot run on that pipeline, such as ropes.
 */
export function sampleLight(scene: Phaser.Scene, x: number, y: number) {
  const manager = scene.lights;
  const resolution = Math.min(scene.scale.width, scene.scale.height);
  let { r, g, b } = manager.ambientColor;

  for (const light of manager.lights) {
    const dx = (light.x - x) / resolution;
    const dy = (light.y - y) / resolution;
    const distanceSq = dx * dx + dy * dy + LIGHT_HEIGHT * LIGHT_HEIGHT;
    const radius = light.radius / resolution;
    const attenuation = 1 - distanceSq / (radius * radius);

    if (attenuation <= 0) continue;

    const strength = attenuation * (LIGHT_HEIGHT / Math.sqrt(distanceSq)) * light.intensity;

    r += light.color.r * strength;
    g += light.color.g * strength;
    b += light.color.b * strength;
  }

  return Phaser.Display.Color.GetColor(
    Math.min(r, 1) * 255,
    Math.min(g, 1) * 255,
    Math.min(b, 1) * 255
  );
}
