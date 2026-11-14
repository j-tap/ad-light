/**
 * Generate rock-bottom via Recraft, post-process, then derive top/left variants.
 * Run: source .env && node scripts/gen-rocks.mjs && python3 scripts/derive-rock-variants.py
 */
import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TOKEN = process.env.DEV_REPLICATE_API_TOKEN;
if (!TOKEN) {
  console.error('Set DEV_REPLICATE_API_TOKEN');
  process.exit(1);
}

const replicate = new Replicate({ auth: TOKEN });
const ROOT = path.resolve('assets/images/rocks');

const BASE = 'dark grey rock, thick black outline, cartoon style, cracks on surface, isolated rock only, NO plants NO grass NO flowers NO ground NO sand NO pebbles, pure white background, hand-drawn stipple shading, 2D game sprite';

const ROCKS = [
  {
    name: 'rock-bottom',
    prompt: `${BASE}, triangular stalagmite shape pointing upward`,
  },
];

async function writeOutput(output, dest) {
  if (output && typeof output[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of output) chunks.push(chunk);
    fs.writeFileSync(dest, Buffer.concat(chunks));
    return;
  }

  if (output && typeof output.getReader === 'function') {
    const reader = output.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    fs.writeFileSync(dest, Buffer.concat(chunks));
    return;
  }

  throw new Error(`Unexpected output for ${dest}`);
}

for (const rock of ROCKS) {
  const raw = path.join(ROOT, `${rock.name}-raw.png`);
  const out = path.join(ROOT, `${rock.name}.png`);

  console.log(`Generating ${rock.name}...`);

  const output = await replicate.run('recraft-ai/recraft-v3', {
    input: {
      prompt: rock.prompt,
      output_format: 'png',
      style: 'digital_illustration',
      substyle: 'hand_drawn',
      size: '1024x1024',
    },
  });

  await writeOutput(output, raw);

  try {
    execSync(`sips -s format png "${raw}" --out "${raw}"`, { stdio: 'ignore' });
  } catch { /* already png */ }

  execSync(`python3 scripts/postprocess-rock.py "${raw}" "${out}"`, {
    stdio: 'inherit',
    cwd: path.resolve('.'),
  });
}

execSync('python3 scripts/derive-rock-variants.py', {
  stdio: 'inherit',
  cwd: path.resolve('.'),
});

console.log('Done.');
