/**
 * booklight contract (gate 8) — the pure transforms, tested in node.
 * the canvas sampling needs a browser; the SHAPE of the light is law
 * and provable anywhere:
 *
 *   saturation never exceeds the quiet ceiling,
 *   luminance stays inside the readable band,
 *   hue wraps without leaving the circle,
 *   dead gray light is no light.
 */
import { describe, it, expect } from 'vitest';
import { rgbToHsl, clampAura, BOOKLIGHT } from './booklight.ts';

describe('the booklight pipeline (gate 8, L9)', () => {
  it('rgb → hsl: primaries and grays land where geometry says', () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl(0, 255, 0)).toEqual({ h: 120, s: 100, l: 50 });
    expect(rgbToHsl(0, 0, 255)).toEqual({ h: 240, s: 100, l: 50 });
    const gray = rgbToHsl(128, 128, 128);
    expect(gray.s).toBe(0);
    expect(gray.l).toBe(50);
  });

  it('saturation clamps to the ceiling — vivid covers still wash quiet', () => {
    expect(clampAura({ h: 350, s: 90, l: 55 }).s).toBe(BOOKLIGHT.sMax);
    expect(clampAura({ h: 350, s: 90, l: 55 }).s).toBeLessThanOrEqual(26);
  });

  it('luminance stays in the readable band — no black light, no glare', () => {
    expect(clampAura({ h: 200, s: 20, l: 5 }).l).toBe(BOOKLIGHT.lMin);
    expect(clampAura({ h: 200, s: 20, l: 95 }).l).toBe(BOOKLIGHT.lMax);
    const inBand = clampAura({ h: 200, s: 20, l: 52 }).l;
    expect(inBand).toBeGreaterThanOrEqual(BOOKLIGHT.lMin);
    expect(inBand).toBeLessThanOrEqual(BOOKLIGHT.lMax);
  });

  it('hue wraps the circle — negative and >360 normalize', () => {
    expect(clampAura({ h: -30, s: 10, l: 50 }).h).toBe(330);
    expect(clampAura({ h: 390, s: 10, l: 50 }).h).toBe(30);
  });

  it('the on-alpha never exceeds the gate ceiling', () => {
    expect(BOOKLIGHT.alpha).toBeLessThanOrEqual(0.14);
    expect(BOOKLIGHT.alpha).toBeGreaterThan(0);
  });

  it('the taste floor: near-gray covers give no light at all', () => {
    /* a washed-out cover (s=3) is dead light — the check happens before
     * the clamp, in computeAura; the floor constant carries the law */
    expect(BOOKLIGHT.sMinTaste).toBeGreaterThanOrEqual(1);
    expect(BOOKLIGHT.sMinTaste).toBeLessThanOrEqual(BOOKLIGHT.sMax);
    expect(rgbToHsl(120, 122, 121).s).toBeLessThan(BOOKLIGHT.sMinTaste + 1);
  });
});
