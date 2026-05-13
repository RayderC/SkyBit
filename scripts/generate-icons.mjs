/**
 * Run once after npm install to generate PWA icons from favicon.png:
 *   node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public', 'favicon.png');
const outDir = join(root, 'public', 'icons');

if (!existsSync(src)) {
  console.error('favicon.png not found in public/. Copy your favicon there first.');
  process.exit(1);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon-180x180.png', size: 180 },
];

for (const { name, size } of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(outDir, name));
  console.log(`Generated ${name}`);
}

console.log('Icons generated successfully!');
