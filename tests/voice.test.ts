/**
 * THE VOICE LAW (L13) — the product's language is part of its design.
 *
 * 1. no SaaS/corporate/AI-marketing vocabulary ever appears in the
 *    renderer or its user-facing messages — not in copy, not in
 *    identifiers, not anywhere a user could see.
 * 2. the fixed nouns (shelf, desk, archive, mark, note, question,
 *    research, make, reflect) are the product's dictionary — they
 *    live where the product defines itself.
 * 3. error surfaces speak the full contract: what happened, what is
 *    affected, what the user can do — a way out, always.
 * 4. plainError is the only translator: internal messages without our
 *    codes never reach a user.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plainError, VOICE_NOUNS } from '../apps/desktop/src/renderer/src/lib/voice.ts';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** collect every source file under a directory */
function collect(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const RENDERER = collect(join(ROOT, 'apps/desktop/src/renderer/src'));
const VOICE_TS = readFileSync(
  join(ROOT, 'apps/desktop/src/renderer/src/lib/voice.ts'),
  'utf-8',
);
const ROOM_TS = readFileSync(join(ROOT, 'apps/desktop/src/renderer/src/stores/room.ts'), 'utf-8');
const READER_TSX = readFileSync(
  join(ROOT, 'apps/desktop/src/renderer/src/screens/Reader.tsx'),
  'utf-8',
);

/** extract every quoted string literal from source text */
function stringLiterals(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/'([^'\\\n]{2,})'|"([^"\\\n]{2,})"|`([^`\\\n]{2,})`/g)) {
    out.push((m[1] ?? m[2] ?? m[3] ?? '').toLowerCase());
  }
  return out;
}

/** the banned vocabulary — startup-ese, corporate filler, AI marketing */
const BANNED = [
  'productivity',
  'workspace',
  'workflow',
  'seamless',
  'empower',
  'leverag',
  'supercharge',
  'unlock your',
  'elevate your',
  'ai-powered',
  'ai powered',
  'game-chang',
  'revolutioniz',
  'synerg',
  'best-in-class',
  'world-class',
  'next-gen',
  'cutting-edge',
  'productize',
  'monetiz',
  'engagement',
  'retention',
  'onboard',
  'signup',
  'log in',
  'login',
  'subscribe',
  'premium',
  'upgrade now',
  'free trial',
];

describe('the voice law (L13)', () => {
  it('no banned vocabulary in any user-facing string literal', () => {
    const offenders: string[] = [];
    for (const file of RENDERER) {
      if (file.includes('.test.')) continue; // developer-facing, not user copy
      for (const lit of stringLiterals(readFileSync(file, 'utf-8'))) {
        for (const word of BANNED) {
          if (lit.includes(word)) offenders.push(`${file.split('renderer/src/')[1]}: "${word}" in "${lit.slice(0, 50)}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the fixed nouns are the product dictionary — the surfaces that define it carry them', () => {
    const corpus = `${ROOM_TS} ${READER_TSX}`.toLowerCase();
    for (const noun of VOICE_NOUNS) {
      expect(corpus).toContain(noun);
    }
    // the voice module is where the dictionary lives
    expect(VOICE_TS).toContain('export const VOICE_NOUNS');
  });

  it('error surfaces speak the full contract — a way out, always', () => {
    // the reader: what happened + back to the shelf
    const readerError = READER_TSX.match(/reader-error[\s\S]{0,400}/)?.[0] ?? '';
    expect(readerError).toContain("won't open");
    expect(readerError).toContain('back to the shelf');
  });

  it('plainError lets our coded errors speak — internals never do', () => {
    // a coded error (RemoteError shape) passes its own plain message
    const coded = plainError({ code: 'BOOK_MISSING', message: 'book not found' }, 'fallback');
    expect(coded).toBe('book not found');
    // a raw parser internal becomes the surface's plain language
    expect(plainError(new Error('TypeError: undefined is not an object'), 'the book failed to open')).toBe(
      'the book failed to open',
    );
    expect(plainError(null, 'the archive could not be read')).toBe('the archive could not be read');
    expect(plainError('a random string', 'the archive could not be read')).toBe(
      'the archive could not be read',
    );
  });

  it('the renderer never displays a raw err.message — plainError owns every surface', () => {
    for (const file of [READER_TSX]) {
      expect(file).not.toMatch(/err instanceof Error \? err\.message/);
      expect(file).toContain('plainError(');
    }
  });
});
