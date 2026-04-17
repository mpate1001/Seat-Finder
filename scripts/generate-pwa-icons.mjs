// scripts/generate-pwa-icons.mjs
//
// Generates 4 PNG icons for the PWA manifest from an inline teardrop-pin SVG.
// Analog: scripts/generate-images.mjs (Phase 3) -- same __dirname shim, same
// logging shape, same sharp pipeline.
//
// Outputs (overwrites each run):
//   public/pwa-192.png                   192x192   navy bg, pin at 68% canvas
//   public/pwa-512.png                   512x512   navy bg, pin at 68% canvas
//   public/pwa-512-maskable.png          512x512   navy bg, pin at 56% canvas (safe zone)
//   public/apple-touch-icon.png          180x180   navy bg, pin at 68% canvas (no pre-round)

import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '../public');

mkdirSync(out, { recursive: true });

// Brand palette -- locked to CONTEXT D-10/D-11 / UI-SPEC
const NAVY = '#2b2d42';
const RED = '#d90429';
const WHITE = '#ffffff';

// Teardrop pin -- same geometry as the assigned-table pin rendered in
// src/components/FloorPlan.tsx (viewBox 0 0 36 44, rounded-top teardrop).
function pinSvg({ size, innerScale, bg }) {
  const pinW = size * innerScale;
  const pinH = pinW * (44 / 36); // preserve 36:44 aspect
  const x = (size - pinW) / 2;
  const y = (size - pinH) / 2;
  const innerScaleFactor = pinW / 36;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" fill="${bg}" />` +
      `<g transform="translate(${x} ${y}) scale(${innerScaleFactor})">` +
        `<path d="M18 0 C8 0 0 8 0 18 C0 28 18 44 18 44 C18 44 36 28 36 18 C36 8 28 0 18 0 Z" ` +
          `fill="${RED}" stroke="${WHITE}" stroke-width="2" />` +
      `</g>` +
    `</svg>`
  );
}

async function emit(name, size, innerScale, bg) {
  const svg = pinSvg({ size, innerScale, bg });
  const dest = resolve(out, name);
  await sharp(svg).png({ compressionLevel: 9 }).toFile(dest);
  const { size: bytes } = statSync(dest);
  console.log(`Generated ${name.padEnd(30)} ${(bytes / 1024).toFixed(1)} KB`);
}

console.log(`Output: ${out}`);
console.log('');

// Normal PWA icons -- pin takes 68% of canvas (comfortable for all masks)
await emit('pwa-192.png', 192, 0.68, NAVY);
await emit('pwa-512.png', 512, 0.68, NAVY);

// Maskable 512 -- pin inside the W3C 80% safe zone circle (innerScale 0.56).
// Navy bleeds edge-to-edge so OS masks never reveal transparency.
// Reference: https://w3.org/TR/appmanifest/#icon-masks
await emit('pwa-512-maskable.png', 512, 0.56, NAVY);

// Apple touch icon 180 -- iOS applies its own squircle mask; do NOT pre-round.
await emit('apple-touch-icon.png', 180, 0.68, NAVY);

console.log('');
console.log('Done: 4 PWA icons written to /public');
