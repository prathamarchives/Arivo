/**
 * THE EFFECT REGISTRY (L12) — docs/EFFECTS.md's claims, made executable.
 * every effect listed in the registry must actually exist with its
 * contract: the glass failure path, the bounded grain, the token-
 * budgeted blur, the atmosphere's reduced-motion twin. the gatekeeper's
 * ledger is not a document — it is a test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const TOKENS = readFileSync(join(ROOT, 'packages/ui/src/tokens.css'), 'utf-8');
const BASE = readFileSync(join(ROOT, 'packages/ui/src/base.css'), 'utf-8');
const COMPONENTS = readFileSync(join(ROOT, 'packages/ui/src/components/components.css'), 'utf-8');
const APP_CSS = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/styles/app.css'), 'utf-8');
const SHELL_CSS = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/shell/shell.css'), 'utf-8');
const BOOKLIGHT = readFileSync(
  join(ROOT, 'apps/desktop/src/renderer/src/lib/booklight.ts'),
  'utf-8',
);

const EFFECT_CSS = [BASE, COMPONENTS, APP_CSS, SHELL_CSS].join('\n');

/** the registry's own copy — the doc and the code must speak together */
const REGISTRY = readFileSync(join(ROOT, 'docs/EFFECTS.md'), 'utf-8');

describe('the effect registry (L12)', () => {
  it('the registry lists exactly the live effect families', () => {
    for (const name of [
      'paper grain',
      'soft glass',
      'booklight',
      'the page-turn beat',
      'shelf camera transitions',
      'progress hairline',
    ]) {
      expect(REGISTRY.toLowerCase()).toContain(name.toLowerCase());
    }
    // the rejected list is part of the ledger's honesty
    expect(REGISTRY).toContain('registered and rejected');
  });

  it('soft glass has its failure path — both material classes', () => {
    for (const cls of ['.glass', '.mat-glass']) {
      const block = BASE.includes(cls)
        ? BASE
        : COMPONENTS;
      expect(block).toContain(`${cls} {`);
      expect(block).toMatch(
        new RegExp(`@supports not \\(\\(backdrop-filter: blur\\(1px\\)\\)`),
      );
      expect(block).toContain('background: var(--bg-raised)');
    }
  });

  it('blur is token-budgeted — no raw backdrop-filter radius in effect css', () => {
    // every backdrop-filter must reference a budget token, never a literal
    // px (the @supports capability probe's blur(1px) is not a style)
    for (const m of EFFECT_CSS.matchAll(/backdrop-filter:\s*([^;]+);/g)) {
      const v = m[1];
      if (v.includes('blur(1px)')) continue; // the capability probe
      if (v.trim() === 'none') continue; // the fallback's explicit disable
      expect(v).toMatch(/var\(--(glass|scrim)-blur\)/);
    }
    // and the tokens hold the recipe's resolved numbers
    expect(TOKENS).toMatch(/--glass-blur:\s*16px/);
    expect(TOKENS).toMatch(/--scrim-blur:\s*6px/);
  });

  it('paper grain is bounded — a whisper, never a texture', () => {
    const m = TOKENS.match(/--paper-grain-opacity:\s*([\d.]+);/);
    expect(m).not.toBeNull();
    const opacity = Number(m![1]);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThanOrEqual(0.05);
    // the layer is fixed + pointer-transparent: no per-frame cost
    expect(BASE).toMatch(/body::before\s*\{[^}]*position:\s*fixed/s);
    expect(BASE).toMatch(/body::before\s*\{[^}]*pointer-events:\s*none/s);
  });

  it('booklight clamps its wash — the light can never compete with text', () => {
    // the pipeline's clamps are real code, not prose
    expect(BOOKLIGHT).toMatch(/clamp|saturate/i);
    // v0.3.2: one room, one light — the aura applies with no temperament gate
    expect(BOOKLIGHT).not.toContain("'lab'");
  });

  it('the atmosphere twin exists — booklight shifts collapse under reduced motion', () => {
    const block = TOKENS.slice(TOKENS.indexOf('prefers-reduced-motion'));
    expect(block).toContain('--dur-atmosphere: 0ms');
  });

  it('glass stays scarce — never a wall material', () => {
    // the wall surfaces are matte, never glass
    for (const wall of ['.shelf-grid', '.reader', '.archive', '.drawer']) {
      const block = EFFECT_CSS.match(new RegExp(`${wall.replace('.', '\\.')}\\s*\\{[^}]*\\}`, 's'))?.[0] ?? '';
      expect(block).not.toContain('backdrop-filter');
    }
  });

  it('the annotation identity colors remain the only saturated privilege', () => {
    // the five survive untouched, constant across every effect surface
    for (const [name, hex] of [
      ['--anno-amber', '#DCA93B'],
      ['--anno-sage', '#6E9951'],
      ['--anno-blue', '#4E8FC4'],
      ['--anno-rose', '#C66A67'],
      ['--anno-violet', '#9074C2'],
    ]) {
      expect(TOKENS).toContain(`${name}: ${hex}`);
    }
  });
});
