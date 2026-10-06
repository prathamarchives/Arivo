/**
 * PROPERTY TESTS — the anchor engine under arbitrary inputs.
 * these properties must hold for EVERY text, not just the corpus:
 *   1. round-trip: a unique selection resolves to itself, byte-identical
 *   2. reflow invariance: whitespace mutations never break resolution
 *   3. offsets are always in-bounds and ordered
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildTextRange, resolveTextRange, REPAIR_THRESHOLD } from './anchor.ts';

/** printable text: letters, spaces, punctuation, CJK, emoji — no control chars */
const textArb = fc
  .array(
    fc.oneof(
      fc.constantFrom(' ', '\n', '\t', '  '),
      fc.string({ unit: 'grapheme', minLength: 1, maxLength: 5 }).filter((s) => s.trim().length > 0),
      fc.constantFrom('é', '中', '🔥', '—', '"', "'", '…'),
    ),
    { minLength: 40, maxLength: 200 },
  )
  .map((parts) => parts.join(''))
  .filter((s) => s.trim().length >= 40);

/** unique occurrence check — the property's precondition */
function countOccurrences(hay: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let at = hay.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = hay.indexOf(needle, at + 1);
  }
  return count;
}

/** find a UNIQUE word-ish run in the text (normalized uniqueness) */
function uniqueRun(text: string): { start: number; end: number } | null {
  const words = text.split(/\s+/).filter((w) => w.length >= 4);
  for (const w of words) {
    const start = text.indexOf(w);
    if (start >= 0 && countOccurrences(text, w) === 1) {
      return { start, end: start + w.length };
    }
  }
  return null;
}

describe('property: round-trip fidelity', () => {
  it('a unique selection always resolves to the same raw bytes', () => {
    fc.assert(
      fc.property(textArb, (text) => {
        const run = uniqueRun(text);
        fc.pre(run !== null);
        const range = buildTextRange(text, run!.start, run!.end);
        const r = resolveTextRange(text, range);
        // unique exact text ⇒ resolved (maybe with multiple normalized hits,
        // but the flanks can only tie if the surroundings repeat identically,
        // which uniqueness of the word itself makes impossible here)
        expect(r.status).toBe('resolved');
        expect(text.slice(r.match!.index, r.match!.end)).toBe(text.slice(run!.start, run!.end));
      }),
      { numRuns: 300 },
    );
  });
});

describe('property: reflow invariance (I-13)', () => {
  /** THE reflow model: whitespace RUNS are replaced by other whitespace runs.
   * words themselves are never split — that is what font/width/paragraph
   * changes actually do to text. */
  const reflowArb = fc
    .array(fc.constantFrom(' ', '  ', '   ', '\n', '\n\n', '\t', ' \n ', '\t\t'), { minLength: 1, maxLength: 12 })
    .map((fills) => (s: string) => {
      let i = 0;
      return s.replace(/\s+/g, () => {
        const fill = fills[i % fills.length]!;
        i += 1;
        return fill;
      });
    });

  it('reflow (whitespace-run rewrites) never breaks a unique resolution', () => {
    fc.assert(
      fc.property(textArb, reflowArb, (text, reflow) => {
        const run = uniqueRun(text);
        fc.pre(run !== null);
        const range = buildTextRange(text, run!.start, run!.end);
        const mutated = reflow(text);
        const r = resolveTextRange(mutated, range);
        expect(r.status).toBe('resolved');
        // normalized equality between the found slice and the original
        const norm = (s: string): string => s.normalize('NFC').replace(/\s+/g, ' ').trim();
        expect(norm(mutated.slice(r.match!.index, r.match!.end))).toBe(
          norm(text.slice(run!.start, run!.end)),
        );
      }),
      { numRuns: 300 },
    );
  });
});

describe('property: offset sanity (bounds + ordering)', () => {
  it('returned raw offsets are always within bounds and ordered', () => {
    fc.assert(
      fc.property(textArb, (text) => {
        const run = uniqueRun(text);
        fc.pre(run !== null);
        const range = buildTextRange(text, run!.start, run!.end);
        const r = resolveTextRange(text, range);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
        if (r.match) {
          expect(r.match.index).toBeGreaterThanOrEqual(0);
          expect(r.match.end).toBeLessThanOrEqual(text.length);
          expect(r.match.end).toBeGreaterThan(r.match.index);
        }
        // the honesty rule: anything not resolved/drifted carries no match
        if (r.status === 'ambiguous' || r.status === 'orphaned') {
          expect(r.match).toBeNull();
          if (r.status === 'orphaned') {
            expect(r.confidence).toBeLessThan(REPAIR_THRESHOLD);
          }
        }
        if (r.status === 'drifted') {
          expect(r.confidence).toBeGreaterThanOrEqual(REPAIR_THRESHOLD);
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe('property: hostile garbage never crashes the engine', () => {
  it('arbitrary string pairs resolve without throwing', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 300 }), fc.string({ minLength: 0, maxLength: 80 }), (a, b) => {
        const range = { exact: b, prefix: b.slice(0, 20), suffix: b.slice(-20) };
        const r = resolveTextRange(a, range);
        expect(['resolved', 'drifted', 'ambiguous', 'orphaned']).toContain(r.status);
        if (r.match) {
          expect(r.match.index).toBeGreaterThanOrEqual(0);
          expect(r.match.end).toBeLessThanOrEqual(a.length);
        }
      }),
      { numRuns: 500 },
    );
  });
});
