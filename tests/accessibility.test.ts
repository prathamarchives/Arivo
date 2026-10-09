/**
 * THE ACCESSIBILITY LAW (L14) — the keyboard is a first-class reader.
 *
 * 1. one foundation rule gives every interactive element a visible
 *    focus ring — no per-class exceptions may exist instead of it.
 * 2. an outline may only be replaced, never removed: every
 *    `outline: none` lives in a block that provides an equivalent
 *    visible indicator (border or shadow).
 * 3. surfaces are bounded by their room: drawers never exceed the
 *    viewport, at any width.
 * 4. the shell's furniture persists at small widths (the responsive
 *    identity is structure, not disappearance).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const BASE = readFileSync(join(ROOT, 'packages/ui/src/base.css'), 'utf-8');
const COMPONENTS = readFileSync(join(ROOT, 'packages/ui/src/components/components.css'), 'utf-8');
const APP_CSS = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/styles/app.css'), 'utf-8');
const SHELL_CSS = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/shell/shell.css'), 'utf-8');
const TOKENS = readFileSync(join(ROOT, 'packages/ui/src/tokens.css'), 'utf-8');

const ALL_CSS = [BASE, COMPONENTS, APP_CSS, SHELL_CSS].join('\n');

/** pull each css rule block (selector { body }) with its body */
function rulesOf(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1]!.trim(), body: m[2]! });
  }
  return out;
}

describe('the accessibility law (L14)', () => {
  it('one foundation rule gives every interactive element visible focus', () => {
    const rule = BASE.match(/:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring\)[^}]*\}/);
    expect(rule).not.toBeNull();
    // the ring token exists and is ink — visible on every surface.
    // v0.5.0 — the catalyst port: the ring is a 1px hairline (the site's
    // own focus grammar), still full ink, still everywhere
    expect(TOKENS).toMatch(/--focus-ring:\s*1px solid var\(--ink\)/);
  });

  it('an outline may only be replaced, never silently removed', () => {
    const offenders: string[] = [];
    for (const { selector, body } of rulesOf(ALL_CSS)) {
      if (!/outline:\s*(none|0)/.test(body)) continue;
      // a rule that runs while focused must itself carry the indicator
      if (selector.includes(':focus')) {
        if (!/border-color|box-shadow|border-bottom-color/.test(body)) {
          offenders.push(selector.split('\n')[0]);
        }
        continue;
      }
      // a resting rule may clean the outline ONLY if a :focus-visible
      // sibling restores a visible indicator for the same selector
      const base = selector.split(':')[0].trim();
      const hasTwin = ALL_CSS.match(
        new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^{]*:focus-visible\\s*\\{[^}]*?(border-color|box-shadow|border-bottom-color)'),
      );
      if (!hasTwin) offenders.push(selector.split('\n')[0]);
    }
    expect(offenders).toEqual([]);
  });

  it('drawers are bounded by their room — never wider than the viewport', () => {
    const drawer = APP_CSS.match(/\.drawer\s*\{[^}]*\}/)?.[0] ?? '';
    expect(drawer).toMatch(/width:\s*min\(320px,\s*100%\)/);
    const wide = APP_CSS.match(/\.drawer-wide\s*\{[^}]*\}/)?.[0] ?? '';
    expect(wide).toMatch(/width:\s*min\(400px,\s*100%\)/);
  });

  it('the rail persists at every width — the overlay law keeps its furniture structural', () => {
    // v0.3.1: the icon column is the resting state at ALL widths; the
    // measured 1043 media query is gone (the rail floats, it never
    // competes with the work for pixels). structure survives; only the
    // labels follow the expansion.
    expect(SHELL_CSS).not.toContain('@media (max-width: 1043px)');
    // the rail is furniture at rest: fixed overlay, resting width
    const rail = SHELL_CSS.match(/\.rail\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rail).toMatch(/position:\s*fixed/);
    expect(rail).toMatch(/width:\s*var\(--rail-w-slim\)/);
    // expansion is a state, never a disappearance of the places
    const collapsed = SHELL_CSS.match(/\.rail:not\(\[data-expanded='true'\]\)\s+\.nav-item-label\s*\{[^}]*\}/)?.[0] ?? '';
    expect(collapsed).toMatch(/display:\s*none/);
    expect(SHELL_CSS).not.toMatch(/\.nav-item\s*\{[^}]{0,120}display:\s*none/);
  });

  it('every reduced-motion twin lives where motion is defined', () => {
    // the foundation twin collapses the whole duration ladder
    const reduced = TOKENS.slice(TOKENS.indexOf('prefers-reduced-motion'));
    for (const t of ['--dur-state', '--dur-comp-in', '--dur-turn', '--dur-material', '--dur-atmosphere']) {
      expect(reduced).toContain(t);
    }
    // app animations ride duration tokens (design-law forbids raw ms),
    // so the foundation twin collapses them; the files that define
    // motion beyond tokens carry their own twin blocks
    for (const css of [BASE, COMPONENTS, SHELL_CSS]) {
      expect(css).toMatch(/prefers-reduced-motion/);
    }
  });

  it('the landmarks and instruments are labeled for non-visual readers', () => {
    // the drawing toolbar is a toolbar; the drawers say what they are
    expect(readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/screens/PageObjects.tsx'), 'utf-8')).toContain(
      "role=\"toolbar\"",
    );
    // v0.3.2: the reader's drawer keeps its landmark label
    expect(readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/screens/Reader.tsx'), 'utf-8')).toContain(
      'aria-label="contents and bookmarks"',
    );
  });
});
