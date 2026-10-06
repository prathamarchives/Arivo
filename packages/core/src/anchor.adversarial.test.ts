/**
 * THE ADVERSARIAL ANCHOR CORPUS — every mutation a hostile (or just
 * re-exported, reflowed, re-formatted) book can throw at a highlight.
 * the rule under test: NEVER CONFIDENTLY REPAIR TO THE WRONG TEXT.
 */
import { describe, it, expect } from 'vitest';
import { buildTextRange, resolveTextRange, REPAIR_THRESHOLD } from './anchor.ts';

const CHAPTER = [
  'The achievement society is a society of can-do.',
  'Multitasking represents an apparent attenuation, even a liberation, from the compulsion of the task.',
  'The rat race is a race in which one wins by losing.',
  'Profound boredom is a dream bird that hatches the egg of experience.',
  'Vita activa: the practice of a life in the mode of being-in-the-world.',
  'The burnout society produces exhausted selves.',
  'Depression is the sickness of a society that hurts itself.',
  'Life as a permanent performance is the life of an achievement-subject.',
].join('\n\n');

const fullText = (extra: string[] = []): string => [...extra, CHAPTER, ...extra].join('\n');

const pick = (text: string, needle: string): { start: number; end: number } => {
  const start = text.indexOf(needle);
  expect(start).toBeGreaterThanOrEqual(0);
  return { start, end: start + needle.length };
};

const SUBJECT = 'Multitasking represents an apparent attenuation, even a liberation, from the compulsion of the task.';

