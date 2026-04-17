// scripts/verify-pwa-build.mjs
//
// Build-time smoke test for Phase 4 PWA artifacts. Runs as the last step of
// `npm run build` so CI fails immediately if vite-plugin-pwa or the icon
// pipeline silently stops emitting a required file.
//
// Checked artifacts (RESEARCH.md §9c + plan 04-03 + plan 04-05):
//   dist/manifest.webmanifest
//   dist/sw.js
//   dist/workbox-<hash>.js   (pattern match — hash changes per build)
//   dist/pwa-192.png
//   dist/pwa-512.png
//   dist/pwa-512-maskable.png
//   dist/apple-touch-icon.png
//
// Exit codes:
//   0 = all required artifacts present
//   1 = at least one artifact missing (prints the list)

import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const dist = resolve('dist');

if (!existsSync(dist)) {
  console.error(`PWA verify FAILED: dist/ directory not found at ${dist}`);
  console.error('Did `vite build` run?');
  process.exit(1);
}

const requiredExact = [
  'manifest.webmanifest',
  'sw.js',
  'pwa-192.png',
  'pwa-512.png',
  'pwa-512-maskable.png',
  'apple-touch-icon.png',
];

const requiredPatterns = [
  /^workbox-[a-f0-9]+\.js$/,
];

const missingExact = requiredExact.filter((f) => !existsSync(resolve(dist, f)));

const files = readdirSync(dist);
const missingPatterns = requiredPatterns.filter(
  (re) => !files.some((f) => re.test(f)),
);

if (missingExact.length > 0 || missingPatterns.length > 0) {
  console.error('PWA build verification FAILED:');
  if (missingExact.length > 0) {
    console.error('  Missing files:', missingExact);
  }
  if (missingPatterns.length > 0) {
    console.error(
      '  Missing patterns:',
      missingPatterns.map((r) => r.source),
    );
  }
  process.exit(1);
}

const matched = files.filter((f) =>
  /manifest|sw\.|workbox|pwa-|apple-/.test(f),
);
console.log('PWA build verification passed.');
console.log('Matched artifacts:', matched.sort());
