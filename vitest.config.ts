import { defineConfig } from 'vitest/config';

// the repo runs tests on: local dev machines (fast) and shared CI runners
// (windows, occasionally loaded — a re-run cost us a release). vitest's 5s
// default is a dev-machine number; data-invariant tests that touch real fs
// need room. tests that own a tighter contract still declare their own
// explicit timeout — this is only the floor. speed budgets live in the
// benchmark gate (docs/QUALITY-BAR.md), not here.
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
  },
});
