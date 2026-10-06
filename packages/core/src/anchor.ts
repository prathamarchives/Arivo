/**
 * THE ANCHOR ENGINE — the crown jewel.
 * resolution chain: primary (cfi / page) → text → position → drifted →
 * ambiguous → orphaned. never silent loss: every outcome is visible, typed,
 * and explainable.
 *
 * THE HONESTY RULE: never confidently repair to the wrong text.
 * a repair is accepted only above REPAIR_THRESHOLD; tied candidates or
 * weak evidence resolve to `ambiguous` — review required — never a guess.
 * an unresolved annotation is acceptable. a silently wrong one is not.
 *
 * matching is whitespace-insensitive and NFC-normalizing (reflow-safe,
 * font-safe, re-export-safe) but returns RAW-string offsets, so callers map
 * matches straight onto DOM text nodes.
 */
import type { TextRange, ResolutionStatus } from './types.ts';

const CONTEXT = 48;

/**
 * the minimum confidence at which a repair (drift resolution) is accepted.
 * below this, the outcome is `ambiguous` — surfaced as review required.
 */
export const REPAIR_THRESHOLD = 0.6;

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

/** normalized char k maps to raw range [starts[k], ends[k]) — boundaries
 * snap to code-point edges, never splitting surrogate pairs */
interface NormalizedText {
  text: string;
  starts: number[];
  ends: number[];
}

/**
 * normalize for matching: NFC-normalize each GRAPHEME CLUSTER (so re-exports
 * with different unicode composition still match — combining marks AND
 * multi-code-point compositions like Hangul jamo runs), collapse whitespace
 * (so reflow / font changes can't break matching).
 * raw offsets snap to cluster boundaries via the starts/ends maps.
 */
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

function normalizeWithMap(s: string): NormalizedText {
  let out = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let prevWasSpace = true; // leading whitespace is dropped
  for (const { segment } of segmenter.segment(s)) {
    const rawStart = s.indexOf(segment, starts.length > 0 ? ends[ends.length - 1]! : 0);
    const rawEnd = rawStart + segment.length;
    const normalized = segment.normalize('NFC');
    if (/^\s+$/.test(normalized)) {
      if (!prevWasSpace) {
        out += ' ';
        starts.push(rawStart);
        ends.push(rawStart + 1);
        prevWasSpace = true;
      }
      continue;
    }
    for (let i = 0; i < normalized.length; i++) {
      out += normalized[i]!;
      starts.push(rawStart);
      ends.push(rawEnd);
    }
    prevWasSpace = false;
  }
  if (out.endsWith(' ')) {
    out = out.slice(0, -1);
    starts.pop();
    ends.pop();
  }
  return { text: out, starts, ends };
}

const norm = (s: string): string =>
  s
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();

export interface TextMatch {
  /** raw-string offsets — map them onto DOM text nodes directly */
  index: number;
  end: number;
  status: ResolutionStatus;
}

export type ResolutionStrategy =
  | 'exact-unique'
  | 'exact-flanked'
  | 'window'
  | 'prefix-anchor'
  | 'suffix-anchor'
  | 'none';

export interface AnchorCandidate {
  /** normalized-space offsets */
  start: number;
  end: number;
  score: number;
  evidence: string;
}

/** THE RICH OUTCOME — every resolution is explainable */
export interface TextRangeResolution {
  status: ResolutionStatus;
  /** 0..1 — measurable repair confidence */
  confidence: number;
  /** how many plausible positions existed (ambiguity is count > 1 with ties) */
  candidateCount: number;
  strategy: ResolutionStrategy;
  /** raw offsets — present when status is resolved or drifted */
  match: { index: number; end: number } | null;
  /** why the engine decided what it decided (for debugging + diagnostics) */
  explain: string;
  /** all candidates considered, with scores (for anchor explainability) */
  candidates: AnchorCandidate[];
}

const toRaw = (
  starts: number[],
  ends: number[],
  normStart: number,
  normEnd: number,
): { index: number; end: number } => {
  const index = starts[normStart] ?? 0;
  const lastNorm = Math.max(normStart, normEnd - 1);
  const end = ends[lastNorm] ?? index + 1;
  return { index, end: Math.max(end, index + 1) };
};

