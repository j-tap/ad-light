/**
 * Generates a game sprite through Replicate and drops it into assets/images.
 * The token is read from .env at run time and never printed, so this script stays
 * safe to commit while .env does not.
 *
 *   bun .dev/gen-asset.mjs jellyfish
 *
 * Add --keep-bg to skip background removal, --raw to skip downscaling.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = `${ROOT}/assets/images`;
const API = 'https://api.replicate.com/v1';

/** The look to match: thick black ink outline, flat desaturated olive brown, faint grain. */
const STYLE = 'hand drawn cartoon sticker illustration, very thick bold black ink outline, '
  + 'flat desaturated colors, muted olive brown and dark sand palette, faint paper grain, '
  + 'simple rounded shapes, no gradients, no text, no shadow, childrens book creature, '
  + 'side view, centered, fills the whole frame, plain white background';

const SUBJECTS = {
  jellyfish: 'one deep sea jellyfish, wide round dome bell on top, four long thin wavy tentacles '
    + 'hanging straight down, pale cream bell, dark olive tentacles, whole creature visible',
};

const [subject, ...flags] = process.argv.slice(2);
const count = Number(flags.find(flag => /^\d+$/.test(flag)) ?? 1);
const preview = flags.includes('--preview');

if (!SUBJECTS[subject]) {
  console.error(`unknown subject "${subject}", known: ${Object.keys(SUBJECTS).join(', ')}`);
  process.exit(1);
}

const token = readFileSync(`${ROOT}/.env`, 'utf8')
  .split('\n')
  .find(line => line.startsWith('DEV_REPLICATE_API_TOKEN='))
  ?.split('=')[1]
  ?.trim();

if (!token) {
  console.error('DEV_REPLICATE_API_TOKEN is missing from .env');
  process.exit(1);
}

function post(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify(payload),
  });
}

async function runModel(model, input) {
  let response = await post(`${API}/models/${model}/predictions`, { input });

  // Community models have no model level endpoint, they need an explicit version id.
  if (response.status === 404) {
    const meta = await fetch(`${API}/models/${model}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(result => result.json());

    response = await post(`${API}/predictions`, { version: meta.latest_version?.id, input });
  }

  const body = await response.json();

  if (!response.ok || body.error) {
    throw new Error(`${model}: ${body.error ?? response.statusText}`);
  }

  const result = await waitFor(body);

  return Array.isArray(result.output) ? result.output[0] : result.output;
}

/** `Prefer: wait` gives up after a minute, so keep polling the prediction until it settles. */
async function waitFor(prediction) {
  let current = prediction;

  for (let i = 0; i < 120 && ['starting', 'processing'].includes(current.status); i++) {
    await new Promise(done => setTimeout(done, 2000));

    const response = await fetch(`${API}/predictions/${current.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    current = await response.json();
  }

  if (current.status !== 'succeeded') {
    throw new Error(`prediction ${current.status}: ${current.error ?? 'timed out'}`);
  }

  return current;
}

async function download(url, path) {
  const response = await fetch(url);

  if (!response.ok) throw new Error(`download failed: ${response.statusText}`);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
}

const prompt = `${SUBJECTS[subject]}, ${STYLE}`;

for (let i = 1; i <= count; i++) {
  const target = preview
    ? `/tmp/adlight-gen/${subject}-${i}.png`
    : `${OUT_DIR}/enemy-${subject}.png`;

  console.log(`generating ${subject} ${i}/${count}...`);

  let url = await runModel('black-forest-labs/flux-schnell', {
    prompt,
    aspect_ratio: '1:1',
    output_format: 'png',
    num_outputs: 1,
    go_fast: true,
    megapixels: '1',
    seed: preview ? i * 1000 : undefined,
  });

  if (!flags.includes('--keep-bg')) {
    url = await runModel('851-labs/background-remover', { image: url, threshold: 0.2 });
  }

  await download(url, target);

  if (!flags.includes('--raw')) {
    execFileSync('sips', ['-Z', '160', target, '--out', target], { stdio: 'ignore' });
  }

  console.log(`saved ${target.replace(ROOT, '.')}`);
}
