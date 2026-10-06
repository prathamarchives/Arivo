# anchoring — the crown jewel, hardened

> every annotation stores primary (cfi / page) + textRange (exact, prefix,
> suffix) + position. resolution: primary → text → position → drifted →
> ambiguous → orphaned. never silent loss. **never confidently wrong.**

## the resolver

`packages/core/src/anchor.ts` — `resolveTextRange(haystack, range)` returns:

```ts
{
  status: 'resolved' | 'drifted' | 'ambiguous' | 'orphaned',
  confidence: 0.0 … 1.0,          // measurable repair confidence
  candidateCount: number,           // ambiguity is count > 1 with ties
  strategy: 'exact-unique' | 'exact-flanked' | 'window' |
            'prefix-anchor' | 'suffix-anchor' | 'none',
  match: { index, end } | null,     // RAW offsets, DOM-mappable
  explain: string,                  // why the engine decided what it did
  candidates: [{ start, end, score, evidence }]  // the full consideration set
}
```

## the chain

1. **exact** with flank disambiguation — every occurrence scored by how
   well its surroundings match the stored prefix/suffix; unique or
   strictly-best wins (`resolved`, 0.6 + 0.1×score)
2. **prefix→suffix window** — the selection text changed inside; the gap
   must still resemble the original (relatedness ≥ 0.3) or the repair is
   refused (`drifted`, 0.78)
3. **prefix anchor** / 4. **suffix anchor** — one flank moved too; same
   relatedness gate (`drifted`, 0.62)
5. nothing → `orphaned` (0.05) — the note survives in the notebook

## THE HONESTY RULE

- tied candidates (identical evidence) → **`ambiguous`, always refused**
  — surfaced as *review required*, never a guess
- every repair must clear `REPAIR_THRESHOLD = 0.6`
- repairs onto *deleted* text are refused by the relatedness gate — the
  engine never points at where text "used to be" and calls it a highlight

## matching is hostile-world-proof

- whitespace-insensitive (reflow, fonts, paragraph merge/split)
- NFC-normalizing per code-point cluster: an NFD-encoded book matches
  NFC-encoded anchors
- raw offsets snap to code-point boundaries (surrogate pairs never split)
- CJK works (no-whitespace text matches as-is)

## proof

- adversarial corpus: `anchor.adversarial.test.ts` — insert
  before/after/inside, splits, merges, reflow, NFD, emoji, CJK, 2×/50×
  repeats, boilerplate windows, 100k-char chapters
- property tests: `anchor.property.test.ts` (fast-check) — round-trip
  fidelity, reflow invariance, offset sanity, hostile garbage
- the runtime path: `packages/reader/src/epub.ts` `repairAnchorRich`
  carries confidence + strategy to the reader ui; ambiguous highlights
  render dashed-amber "review required" cards
