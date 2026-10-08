import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// THE PACKAGING LAW — every @arivo/* workspace package must be BUNDLED.
//
// workspace packages ship raw TypeScript ("main": "src/index.ts"). in dev,
// node_modules/@arivo/* are pnpm symlinks whose realpath lives in packages/,
// so node's runtime type-stripping happily loads them. in the PACKAGED app
// the asar holds real node_modules/@arivo/*/src/*.ts paths — and node
// 22.18+ (electron 44) refuses to type-strip anything under node_modules:
//   ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING → the app dies before a
//   window exists. externalizing an @arivo import is a packaged-launch
// crash, not a style choice. if a new @arivo import shows up here, add its
// package to this list — verify-bundle.mjs fails the build if you forget.
const arivo = [
  '@arivo/core',
  '@arivo/database',
  '@arivo/documents',
  '@arivo/persistence',
  '@arivo/reader',
  '@arivo/ui',
];

const bundles = [...arivo, 'jszip'];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: bundles })],
    resolve: {
      alias: { '@': resolve(__dirname, 'src/renderer/src') },
    },
    build: {
      // native modules resolve from node_modules at runtime — never bundle
      rollupOptions: {
        external: ['better-sqlite3'],
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    // same law as main: bundle every @arivo import (see above)
    plugins: [externalizeDepsPlugin({ exclude: arivo })],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [
      react(),
      /* SECURITY (final campaign): the shared index.html carries the dev
       * CSP (ws: + localhost for HMR). production tightens it at build
       * time — the same policy minus the dev allowances, plus the
       * production origin. injected here so the source of truth stays
       * one file and no dev allowance ever ships. */
      {
        name: 'arivo-prod-csp',
        apply: 'build',
        transformIndexHtml(html: string): string {
          return html.replace(
            /<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/,
            `<meta http-equiv="Content-Security-Policy" content="default-src 'self' app://arivo; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' arivo: blob: data:; connect-src 'self' arivo: blob: data:; font-src 'self' data: blob:; frame-src blob: data:; worker-src 'self' blob:;">`,
          );
        },
      },
    ],
    resolve: {
      alias: { '@': resolve(__dirname, 'src/renderer/src') },
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
});