/** score a candidate occurrence by how well its flanks match the stored flanks */
function flankScore(
  hay: string,
  at: number,
  exactLen: number,
  prefix: string,
  suffix: string,
): { score: number; evidence: string } {
  const left = hay.slice(Math.max(0, at - CONTEXT), at);
  const right = hay.slice(at + exactLen, at + exactLen + CONTEXT);
  const nPrefix = norm(prefix);
  const nSuffix = norm(suffix);
  let score = 0;
  const bits: string[] = [];
  if (nPrefix.length > 0 && (left.endsWith(nPrefix) || left.endsWith(`${nPrefix} `))) {
    score += 2;
    bits.push('prefix-tail');
  } else if (nPrefix.length > 0 && left.includes(nPrefix.slice(-16))) {
    score += 1;
    bits.push('prefix-weak');
  }
  if (nSuffix.length > 0 && (right.startsWith(nSuffix) || right.startsWith(` ${nSuffix}`))) {
    score += 2;
    bits.push('suffix-head');
  } else if (nSuffix.length > 0 && right.includes(nSuffix.slice(0, 16))) {
    score += 1;
    bits.push('suffix-weak');
  }
  return { score, evidence: bits.join('+') || 'none' };
}

/** word-overlap between the stored selection and a candidate repair range:
 * a repair is only honest when the text it points at still RESEMBLES the
 * original selection — this is the guard against "repair onto deleted text" */
function relatedness(exact: string, candidate: string): number {
  const words = norm(exact)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
  if (words.length === 0) return candidate.trim().length > 0 ? 1 : 0;
  const candidateText = norm(candidate);
  let hits = 0;
  for (const w of words) if (candidateText.includes(w)) hits += 1;
  return hits / words.length;
}

const MIN_RELATEDNESS = 0.3;

/**
 * resolve where a textRange lands in a (possibly changed) chapter text.
 *
 * chain: exact (with flank disambiguation) → prefix+suffix window →
 * prefix anchor → suffix anchor. tied or weak candidates → `ambiguous`
 * (refused, review required). nothing → `orphaned`.
 */
