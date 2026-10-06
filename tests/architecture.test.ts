/**
 * THE ARCHITECTURE IS EXECUTABLE — dependency rules as tests.
 * eslint enforces them at lint time; these prove them at test time
 * (defense in depth: CI gates run tests even when lint is skipped).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'out' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const importsOf = (file: string): string[] => {
  const src = readFileSync(file, 'utf-8');
  const specifiers: string[] = [];
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) specifiers.push(m[1]!);
  for (const m of src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(m[1]!);
  for (const m of src.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(m[1]!);
  return specifiers;
};

const rel = (file: string): string => relative(ROOT, file).split('\\').join('/');

const violations = (dir: string, banned: (spec: string) => boolean): { file: string; spec: string }[] => {
  const out: { file: string; spec: string }[] = [];
  for (const file of walk(join(ROOT, dir))) {
    for (const spec of importsOf(file)) {
      if (banned(spec)) out.push({ file: rel(file), spec });
    }
  }
  return out;
};

describe('the layering law (I-26 + the dependency law)', () => {
  it('core is PURE: no arivo packages, no node builtins, no electron', () => {
    const bad = violations('packages/core/src', (spec) =>
      spec.startsWith('@arivo/') || spec.startsWith('node:') || spec === 'electron',
    );
    expect(bad).toEqual([]);
  });

  it('persistence is a leaf: no arivo packages, no electron', () => {
    const bad = violations('packages/persistence/src', (spec) =>
      spec.startsWith('@arivo/') || spec === 'electron',
    );
    expect(bad).toEqual([]);
  });

  it('database never reaches documents/ui/reader/electron', () => {
    const bad = violations('packages/database/src', (spec) =>
      ['@arivo/documents', '@arivo/ui', '@arivo/reader', 'electron'].includes(spec),
    );
    expect(bad).toEqual([]);
  });

  it('documents never reaches database/ui/reader/electron', () => {
    const bad = violations('packages/documents/src', (spec) =>
      ['@arivo/database', '@arivo/ui', '@arivo/reader', 'electron'].includes(spec),
    );
    expect(bad).toEqual([]);
  });

  it('reader never reaches database/documents', () => {
    const bad = violations('packages/reader/src', (spec) =>
      ['@arivo/database', '@arivo/documents'].includes(spec),
    );
    expect(bad).toEqual([]);
  });

  it('ui never reaches database/documents/reader/electron', () => {
    const bad = violations('packages/ui/src', (spec) =>
      ['@arivo/database', '@arivo/documents', '@arivo/reader', 'electron'].includes(spec),
    );
    expect(bad).toEqual([]);
  });
});

describe('the renderer isolation law (I-26)', () => {
  it('renderer code never imports electron or node builtins', () => {
    const bad = violations('apps/desktop/src/renderer', (spec) =>
      spec === 'electron' || spec.startsWith('node:'),
    );
    expect(bad).toEqual([]);
  });

  it('renderer code never touches the ipc bridge directly (only window.arivo)', () => {
    const bad = walk(join(ROOT, 'apps/desktop/src/renderer'))
      .filter((f) => readFileSync(f, 'utf-8').includes('ipcRenderer'))
      .map(rel);
    expect(bad).toEqual([]);
  });

  it('preload is the only bridge: electron + @arivo/core only', () => {
    const files = walk(join(ROOT, 'apps/desktop/src/preload'));
    expect(files.length).toBeGreaterThan(0);
    const bad: { file: string; spec: string }[] = [];
    for (const file of files) {
      for (const spec of importsOf(file)) {
        const allowed =
          spec === 'electron' || spec.startsWith('@arivo/core') || spec.startsWith('./');
        if (!allowed) bad.push({ file: rel(file), spec });
      }
    }
    expect(bad).toEqual([]);
  });

  it('preload scripts are the only contextBridge users', () => {
    const bridgeUsers = walk(join(ROOT, 'apps/desktop/src'))
      .filter((f) => readFileSync(f, 'utf-8').includes('contextBridge'))
      .map(rel);
    expect(bridgeUsers.every((f) => f.startsWith('apps/desktop/src/preload'))).toBe(true);
  });
});

describe('the single-instance discipline (I-30)', () => {
  it('main requests the instance lock before anything else', () => {
    const main = readFileSync(join(ROOT, 'apps/desktop/src/main/index.ts'), 'utf-8');
    expect(main.includes('requestSingleInstanceLock')).toBe(true);
    // the lock is checked before the window is created
    const lockAt = main.indexOf('requestSingleInstanceLock');
    const readyAt = main.indexOf('app.whenReady');
    expect(lockAt).toBeGreaterThan(-1);
    expect(readyAt).toBeGreaterThan(lockAt);
  });
});
