import { describe, it, expect } from 'vitest';
import { buildTextRange, findTextRangeMatch } from './anchor.ts';

const chapter = `Neuronal power shows itself as a matter of calm, active, hyphenated negligence. Everything now
follows the dictates of the propensity to perform and produce. It is the positivity of the
achievement society. The shift from disciplinary to achievement society does not mean that
the coercion disappears. Rather, it changes its shape.`;

describe('buildTextRange', () => {
  it('captures the exact text plus flanking context', () => {
    const target = 'the propensity to perform and produce';
    const start = chapter.indexOf(target);
    const range = buildTextRange(chapter, start, start + target.length);
    expect(range.exact).toBe(target);
    expect(range.prefix.endsWith('dictates of ')).toBe(true);
    expect(range.suffix.startsWith('. It is')).toBe(true);
  });

  it('clamps out-of-bounds offsets safely', () => {
    const range = buildTextRange(chapter, -50, 10_000);
    expect(range.exact).toBe(chapter.trim());
    expect(range.prefix).toBe('');
    expect(range.suffix).toBe('');
  });
});

describe('findTextRangeMatch — the resolution chain', () => {
  const target = 'the coercion disappears';
  const start = chapter.indexOf(target);
  const range = buildTextRange(chapter, start, start + target.length);

  it('resolves exactly when the text is unchanged', () => {
    const match = findTextRangeMatch(chapter, range);
    expect(match?.status).toBe('resolved');
    expect(chapter.slice(match!.index, match!.end)).toBe(target);
  });

  it('survives repagination and reflow (whitespace normalization)', () => {
    const reflowed = chapter.replace(/\s+/g, ' ').replace('calm, active', 'calm,  active \n');
    const match = findTextRangeMatch(reflowed, range);
    expect(match?.status).toBe('resolved');
    expect(reflowed.slice(match!.index, match!.end).replace(/\s+/g, ' ')).toContain('coercion disappears');
  });

  it('drifts honestly when the text inside the selection was edited', () => {
    const edited = chapter.replace('coercion disappears', 'coercion quietly dissolves');
    const match = findTextRangeMatch(edited, range);
    expect(match?.status).toBe('drifted');
    // the drift lands between the stored prefix and suffix
    const between = edited.slice(match!.index, match!.end);
    expect(between).toContain('quietly dissolves');
  });

  it('drifts via prefix window when the tail was cut', () => {
    const edited = chapter.replace('disappears. Rather, it changes', 'evaporates; rather, it changes');
    const match = findTextRangeMatch(edited, range);
    expect(match?.status).toBe('drifted');
  });

  it('returns null (orphaned) when the passage is truly gone', () => {
    // pages torn out: exact + full prefix window + suffix window all removed
    const torn = `${chapter.slice(0, start - 120)} [ several pages torn out ] ${chapter.slice(start + 160)}`;
    const match = findTextRangeMatch(torn, range);
    expect(match).toBeNull();
  });

  it('disambiguates repeated phrases using flanks', () => {
    const twice = `He said yes and left. ${chapter} He said yes again later that evening.`;
    const target2 = 'the positivity of the';
    const start2 = chapter.indexOf(target2);
    const range2 = buildTextRange(chapter, start2, start2 + target2.length);
    const match = findTextRangeMatch(twice, range2);
    expect(match?.status).toBe('resolved');
    expect(twice.slice(match!.index, match!.end)).toBe(target2);
  });
});