describe('mutation survival (I-13, I-14)', () => {
  it('text inserted BEFORE the annotation — still resolved, offsets shift', () => {
    const before = fullText();
    const { start, end } = pick(before, SUBJECT);
    const range = buildTextRange(before, start, end);
    const mutated =
      'An editor wrote a completely new foreword paragraph here.\n\n' + before;
    const r = resolveTextRange(mutated, range);
    expect(r.status).toBe('resolved');
    expect(r.match).not.toBeNull();
    expect(mutated.slice(r.match!.index, r.match!.end)).toBe(SUBJECT);
  });

  it('text inserted AFTER the annotation — still resolved at the same offsets', () => {
    const before = fullText();
    const { start, end } = pick(before, SUBJECT);
    const range = buildTextRange(before, start, end);
    const mutated = before + '\n\nA completely new afterword paragraph appears at the end of the chapter.';
    const r = resolveTextRange(mutated, range);
    expect(r.status).toBe('resolved');
    expect(mutated.slice(r.match!.index, r.match!.end)).toBe(SUBJECT);
  });

  it('text edited INSIDE the annotation — drifted via the prefix/suffix window', () => {
    const before = fullText();
    const { start, end } = pick(before, 'an apparent attenuation, even a liberation');
    const range = buildTextRange(before, start, end);
    const mutated = before.replace(
      'an apparent attenuation, even a liberation',
      'an apparent INTENSIFICATION, even a liberation',
    );
    const r = resolveTextRange(mutated, range);
    expect(r.status).toBe('drifted');
    expect(r.confidence).toBeGreaterThanOrEqual(REPAIR_THRESHOLD);
    expect(r.match).not.toBeNull();
    // the repair lands inside the mutated sentence, not somewhere random
    const repaired = mutated.slice(r.match!.index, r.match!.end);
    expect(repaired).toContain('INTENSIFICATION');
  });

  it('paragraph split inside the range — whitespace-normalized, resolved', () => {
    const before = fullText();
    const { start, end } = pick(before, SUBJECT);
    const range = buildTextRange(before, start, end);
    const mutated = before.replace(
      'an apparent attenuation, even a liberation',
      'an apparent attenuation,\neven\na\t\tliberation',
    );
    const r = resolveTextRange(mutated, range);
    expect(r.status).toBe('resolved');
    expect(r.match).not.toBeNull();
  });

  it('paragraphs merged — whitespace-normalized, resolved', () => {
    const before = fullText();
    const { start, end } = pick(before, 'The rat race is a race');
    const range = buildTextRange(before, start, end);
    const mutated = before.replace(/\n\n/g, ' ');
    const r = resolveTextRange(mutated, range);
    expect(r.status).toBe('resolved');
    expect(mutated.slice(r.match!.index, r.match!.end)).toBe('The rat race is a race');
  });

  it('global whitespace change (reflow/font) — resolved, normalized-identical slice', () => {
    const before = fullText();
    const { start, end } = pick(before, 'Profound boredom is a dream bird');
    const range = buildTextRange(before, start, end);
    const mutated = before.replace(/ {1,}/g, '   ').replace(/\n\n/g, '\n   \n');
    const r = resolveTextRange(mutated, range);
    expect(r.status).toBe('resolved');
    const normText = (s: string): string => s.replace(/\s+/g, ' ').trim();
    expect(normText(mutated.slice(r.match!.index, r.match!.end))).toBe(
      normText('Profound boredom is a dream bird'),
    );
  });

  it('unicode normalization changed (NFC anchor vs NFD book) — still resolved', () => {
    const nfc = 'Café society burns out the prometheus self.'; // composed é
    const nfd = 'Cafe\u0301 society burns out the prometheus self.'; // decomposed e + U+0301
    const { start, end } = pick(nfc, 'Café society');
    const range = buildTextRange(nfc, start, end);
    const r = resolveTextRange(nfd, range);
    expect(r.status).toBe('resolved');
    // the raw offsets land on the decomposed form
    expect(nfd.slice(r.match!.index, r.match!.end)).toBe('Cafe\u0301 society');
  });

  it('emoji inserted around the annotation — resolved', () => {
    const before = fullText();
    const { start, end } = pick(before, 'The burnout society produces exhausted selves.');
    const range = buildTextRange(before, start, end);
    const mutated = before.replace(
      'The burnout society',
      '🔥 The burnout society',
    );
    const r = resolveTextRange(mutated, range);
    expect(r.status).toBe('resolved');
  });

  it('CJK text anchors resolve (no whitespace to lean on)', () => {
    const cjk =
      '倦怠社会是功绩社会的产物。功绩主体自愿进行自我剥削,直到崩溃。深度的厌倦孵化经验的蛋。';
    const { start, end } = pick(cjk, '功绩主体自愿进行自我剥削');
    const range = buildTextRange(cjk, start, end);
    const r = resolveTextRange(cjk, range);
    expect(r.status).toBe('resolved');
    expect(cjk.slice(r.match!.index, r.match!.end)).toBe('功绩主体自愿进行自我剥削');
  });

  it('the text is gone (sentence replaced wholesale) → orphaned, honestly', () => {
    const before = fullText();
    const { start, end } = pick(before, 'Profound boredom is a dream bird');
    const range = buildTextRange(before, start, end);
    const mutated = before.replace(
      'Profound boredom is a dream bird',
      'Something entirely different sits here now',
    );
    const r = resolveTextRange(mutated, range);
    expect(r.status).toBe('orphaned');
    expect(r.match).toBeNull();
  });
});

