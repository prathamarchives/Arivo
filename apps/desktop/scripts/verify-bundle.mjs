#!/usr/bin/env node
/**
 * verify-bundle.mjs — the packaged-launch gate.
 *
 * WHY THIS EXISTS: electron 44 embeds node 22.18+, where runtime
 * type-stripping is ON but REFUSED for files under node_modules. our
 * @arivo/* workspace packages ship raw TypeScript ("main": "src/index.ts").
 * if the main or preload bundle leaves an @arivo import externalized, the
 * PACKAGED app (asar = real node_modules paths, no pnpm symlink masking)
 * dies with ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING before a single
 * window exists. v0.2.1 shipped exactly that and could not launch at all.
 *
 * dev and `electron . --smoke` CANNOT catch this class: node_modules/@arivo/*
 * are symlinks there, realpaths outside node_modules, type-stripping OK.
 * only this scan (or booting a real package) sees the truth. so every build
 * runs this scan and fails loudly on:
 *   1. any runtime require() of an @arivo/* workspace package
 *   2. any runtime require() resolving to a .ts/.mts/.cts file
 *
 * exit 0 = safe to package. exit 1 = fix electron.vite.config.ts bundles.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'out');

const targets = [join(out, 'main', 'index.js'), join(out, 'preload', 'index.js')];

// require("pkg") / require('pkg') — the runtime-external form.
// dynamic import("pkg") too, for completeness.
const requirePattern = /(?:require\(|import\()\s*(['"])([^'"]+)\1\s*\)/g;

const ARIVO = /^@arivo\//;
const TS_FILE = /\.(?:ts|mts|cts)$/;

let failed = false;

for (const file of targets) {
  if (!existsSync(file)) {
    console.error(`✗ ${file} — bundle missing; build first`);
    failed = true;
    continue;
  }
  const code = readFileSync(file, 'utf8');
  let m;
  while ((m = requirePattern.exec(code)) !== null) {
    const spec = m[2];
    if (ARIVO.test(spec)) {
      console.error(
        `✗ ${file}: runtime require("${spec}") — @arivo workspace package was NOT bundled.\n` +
          `    add it to the bundles list in electron.vite.config.ts (the packaging law).`
      );
      failed = true;
    } else if (TS_FILE.test(spec)) {
      console.error(`✗ ${file}: runtime require("${spec}") — .ts modules can never be required at runtime`);
      failed = true;
    }
  }
}

if (failed) {
  console.error(
    '\nverify-bundle: FAILED — this build would crash the packaged app at launch\n' +
      '(ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPING, the v0.2.1 launch bug).'
  );
  process.exit(1);
}

console.log('verify-bundle: ok — no externalized @arivo/.ts requires in main/preload');
