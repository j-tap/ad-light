import Phaser from 'phaser';

/**
 * Two constants of Phaser 3.88's Light2D pipeline: `Light.frag` hard codes the height of every
 * light above the surface, and `LightPipeline.onRender` normalises distances by half the
 * shorter side of the renderer.
 */
const LIGHT_HEIGHT = 0.1;
const RESOLUTION_SHARE = 0.5;

/**
 * What the Light2D pipeline shows at a world point, as a tint, for objects that cannot run on
 * that pipeline themselves (ropes are triangle strips, which it does not batch). It repeats
 * the shader's maths for a flat surface and leaves out what a rough match does not need:
 * normal maps, the per-camera culling and cap on lights, and brightness above full white.
 */
export function sampleLight(scene: Phaser.Scene, x: number, y: number) {
  const manager = scene.lights;
  const resolution = Math.min(scene.scale.width, scene.scale.height) * RESOLUTION_SHARE;
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

/** Colour between two 0xRRGGBB values, t in 0..1. */
export function mixColor(from: number, to: number, t: number) {
  return Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(from),
    Phaser.Display.Color.ValueToColor(to),
    1,
    Phaser.Math.Clamp(t, 0, 1)
  ).color;
}