export function resolveTextRange(haystackRaw: string, range: TextRange): TextRangeResolution {
  const { text: hay, starts, ends } = normalizeWithMap(haystackRaw);
  const exact = norm(range.exact);
  const prefix = norm(range.prefix);
  const suffix = norm(range.suffix);

  // ---- 1. exact matches with flank disambiguation ----
  if (exact.length > 0) {
    const candidates: AnchorCandidate[] = [];
    let at = hay.indexOf(exact);
    while (at !== -1) {
      const { score, evidence } = flankScore(hay, at, exact.length, prefix, suffix);
      candidates.push({ start: at, end: at + exact.length, score, evidence });
      at = hay.indexOf(exact, at + 1);
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score || a.start - b.start);
      const top = candidates[0]!;
      const second = candidates[1];
      const tied = second !== undefined && second.score === top.score;

      if (tied) {
        // identical text at multiple positions with equal evidence:
        // refusing is the only honest answer
        return {
          status: 'ambiguous',
          confidence: 0.3 + 0.2 * (top.score / 4),
          candidateCount: candidates.length,
          strategy: 'exact-flanked',
          match: null,
          explain: `the text appears ${candidates.length} times with identical evidence (${top.evidence}) — refusing to guess`,
          candidates,
        };
      }

      const confidence = Math.min(0.99, 0.6 + 0.1 * top.score);
      const raw = toRaw(starts, ends, top.start, top.end);
      return {
        status: 'resolved',
        confidence,
        candidateCount: candidates.length,
        strategy: candidates.length === 1 ? 'exact-unique' : 'exact-flanked',
        match: raw,
        explain:
          candidates.length === 1
            ? `unique exact match (${top.evidence === 'none' ? 'no flanks needed' : top.evidence})`
            : `${candidates.length} occurrences — the flanked one wins (${top.evidence} vs ${second!.evidence})`,
        candidates,
      };
    }
  }

  // ---- 2. prefix + suffix window: the text changed INSIDE the selection ----
  if (prefix.length >= 8 && suffix.length >= 8) {
    const candidates: AnchorCandidate[] = [];
    let pAt = hay.indexOf(prefix);
    while (pAt !== -1) {
      const after = hay.indexOf(suffix, pAt + prefix.length);
      if (after !== -1 && after - (pAt + prefix.length) < exact.length + 256) {
        const gap = hay.slice(pAt + prefix.length, after);
        // the guarded window: the gap must still RESEMBLE the selection —
        // an empty or unrelated gap means the text was deleted, not edited
        if (relatedness(range.exact, gap) >= MIN_RELATEDNESS && gap.trim().length >= 2) {
          candidates.push({
            start: pAt + prefix.length,
            end: after,
            score: 3,
            evidence: 'window(prefix→suffix)',
          });
        }
      }
      pAt = hay.indexOf(prefix, pAt + 1);
    }
    if (candidates.length === 1) {
      const raw = toRaw(starts, ends, candidates[0]!.start, candidates[0]!.end);
      return {
        status: 'drifted',
        confidence: 0.78,
        candidateCount: 1,
        strategy: 'window',
        match: raw,
        explain: 'the selection text changed — located by its prefix and suffix window',
        candidates,
      };
    }
    if (candidates.length > 1) {
      return {
        status: 'ambiguous',
        confidence: 0.5,
        candidateCount: candidates.length,
        strategy: 'window',
        match: null,
        explain: `${candidates.length} windows match the prefix→suffix span — refusing to guess`,
        candidates,
      };
    }
  }

  // ---- 3. prefix anchor alone: the tail was edited ----
  if (prefix.length >= 16) {
    const candidates: AnchorCandidate[] = [];
    let pAt = hay.indexOf(prefix);
    while (pAt !== -1) {
      const end = Math.min(hay.length, pAt + prefix.length + Math.max(8, exact.length));
      const guess = hay.slice(pAt + prefix.length, end);
      // same guard: the text after the prefix must resemble the selection,
      // otherwise the prefix merely points at where the text USED to be
      if (relatedness(range.exact, guess) >= MIN_RELATEDNESS) {
        candidates.push({ start: pAt + prefix.length, end, score: 1, evidence: 'prefix-anchor' });
      }
      pAt = hay.indexOf(prefix, pAt + 1);
    }
    if (candidates.length === 1) {
      const raw = toRaw(starts, ends, candidates[0]!.start, candidates[0]!.end);
      return {
        status: 'drifted',
        confidence: 0.62,
        candidateCount: 1,
        strategy: 'prefix-anchor',
        match: raw,
        explain: 'located by the prefix alone — the selection tail was edited',
        candidates,
      };
    }
    if (candidates.length > 1) {
      return {
        status: 'ambiguous',
        confidence: 0.4,
        candidateCount: candidates.length,
        strategy: 'prefix-anchor',
        match: null,
        explain: `the prefix appears ${candidates.length} times — refusing to guess`,
        candidates,
      };
    }
  }

  // ---- 4. suffix anchor alone: the head was edited ----
  if (suffix.length >= 16) {
    const candidates: AnchorCandidate[] = [];
    let sAt = hay.indexOf(suffix);
    while (sAt !== -1 && sAt > 0) {
      const start = Math.max(0, sAt - Math.max(8, exact.length));
      const guess = hay.slice(start, sAt);
      if (relatedness(range.exact, guess) >= MIN_RELATEDNESS) {
        candidates.push({ start, end: sAt, score: 1, evidence: 'suffix-anchor' });
      }
      sAt = hay.indexOf(suffix, sAt + 1);
    }
    if (candidates.length === 1) {
      const raw = toRaw(starts, ends, candidates[0]!.start, candidates[0]!.end);
      return {
        status: 'drifted',
        confidence: 0.62,
        candidateCount: 1,
        strategy: 'suffix-anchor',
        match: raw,
        explain: 'located by the suffix alone — the selection head was edited',
        candidates,
      };
    }
    if (candidates.length > 1) {
      return {
        status: 'ambiguous',
        confidence: 0.4,
        candidateCount: candidates.length,
        strategy: 'suffix-anchor',
        match: null,
        explain: `the suffix appears ${candidates.length} times — refusing to guess`,
        candidates,
      };
    }
  }

  return {
    status: 'orphaned',
    confidence: 0.05,
    candidateCount: 0,
    strategy: 'none',
    match: null,
    explain: 'neither the text nor its anchors survive in this chapter',
    candidates: [],
  };
}

/**
 * legacy surface (kept for simple callers): the match when resolution is
 * confident (resolved / drifted above threshold), null when ambiguous or
 * orphaned — ambiguous callers should use resolveTextRange to surface
 * "review required".
 */
export function findTextRangeMatch(haystackRaw: string, range: TextRange): TextMatch | null {
  const resolution = resolveTextRange(haystackRaw, range);
  if (!resolution.match) return null;
  if (resolution.status === 'ambiguous') return null;
  if (resolution.confidence < REPAIR_THRESHOLD && resolution.status === 'drifted') return null;
  return { ...resolution.match, status: resolution.status };
}

/** the honest outcome type used everywhere an anchor resolves */
export interface AnchorResolution {
  status: ResolutionStatus;
  /** repaired anchor when drift was located — caller persists this */
  repairedPrimary: string | null;
  message: string;
}
