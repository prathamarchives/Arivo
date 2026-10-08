/**
 * booklight — the current book tints the light (den only, gate 8).
 *
 *   cover → sample (canvas) → average → hsl → clamp (s, l) →
 *   taste filter (dead gray light is no light) → the three aura slots
 *
 * the pipeline OWNS the on-alpha; the tokens hold the off-truth
 * (--aura-alpha: 0 — "atmosphere off until a book provides light").
 * the room applies --aura only to atmosphere surfaces (bo-aura washes,
 * later: the desk margins). the walls, the text, the annotation
 * identities are never touched (EXPERIENCE.md).
 *
 * constants are gate 8's shipped defaults: h free, s ≤ 26%, l 40–60%,
 * alpha ≤ 0.14 — the peak taste target is the low teens.
 */
import type { BookAura } from '@arivo/ui';

/** gate 8 shipped constants — one place, revisable at visual review */
export const BOOKLIGHT = {
  alpha: 0.12,
  sMax: 26,
  lMin: 40,
  lMax: 60,
  /** below this average saturation the light is dead — no wash */
  sMinTaste: 4,
} as const;

/** rgb (0..255) → hsl (h 0..360, s 0..100, l 0..100) — exported for the contract test */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** clamp to gate 8's shape — the light stays quiet and readable. exported for the contract test */
export function clampAura(a: { h: number; s: number; l: number }): BookAura {
  return {
    h: ((a.h % 360) + 360) % 360,
    s: Math.min(a.s, BOOKLIGHT.sMax),
    l: Math.min(BOOKLIGHT.lMax, Math.max(BOOKLIGHT.lMin, a.l)),
  };
}

/**
 * sample the cover, derive the aura. returns null when the cover is
 * unreachable or the light is dead (near-gray averages wash nothing).
 * the arivo:// protocol answers CORS for app://arivo — the canvas
 * reads untainted (the fetch-probe regression guards that chain).
 */
export async function computeAura(coverUrl: string): Promise<BookAura | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('cover unreachable'));
      image.src = coverUrl;
    });
    const w = 32;
    const h = 48;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const pixels = w * h;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
    }
    const avg = rgbToHsl(Math.round(r / pixels), Math.round(g / pixels), Math.round(b / pixels));
    if (avg.s < BOOKLIGHT.sMinTaste) return null;
    return clampAura(avg);
  } catch {
    return null;
  }
}

/**
 * write the room's light. den + a live aura → the slots + the on-alpha
 * (inline over the tokens' off-truth); anything else → clear, the
 * tokens take back over (alpha 0, the walls stay the walls).
 */
export function applyRoomAura(aura: BookAura | null, temperament: 'den' | 'lab'): void {
  const root = document.documentElement;
  if (aura && temperament === 'den') {
    root.style.setProperty('--aura-h', `${aura.h}`);
    root.style.setProperty('--aura-s', `${aura.s}%`);
    root.style.setProperty('--aura-l', `${aura.l}%`);
    root.style.setProperty('--aura-alpha', `${BOOKLIGHT.alpha}`);
  } else {
    root.style.removeProperty('--aura-h');
    root.style.removeProperty('--aura-s');
    root.style.removeProperty('--aura-l');
    root.style.removeProperty('--aura-alpha');
  }
}