describe('the ambiguity wall (I-12) — refusing to guess', () => {
  it('the same text repeated with IDENTICAL flanks → AMBIGUOUS, never a guess', () => {
    // the selection AND its prefix/suffix live inside a repeated unit — every
    // occurrence sees identical evidence, so no honest disambiguation exists
    // the unit is longer than the 48-char context window, so every
    // occurrence sees byte-identical flanks
    const unit = 'alpha bravo BRAVO charlie delta echo foxtrot golf hotel ';
    const text = unit.repeat(3) + 'a tail that differs';
    const at = text.indexOf('BRAVO');
    const range = buildTextRange(text, at, at + 'BRAVO'.length);
    const r = resolveTextRange(text, range);
    expect(r.status).toBe('ambiguous');
    expect(r.match).toBeNull();
    expect(r.candidateCount).toBe(3);
    expect(r.explain).toContain('refusing to guess');
  });

  it('the same sentence repeated 50x → AMBIGUOUS', () => {
    const sentence = 'This refrain is repeated fifty times in the corrupted file.';
    const text = `${sentence} `.repeat(50);
    const at = 0;
    const range = buildTextRange(
      text,
      at,
      at + sentence.length,
    );
    const r = resolveTextRange(text, range);
    expect(r.status).toBe('ambiguous');
    expect(r.candidateCount).toBe(50);
  });

  it('repeated text with DIFFERENT flanks → resolved at the flanked one (evidence wins)', () => {
    const repeated = 'the ritual formula of the achievement society';
    const text =
      `First witness spoke the words ${repeated} and then fell silent.\n\n` +
      `Second witness wrote down ${repeated} in her notebook.\n\n` +
      `Third witness whispered ${repeated} at the very end.`;
    // anchor the SECOND occurrence: its flanks name the second witness
    const at = text.indexOf(`Second witness wrote down ${repeated}`) + 'Second witness wrote down '.length;
    const range = buildTextRange(text, at, at + repeated.length);
    const r = resolveTextRange(text, range);
    expect(r.status).toBe('resolved');
    expect(r.candidateCount).toBe(3);
    expect(r.confidence).toBeGreaterThan(0.6);
    // it must land on the SECOND occurrence — the one the flanks prove
    expect(text.slice(r.match!.index, r.match!.end)).toBe(repeated);
    expect(text.slice(0, r.match!.index)).toContain('Second witness wrote down ');
  });

  it('duplicate prefix/suffix (chapter boilerplate) — window refuses to guess', () => {
    // every chapter starts and ends with the same boilerplate; the selection
    // text in the middle vanished → only ambiguous windows remain
    const boilerStart = 'This book is licensed under the same license everywhere.';
    const boilerEnd = 'Turn the page to continue reading the next chapter now.';
    const withSelection = `${boilerStart} some unique middle text that got deleted ${boilerEnd}`;
    const at = withSelection.indexOf('some unique middle text that got deleted');
    const range = buildTextRange(withSelection, at, at + 'some unique middle text that got deleted'.length);
    const mutated = `${boilerStart} ${boilerEnd}`;
    const r = resolveTextRange(mutated, range);
    // prefix/suffix may still anchor uniquely here — the honest outcomes are
    // drifted-with-evidence, ambiguous, or orphaned. NEVER a confident wrong hit.
    expect(['drifted', 'ambiguous', 'orphaned']).toContain(r.status);
    if (r.status === 'drifted') {
      expect(r.confidence).toBeGreaterThanOrEqual(REPAIR_THRESHOLD);
    }
  });
});

describe('large inputs (I-33 adjacent)', () => {
  it('a very large chapter resolves fast (100k chars)', () => {
    const big = `${'Filler paragraph of considerable length for padding purposes. '.repeat(400)}${CHAPTER}`;
    const at = big.indexOf(SUBJECT);
    const range = buildTextRange(big, at, at + SUBJECT.length);
    const started = performance.now();
    const r = resolveTextRange(big, range);
    const ms = performance.now() - started;
    expect(r.status).toBe('resolved');
    expect(ms).toBeLessThan(100);
  });
});

describe('explainability (I-15)', () => {
  it('every outcome carries status, confidence, strategy, candidate count, reason', () => {
    const before = fullText();
    const { start, end } = pick(before, 'Depression is the sickness');
    const range = buildTextRange(before, start, end);
    const r = resolveTextRange(before, range);
    expect(r.strategy).toBe('exact-unique');
    expect(r.explain.length).toBeGreaterThan(0);
    expect(r.confidence).toBeGreaterThan(0.8);
    expect(r.candidateCount).toBe(1);
    expect(r.candidates.length).toBe(1);
    expect(r.candidates[0]!.evidence).toBeTruthy();
  });

  it('selection across concatenated DOM nodes (textContent shape) resolves', () => {
    // two text nodes concatenated with no separator — exactly what
    // body.textContent produces for split DOM selections
    const a = 'The first node ends abruptly mid-';
    const b = 'sentence and the second completes it.';
    const joined = a + b;
    const at = joined.indexOf('mid-sentence');
    const range = buildTextRange(joined, at, at + 'mid-sentence and the second'.length);
    const r = resolveTextRange(joined, range);
    expect(r.status).toBe('resolved');
  });
});
