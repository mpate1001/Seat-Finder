// scripts/verify-setup-split.mjs
//
// Build-time grep gate enforcing TOOL-03 bundle isolation (Phase 5).
//
// Runs as the last step of `npm run build` (after verify-pwa-build.mjs) so CI
// fails immediately if Vite silently regresses the route-based code-split and
// the OpenCV/Tesseract payload leaks into the guest entry chunk.
//
// What this script verifies against dist/assets/*.js:
//
//   1. The guest entry chunk(s) matching /^index-[A-Za-z0-9_-]+\.js$/ contain
//      NONE of the forbidden strings (case-insensitive). Forbidden list:
//        - 'opencv'                   — package name (preserved in chunk metadata)
//        - 'tesseract'                — package name
//        - 'HoughCircles'             — OpenCV API identifier
//        - 'tessedit_char_whitelist'  — Tesseract config string literal
//        - 'runDetectionPipeline'     — setup-only orchestrator symbol
//        - 'DraftPin'                 — setup-only type symbol
//
//   2. At least ONE setup chunk (file matching /setup|SetupApp/i) contains
//      either 'opencv' or 'tesseract'. This is the positive-assertion side:
//      if the lazy import got tree-shaken into nothing, the grep gate would
//      falsely pass on (1) alone. This catches that class of regression.
//
// Exit codes:
//   0 = guest entry is clean AND a setup chunk exists with CV deps
//   1 = violation OR missing dist/assets OR no entry chunk OR no CV setup chunk

import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const dist = resolve('dist', 'assets');

if (!existsSync(dist)) {
  console.error(`verify-setup-split FAILED: ${dist} not found.`);
  console.error('Did `vite build` run?');
  process.exit(1);
}

const jsFiles = readdirSync(dist).filter((f) => f.endsWith('.js'));

const entryCandidates = jsFiles.filter((f) =>
  /^index-[A-Za-z0-9_-]+\.js$/.test(f),
);
if (entryCandidates.length === 0) {
  console.error(
    'verify-setup-split FAILED: no guest entry chunk found (expected index-*.js in dist/assets/).',
  );
  process.exit(1);
}

// Narrow, minification-resistant tokens. We deliberately avoid `createWorker`
// (too generic — many unrelated deps export a helper with that name and would
// false-positive on minified bundles) and `SetupApp` (minifier may rename the
// component, and the string might appear in an error stack frame). Instead we
// use Tesseract's runtime config key `tessedit_char_whitelist` and the
// setup-only symbol `runDetectionPipeline` — both survive minification and
// are unique.
const forbidden = [
  'opencv', // package name (preserved in chunk metadata when loaded)
  'tesseract', // package name
  'HoughCircles', // OpenCV API identifier (not minified across module boundary)
  'tessedit_char_whitelist', // Tesseract config string literal — not minified
  'runDetectionPipeline', // setup-only internal symbol
  'DraftPin', // setup-only type symbol
];

const entryViolations = [];
for (const f of entryCandidates) {
  const content = readFileSync(resolve(dist, f), 'utf8');
  const lowered = content.toLowerCase();
  for (const needle of forbidden) {
    if (lowered.includes(needle.toLowerCase())) {
      entryViolations.push({ file: f, needle });
    }
  }
}

if (entryViolations.length > 0) {
  console.error(
    'verify-setup-split FAILED: forbidden strings found in guest entry chunk(s):',
  );
  for (const v of entryViolations) {
    console.error(`  ${v.file}: matched "${v.needle}"`);
  }
  console.error(
    '\nTOOL-03 violated — setup code has leaked into the guest bundle.',
  );
  console.error(
    'Check that @techstark/opencv-js and tesseract.js are imported ONLY from files under src/setup/,',
  );
  console.error(
    'and that src/main.tsx uses `lazy(() => import("./setup/SetupApp"))` (not a static import).',
  );
  process.exit(1);
}

// Positive assertion: a setup chunk exists AND contains at least one of
// opencv / tesseract. Guards against the "tree-shaken into nothing" regression
// where the forbidden-list check would trivially pass.
const setupCandidates = jsFiles.filter((f) => /setup|SetupApp/i.test(f));
let cvSetupChunk = null;
for (const f of setupCandidates) {
  const content = readFileSync(resolve(dist, f), 'utf8').toLowerCase();
  if (content.includes('opencv') || content.includes('tesseract')) {
    cvSetupChunk = f;
    break;
  }
}

if (!cvSetupChunk) {
  console.error(
    'verify-setup-split FAILED: no setup chunk found containing opencv or tesseract.',
  );
  console.error(
    'Did the lazy import resolve during build? Expected a file matching /setup|SetupApp/i in dist/assets/',
  );
  console.error('containing either "opencv" or "tesseract" string.');
  console.error(`Setup-candidate files seen: ${JSON.stringify(setupCandidates)}`);
  process.exit(1);
}

console.log('verify-setup-split passed.');
console.log(`  Clean guest entry chunk(s): ${JSON.stringify(entryCandidates)}`);
console.log(`  Setup chunk(s): ${JSON.stringify(setupCandidates)}`);
console.log(`  CV chunk verified: ${cvSetupChunk}`);
