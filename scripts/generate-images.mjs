import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, statSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../public/floor-plan/floor-plan-final.png');
const out = resolve(__dirname, '../public/floor-plan');

if (!existsSync(src)) {
  console.error(`Source image not found: ${src}`);
  console.error('Expected the floor plan PNG at public/floor-plan/floor-plan-final.png');
  process.exit(1);
}

mkdirSync(out, { recursive: true });

const widths = [900, 1600, 2400];
const formats = [
  { ext: 'avif', opts: { quality: 50 } },
  { ext: 'webp', opts: { quality: 80 } },
  { ext: 'png', opts: { compressionLevel: 9 } },
];

console.log(`Source: ${src}`);
console.log(`Output: ${out}`);
console.log('');

for (const width of widths) {
  for (const { ext, opts } of formats) {
    const dest = resolve(out, `floor-plan-${width}.${ext}`);
    const pipeline = sharp(src).resize(width);
    let encoded;
    if (ext === 'avif') encoded = pipeline.avif(opts);
    else if (ext === 'webp') encoded = pipeline.webp(opts);
    else encoded = pipeline.png(opts);
    await encoded.toFile(dest);
    const { size } = statSync(dest);
    console.log(`Generated floor-plan-${width}.${ext.padEnd(4)} ${(size / 1024).toFixed(1)} KB`);
  }
}

console.log('');
console.log(`Done: 9 variants written to ${out}`);
