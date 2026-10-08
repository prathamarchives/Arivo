/**
 * the composite layer's gate — W6 must prove:
 *   composites are product concepts, not arrangements · they compose
 *   primitives and invent nothing · the same materials agree · the
 *   vocabulary (book/instrument/workbench/dialog/note) exists as data
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OBJECTS_CSS = readFileSync(join(HERE, 'objects/objects.css'), 'utf-8');

/* ---------------- book object ---------------- */

describe('W6 gate: BookObject composes the foundation', () => {
  it('the cover is 2:3 at the token width — never a custom ratio', () => {
    expect(OBJECTS_CSS.includes('aspect-ratio: 2 / 3')).toBe(true);
    expect(OBJECTS_CSS.includes('width: var(--cover-w)')).toBe(true);
  });

  it('hover = component-mass glide, lift-m + shadow bloom (MOTION.md)', () => {
    expect(OBJECTS_CSS).toMatch(
      /\.bo-tap:hover \.bo-cover\s*\{[^}]*translateY\(calc\(-1 \* var\(--lift-m\)\)\)/,
    );
    expect(OBJECTS_CSS).toMatch(/\.bo-tap:hover \.bo-cover\s*\{[^}]*--elevation-2/);
    expect(OBJECTS_CSS).toMatch(
      /transition:[^}]*transform var\(--dur-comp-in\) var\(--ease-glide\)/,
    );
  });

  it('the press receipt is the family receipt', () => {
    expect(OBJECTS_CSS).toMatch(/\.bo-tap:active \.bo-cover\s*\{[^}]*--lift-s/);
  });

  it('the fallback cover is typographic — literata speaks for the author', () => {
    const fb = OBJECTS_CSS.match(/\.bo-fallback-title\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(fb).toContain('var(--font-read)');
  });

  it('the booklight aura reads the aura slots and respects z-canvas', () => {
    const aura = OBJECTS_CSS.match(/\.bo-aura\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(aura).toContain('var(--aura-h)');
    expect(aura).toContain('var(--aura-alpha)');
    expect(aura).toContain('z-index: var(--z-canvas)');
  });

  it('progress rides the shared hairline — transform, never width', () => {
    // BookObject renders ProgressMarker; the composite adds no fill of its own
    expect(OBJECTS_CSS).not.toMatch(/bo-progress[^{]*\{[^}]*width:\s*\d+px/);
  });
});

/* ---------------- selection menu ---------------- */

describe('W6 gate: SelectionMenu is the glass instrument', () => {
  it('glass at z-floating — over content, under overlays', () => {
    const glass = OBJECTS_CSS.match(/\.sel-menu-float\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(glass).toContain('z-index: var(--z-floating)');
    expect(glass).toContain('backdrop-filter');
    expect(glass).toContain('var(--glass-tint)');
  });

  it('enters at surface mass with the rise — causal, not decorative', () => {
    expect(OBJECTS_CSS).toMatch(
      /\.sel-menu-float\s*\{[^}]*animation: arivo-rise var\(--dur-surface-in\) var\(--ease-glide\)/,
    );
  });
});

/* ---------------- workbench ---------------- */

describe('W6 gate: Workbench is the desk bridge', () => {
  it('opens at surface mass, slides from its own side', () => {
    expect(OBJECTS_CSS).toMatch(
      /\.workbench\s*\{[^}]*animation: arivo-slide-in-right var\(--dur-surface-in\) var\(--ease-glide\)/,
    );
  });

  it('the resize handle owns direct manipulation — no transition on width', () => {
    const handle = OBJECTS_CSS.match(/\.workbench-handle\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(handle).toContain('cursor: col-resize');
    expect(handle).not.toContain('transition');
  });

  it('breathes with density at its padding — inherited, not multiplied', () => {
    expect(OBJECTS_CSS).toMatch(/padding: calc\(var\(--s4\) \* var\(--density\)\)/);
  });
});

/* ---------------- dialog / panel / note ---------------- */

describe('W6 gate: Dialog is a room over the room', () => {
  it('scrim + sheet at z-overlay, elevation 3', () => {
    const sheet = OBJECTS_CSS.match(/\.dialog-sheet\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(OBJECTS_CSS).toMatch(/\.dialog\s*\{[^}]*z-index: var\(--z-overlay\)/);
    expect(sheet).toContain('var(--elevation-3)');
    expect(OBJECTS_CSS).toMatch(/\.dialog\s*\{[^}]*background: var\(--img-scrim\)/);
  });

  it('the note preview is a product concept: identity + quote + source', () => {
    const quote = OBJECTS_CSS.match(/\.note-preview-quote\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(quote).toContain('var(--font-read)'); // the author's voice carries the quote
    const note = OBJECTS_CSS.match(/\.note-preview\s*\{[^}]*\}/g)?.join('') ?? '';
    expect(note).toContain('border-radius: var(--r-surface)');
  });
});

/* ---------------- the vocabulary ---------------- */

describe('W6: the composite vocabulary exists and stays closed', () => {
  it('every composite skin class is present', () => {
    for (const cls of [
      'book-object', 'bo-cover', 'bo-fallback', 'bo-aura', 'bo-meta',
      'sel-menu-float', 'sel-action', 'sel-menu-rule',
      'workbench', 'workbench-handle', 'workbench-inner', 'workbench-attachments',
      'dialog', 'dialog-sheet', 'dialog-actions',
      'panel', 'panel-head', 'panel-body',
      'note-preview', 'note-preview-quote',
    ]) {
      expect(OBJECTS_CSS.includes(`.${cls}`)).toBe(true);
    }
  });

  it('reduced-motion twins cover every animated composite', () => {
    const twins = OBJECTS_CSS.slice(OBJECTS_CSS.indexOf('prefers-reduced-motion'));
    for (const cls of ['bo-cover', 'sel-menu-float', 'workbench', 'dialog', 'dialog-sheet', 'note-preview']) {
      expect(twins.includes(`.${cls}`)).toBe(true);
    }
  });
});
