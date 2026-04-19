#!/usr/bin/env node
/**
 * calibrate-hough.mjs — Phase 5 Plan 05-02 (Wave 0 calibration).
 *
 * Runs the Hough Circle Transform against the real Reception Seat Diagram
 * PNG in Node and prints recall / false-positive numbers vs the 54 ground-
 * truth table positions in src/config/floorPlan.json. Writes the same
 * report to .planning/phases/05-setup-tooling/05-02-calibration.md so the
 * human-verify checkpoint can review the numbers before plans 05-04 / 05-05
 * commit to DEFAULT_HOUGH.
 *
 * Image source preference (first existing path wins):
 *   1. public/FINAL_Reception Table Arrangments.png   — final admin-approved variant
 *   2. public/floor-plan/floor-plan-1600.png          — Phase 3 optimized output
 *   3. src/assets/Reception Seat Diagram.png          — original master
 *
 * Exits 0 always — the human-verify checkpoint is the decision gate.
 *
 * Reference: .planning/phases/05-setup-tooling/05-02-PLAN.md
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 3, §Pitfall 1, §Pitfall 6
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Candidate images in priority order.
const imageCandidates = [
  'public/FINAL_Reception Table Arrangments.png',
  'public/floor-plan/floor-plan-1600.png',
  'src/assets/Reception Seat Diagram.png',
];

function findImage() {
  for (const rel of imageCandidates) {
    const abs = resolve(repoRoot, rel);
    if (existsSync(abs)) {
      return { rel, abs };
    }
  }
  throw new Error(
    `No calibration image found. Tried:\n  - ${imageCandidates.join('\n  - ')}`,
  );
}

// --------------------------------------------------------------------------
// Load opencv-js and wait for the WASM runtime.
// --------------------------------------------------------------------------

async function loadOpenCv() {
  const mod = await import('@techstark/opencv-js');
  const cv = mod.default ?? mod.cv ?? mod;
  if (typeof cv.Mat === 'function') return cv;
  await new Promise((resolvePromise) => {
    // Race the runtime-ready hook + a polling fallback — @techstark's
    // Node build sometimes resolves synchronously by the time the await
    // returns, sometimes signals via onRuntimeInitialized.
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      resolvePromise();
    };
    cv.onRuntimeInitialized = done;
    const pollStart = Date.now();
    const poll = () => {
      if (resolved) return;
      if (typeof cv.Mat === 'function') return done();
      if (Date.now() - pollStart > 15000) {
        throw new Error('OpenCV WASM runtime did not initialise within 15s');
      }
      setTimeout(poll, 50);
    };
    poll();
  });
  return cv;
}

// --------------------------------------------------------------------------
// Ground-truth loader.
// --------------------------------------------------------------------------

function loadGroundTruth() {
  const p = resolve(repoRoot, 'src/config/floorPlan.json');
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  const entries = Object.entries(raw.tablePositions).map(([id, pos]) => ({
    id,
    x: pos.x,
    y: pos.y,
  }));
  return { entries, canvasWidth: raw.canvasWidth, canvasHeight: raw.canvasHeight };
}

// --------------------------------------------------------------------------
// Default Hough parameters (mirror of src/setup/houghDefaults.ts).
// The Node script cannot easily import the .ts file; we keep the values in
// sync by duplicating the math, and the calibration artifact records both
// the source file reference and the exact numbers used.
// --------------------------------------------------------------------------

const HOUGH_DP = 1;
const HOUGH_PARAM1 = 100;
const HOUGH_PARAM2 = 30;
const MIN_DIST_FRACTION = 0.03;
const MIN_RADIUS_FRACTION = 0.012;
const MAX_RADIUS_FRACTION = 0.035;

function defaultHough(imageWidth) {
  return {
    dp: HOUGH_DP,
    minDist: Math.max(1, Math.round(imageWidth * MIN_DIST_FRACTION)),
    param1: HOUGH_PARAM1,
    param2: HOUGH_PARAM2,
    minRadius: Math.max(1, Math.round(imageWidth * MIN_RADIUS_FRACTION)),
    maxRadius: Math.max(2, Math.round(imageWidth * MAX_RADIUS_FRACTION)),
  };
}

// --------------------------------------------------------------------------
// Core detection routine — mirrors the browser pipeline exactly (D-06).
// Every cv.Mat is tracked in a disposer stack (Pitfall 1).
// --------------------------------------------------------------------------

async function detectCircles(cv, imagePath) {
  // Decode via sharp to raw RGBA (handles PNG / JPEG / WebP / AVIF).
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) {
    throw new Error(`Expected 4-channel RGBA, got ${channels}`);
  }

  const mats = [];
  const track = (mat) => {
    mats.push(mat);
    return mat;
  };

  try {
    // matFromImageData wants { data: Uint8ClampedArray, width, height }.
    const src = track(
      cv.matFromImageData({
        data: new Uint8ClampedArray(
          data.buffer,
          data.byteOffset,
          data.byteLength,
        ),
        width,
        height,
      }),
    );

    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const blurred = track(new cv.Mat());
    cv.GaussianBlur(
      gray,
      blurred,
      new cv.Size(5, 5),
      1.5,
      1.5,
      cv.BORDER_DEFAULT,
    );

    const circles = track(new cv.Mat());
    const opts = defaultHough(width);
    cv.HoughCircles(
      blurred,
      circles,
      cv.HOUGH_GRADIENT,
      opts.dp,
      opts.minDist,
      opts.param1,
      opts.param2,
      opts.minRadius,
      opts.maxRadius,
    );

    // circles is 1×N×3 (CV_32FC3): [cx, cy, r] per detection.
    const detected = [];
    for (let i = 0; i < circles.cols; i += 1) {
      const cx = circles.data32F[i * 3];
      const cy = circles.data32F[i * 3 + 1];
      const r = circles.data32F[i * 3 + 2];
      detected.push({ cx, cy, r });
    }
    return { detected, width, height, opts };
  } finally {
    for (const m of mats) {
      try {
        m.delete();
      } catch {
        // Already deleted or never initialised — ignore.
      }
    }
  }
}

// --------------------------------------------------------------------------
// Match detections against ground truth in fraction space.
// - Recall:  ground-truth tables matched by any detection within MATCH_TOL.
// - FP:      detections with no ground-truth match within FP_TOL.
// --------------------------------------------------------------------------

const MATCH_TOL = 0.02; // 2% of image width
const FP_TOL = 0.03; // 3% of image width

function matchDetections(detected, groundTruth, width, height) {
  const detectedFrac = detected.map((c) => ({
    cxFrac: c.cx / width,
    cyFrac: c.cy / height,
    rFrac: c.r / width,
    cxPx: c.cx,
    cyPx: c.cy,
    rPx: c.r,
  }));

  const perTable = groundTruth.map((gt) => {
    let best = null;
    let bestDist = Infinity;
    for (const d of detectedFrac) {
      const dx = d.cxFrac - gt.x;
      const dy = d.cyFrac - gt.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return { gt, match: best, dist: bestDist };
  });

  const recallCount = perTable.filter((t) => t.dist <= MATCH_TOL).length;

  // False positives: detections that have no ground truth within FP_TOL.
  const fpCount = detectedFrac.filter((d) => {
    let bestDist = Infinity;
    for (const gt of groundTruth) {
      const dist = Math.hypot(d.cxFrac - gt.x, d.cyFrac - gt.y);
      if (dist < bestDist) bestDist = dist;
    }
    return bestDist > FP_TOL;
  }).length;

  return { perTable, recallCount, fpCount, detectedFrac };
}

// --------------------------------------------------------------------------
// Report formatting.
// --------------------------------------------------------------------------

function formatReport({
  imageRel,
  width,
  height,
  opts,
  detected,
  recallCount,
  fpCount,
  perTable,
  groundTruthCount,
  timestamp,
}) {
  const recallPct = ((recallCount / groundTruthCount) * 100).toFixed(1);
  const lines = [];
  lines.push(`# Phase 5 Hough Calibration — ${timestamp}`);
  lines.push('');
  lines.push(`**Image:** \`${imageRel}\` (${width}×${height})`);
  lines.push('');
  lines.push(
    `**Defaults used:** dp=${opts.dp}, minDist=${opts.minDist}px, ` +
      `param1=${opts.param1}, param2=${opts.param2}, ` +
      `minRadius=${opts.minRadius}px, maxRadius=${opts.maxRadius}px`,
  );
  lines.push('');
  lines.push(`**Fractions:** minDist=${MIN_DIST_FRACTION}, ` +
    `minRadius=${MIN_RADIUS_FRACTION}, maxRadius=${MAX_RADIUS_FRACTION} ` +
    `(see \`src/setup/houghDefaults.ts\`)`);
  lines.push('');
  lines.push(`**Detected:** ${detected.length} circles`);
  lines.push(
    `**Recall:** ${recallCount}/${groundTruthCount} (${recallPct}%) — ` +
      `match tolerance ${MATCH_TOL} fraction`,
  );
  lines.push(
    `**False positives:** ${fpCount} (detections with no ground-truth within ${FP_TOL} fraction)`,
  );
  lines.push('');

  // Gate status
  const recallOk = recallCount >= 45;
  const fpOk = fpCount <= 20;
  const gateLabel =
    recallOk && fpOk
      ? 'PASS — defaults meet Pitfall 6 gate (recall ≥ 45, FP ≤ 20)'
      : `TUNE — ${!recallOk ? `recall below 45/${groundTruthCount}` : ''}${
          !recallOk && !fpOk ? ', ' : ''
        }${!fpOk ? `FP above 20 (${fpCount})` : ''}`;
  lines.push(`**Pitfall-6 gate:** ${gateLabel}`);
  lines.push('');

  // Per-table table.
  lines.push('## Per-table matches');
  lines.push('');
  lines.push('| Table | GT (x, y) | Detected (cx, cy, r px) | Δ fraction | Status |');
  lines.push('| ----- | --------- | ----------------------- | ---------- | ------ |');
  for (const row of perTable) {
    const gt = `${row.gt.x.toFixed(4)}, ${row.gt.y.toFixed(4)}`;
    let det = '—';
    let delta = '—';
    let status = 'MISS';
    if (row.match && row.dist <= MATCH_TOL) {
      det = `${row.match.cxPx.toFixed(0)}, ${row.match.cyPx.toFixed(0)}, ${row.match.rPx.toFixed(0)}`;
      delta = row.dist.toFixed(4);
      status = 'ok';
    } else if (row.match && row.dist <= FP_TOL) {
      det = `${row.match.cxPx.toFixed(0)}, ${row.match.cyPx.toFixed(0)}, ${row.match.rPx.toFixed(0)}`;
      delta = row.dist.toFixed(4);
      status = 'near';
    }
    lines.push(`| ${row.gt.id} | ${gt} | ${det} | ${delta} | ${status} |`);
  }
  lines.push('');
  lines.push('## Accepted defaults');
  lines.push('');
  lines.push('_To be filled in by the human-verify checkpoint (Task 4). Record the');
  lines.push('final DEFAULT_HOUGH values chosen and a one-line rationale._');
  lines.push('');
  return lines.join('\n');
}

// --------------------------------------------------------------------------
// main()
// --------------------------------------------------------------------------

(async () => {
  const { rel: imageRel, abs: imageAbs } = findImage();
  console.log(`Calibration image: ${imageRel}`);

  console.log('Loading @techstark/opencv-js...');
  const cv = await loadOpenCv();
  console.log('  OpenCV ready.');

  console.log('Loading ground truth from src/config/floorPlan.json...');
  const { entries: groundTruth } = loadGroundTruth();
  console.log(`  ${groundTruth.length} ground-truth tables loaded.`);

  console.log('Running Hough Circle Transform...');
  const { detected, width, height, opts } = await detectCircles(cv, imageAbs);
  console.log(
    `  Image: ${width}×${height}. Detected: ${detected.length} circles.`,
  );

  const { perTable, recallCount, fpCount } = matchDetections(
    detected,
    groundTruth,
    width,
    height,
  );
  const recallPct = ((recallCount / groundTruth.length) * 100).toFixed(1);
  console.log(
    `  Recall: ${recallCount}/${groundTruth.length} (${recallPct}%)  FP: ${fpCount}`,
  );
  console.log(
    `  Hough: dp=${opts.dp} minDist=${opts.minDist}px ` +
      `param1=${opts.param1} param2=${opts.param2} ` +
      `minRadius=${opts.minRadius}px maxRadius=${opts.maxRadius}px`,
  );

  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const report = formatReport({
    imageRel,
    width,
    height,
    opts,
    detected,
    recallCount,
    fpCount,
    perTable,
    groundTruthCount: groundTruth.length,
    timestamp,
  });

  const outPath = resolve(
    repoRoot,
    '.planning/phases/05-setup-tooling/05-02-calibration.md',
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, report, 'utf8');
  console.log(`\nReport written to: ${outPath}`);

  const recallOk = recallCount >= 45;
  const fpOk = fpCount <= 20;
  if (recallOk && fpOk) {
    console.log('PASS — defaults meet Pitfall 6 gate.');
  } else {
    console.log(
      'TUNE — Pitfall 6 gate not met. Edit src/setup/houghDefaults.ts and re-run.',
    );
  }
  process.exit(0);
})().catch((err) => {
  console.error('Calibration failed:', err);
  process.exit(1);
});
