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
const OUT = path.resolve('assets/images/rocks/test-rock-recraft.png');

// Same recipe as the first beautiful variant (hand_drawn stipple rock),
// only land flora swapped for underwater cues.
const prompt = `dark grey rock, triangular shape, pointing up, thick black outline, cartoon style, cracks on surface, completely isolated object, pure white background, hand-drawn stipple shading, 2D game sprite`;

console.log('Generating underwater rock (Recraft hand_drawn)...');

const output = await replicate.run('recraft-ai/recraft-v3', {
  input: {
    prompt,
    output_format: 'png',
    style: 'digital_illustration',
    substyle: 'hand_drawn',
    size: '1024x1024',
  },
});

async function writeStream(stream, dest) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  fs.writeFileSync(dest, Buffer.concat(chunks));
}

async function writeReadableStream(stream, dest) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  fs.writeFileSync(dest, Buffer.concat(chunks));
}

if (output && typeof output[Symbol.asyncIterator] === 'function') {
  await writeStream(output, OUT);
} else if (output && typeof output.getReader === 'function') {
  await writeReadableStream(output, OUT);
} else {
  console.error('Unexpected output:', output);
  process.exit(1);
}

// WebP -> PNG on macOS
try {
  execSync(`sips -s format png "${OUT}" --out "${OUT}"`, { stdio: 'ignore' });
} catch { /* already png */ }

console.log(`Raw -> ${OUT}`);

execSync('python3 scripts/postprocess-rock.py assets/images/rocks/test-rock-recraft.png assets/images/rocks/test-rock.png', {
  stdio: 'inherit',
  cwd: path.resolve('.'),
});
