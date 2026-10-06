/**
 * THE ANCHOR ENGINE — the crown jewel.
 * resolution chain: primary (cfi / page) → text → position → drifted → orphaned.
 * never silent loss: every outcome is visible and typed.
 *
 * matching is whitespace-insensitive (reflow-safe) but returns RAW-string
 * offsets, so callers can map matches straight onto DOM text nodes.
 */
import type { TextRange, ResolutionStatus } from './types.ts';

const CONTEXT = 48;

/** build a durable textRange from the chapter's full text + selection offsets */
export function buildTextRange(fullText: string, start: number, end: number): TextRange {
  const safeStart = Math.max(0, Math.min(start, fullText.length));
  const safeEnd = Math.max(safeStart, Math.min(end, fullText.length));
  const prefixStart = Math.max(0, safeStart - CONTEXT);
  const suffixEnd = Math.min(fullText.length, safeEnd + CONTEXT);
  return {
    exact: fullText.slice(safeStart, safeEnd),
    prefix: fullText.slice(prefixStart, safeStart),
    suffix: fullText.slice(safeEnd, suffixEnd),
  };
}

/** collapse whitespace so reflow / font changes can't break matching.
 *  returns the normalized text plus map[k] = raw index of normalized char k. */
function normalizeWithMap(s: string): { text: string; map: number[] } {
  let out = '';
  const map: number[] = [];
  let prevWasSpace = true;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (/\s/.test(ch)) {
      if (!prevWasSpace) {
        out += ' ';
        map.push(i);
        prevWasSpace = true;
      }
    } else {
      out += ch;
      map.push(i);
      prevWasSpace = false;
    }
  }
  if (out.endsWith(' ')) {
    out = out.slice(0, -1);
    map.pop();
  }
  return { text: out, map };
}

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

export interface TextMatch {
  /** raw-string offsets — map them onto DOM text nodes directly */
  index: number;
  end: number;
  status: ResolutionStatus;
}

/**
 * find where a textRange lands in a (possibly changed) chapter text.
 * chain: exact → prefix/suffix window → prefix anchor → suffix anchor.
 * returns null = orphaned (the text is gone; the note still lives in the notebook).
 */
export function findTextRangeMatch(haystackRaw: string, range: TextRange): TextMatch | null {
  const { text: hay, map } = normalizeWithMap(haystackRaw);
  const toRaw = (normStart: number, normEnd: number): { index: number; end: number } => {
    const index = map[normStart] ?? 0;
    const lastNorm = Math.max(normStart, normEnd - 1);
    const end = (map[lastNorm] ?? index) + 1;
    return { index, end: Math.max(end, index + 1) };
  };

  const exact = norm(range.exact);
  const prefix = norm(range.prefix);
  const suffix = norm(range.suffix);

  if (exact.length > 0) {
    // 1. exact — if multiple, pick the one whose flanks best match the stored flanks
    let best: { start: number; end: number; score: number } | null = null;
    let at = hay.indexOf(exact);
    while (at !== -1) {
      const left = hay.slice(Math.max(0, at - CONTEXT), at);
      const right = hay.slice(at + exact.length, at + exact.length + CONTEXT);
      const score =
        (prefix.length > 0 && left.endsWith(prefix.slice(Math.min(prefix.length, left.length))) ? 1 : 0) +
        (suffix.length > 0 && right.startsWith(suffix.slice(0, Math.min(suffix.length, right.length))) ? 1 : 0) +
        (prefix.length > 0 && left.includes(prefix.slice(-16)) ? 1 : 0);
      if (!best || score > best.score) {
        best = { start: at, end: at + exact.length, score };
      }
      if (best.score >= 3) break;
      at = hay.indexOf(exact, at + 1);
    }
    if (best) {
      const raw = toRaw(best.start, best.end);
      return { ...raw, status: 'resolved' };
    }
  }

  // 2. prefix + suffix window — the text changed inside the selection (drifted)
  if (prefix.length >= 8 && suffix.length >= 8) {
    const candidates = [hay.lastIndexOf(prefix), hay.indexOf(prefix)].filter((i) => i !== -1);
    for (const pAt of candidates) {
      const after = hay.indexOf(suffix, pAt + prefix.length);
      if (after !== -1 && after - (pAt + prefix.length) < exact.length + 256) {
        const raw = toRaw(pAt + prefix.length, after);
        return { ...raw, status: 'drifted' };
      }
    }
  }

  // 3. prefix anchor alone — the tail was edited
  if (prefix.length >= 16) {
    const pAt = hay.indexOf(prefix);
    if (pAt !== -1) {
      const guessEnd = Math.min(hay.length, pAt + prefix.length + Math.max(8, exact.length));
      const raw = toRaw(pAt + prefix.length, guessEnd);
      return { ...raw, status: 'drifted' };
    }
  }

  // 4. suffix anchor alone — the head was edited
  if (suffix.length >= 16) {
    const sAt = hay.indexOf(suffix);
    if (sAt > 0) {
      const guessStart = Math.max(0, sAt - Math.max(8, exact.length));
      const raw = toRaw(guessStart, sAt);
      return { ...raw, status: 'drifted' };
    }
  }

  return null;
}

/** the honest outcome type used everywhere an anchor resolves */
export interface AnchorResolution {
  status: ResolutionStatus;
  /** repaired anchor when drift was located — caller persists this */
  repairedPrimary: string | null;
  message: string;
}
