// Skyline Valley — Ring Runner: the hand-in program (Node 22, stdlib only).
//
// It gathers the entry and writes it to /output (or MAKEFUN_OUTPUT_DIR
// outside the grader): the game/ folder and screenshots/ copied as they
// stand, plus dossier.json, the summary the judge reads, built by the
// vendored make.fun library from the copied files.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The run is deterministic: same repository, same bytes in /output, so the
// grader's two runs agree byte for byte.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from an empty output directory so a stale file can never leak in.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// The game itself: plain static files, no build step, no network request.
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

// The screenshots, real renders of the game's own code.
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The dossier, built from the files just copied — the gate rebuilds it the
// same way and compares byte for byte. Caps mirror the scorer's own limits.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// Sanity-check the hand-in before reporting success: the dossier must fit
// the scorer's 1.5 MiB cap, and there must be 3 or 4 screenshots.
const dossierBytes = Buffer.byteLength(dossier);
if (dossierBytes > 1572864) {
  throw new Error(`dossier.json is ${dossierBytes} bytes, over the 1.5 MiB cap`);
}
const shotCount = readdirSync(join(outDir, 'screenshots')).length;
if (shotCount < 3 || shotCount > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shotCount}`);
}
console.log(`handed in: dossier.json ${dossierBytes} bytes, ${shotCount} screenshots`);
