# session 0009 — the effect registry (L12)

> starting commit: 0cef246 (L11 landed, 417/2 green)
> branch: campaign/experience-v0.7

## objective

L12 — creative graphics with semantic jobs only. the exit predicate:
**every effect has a semantic job and a measured cost.** the effect
gatekeeper's answer to "what new expressive surface does arivo need?"
was honest: none — until profiling proves one. what was missing was
not effects; it was the REGISTRY, the BUDGETS, and the FAILURE PATHS.

## the audit

the live inventory (built across L2/L3/L8/L9/W2.5): paper grain, soft
glass, booklight, the page-turn beat, shelf camera transitions, the
progress hairline. each had a purpose and most had twins — but none
had a written contract, and one had a real hole:

- **soft glass had no failure path.** without backdrop-filter the
  instrument would render as washed translucency — unreadable. fixed:
  `@supports not (…)` in both material classes (.glass, .mat-glass)
  yields the tint to solid `--bg-raised`; rim + elevation survive.
- **the settings scrim carried a raw `blur(6px)`** — an unbudgeted
  literal. fixed: `--scrim-blur: 6px`, a NAMED resolved decision
  (scrims wash gentler than instruments; 16px full-page would be a
  GPU tax), not a token hiding an unresolved choice.
- the design-law gates caught both my fixes' side effects — exactly
  their job: the spacing checker misread `--scrim-blur` as spacing
  (the pattern now binds to the scale's real names, --s1..--s32);
  the W5 blur gate counted the fallback's `none` and the @supports
  probe as blurs (they are not — the gate now counts real blurs only,
  the law itself unchanged).

## the registry

**docs/EFFECTS.md** — every live effect with the full contract: purpose,
default, budget, reduced-motion behavior, fallback, failure behavior.
plus the rejected list (glow/cursor-chasing, edge dissolve, particles,
generative wallpaper, premature graph presentation) with the reason:
no semantic job, no proof of benefit, or deferred by another layer's
own law.

**tests/effect-registry.test.ts** (8 laws) — the registry's teeth:

1. the doc lists exactly the live effect families + the rejected list
2. both glass classes carry the @supports failure path
3. blur is token-budgeted — no raw backdrop-filter radius anywhere
   (glass-blur 16px, scrim-blur 6px)
4. paper grain is bounded (≤ 0.05) + fixed + pointer-transparent
5. booklight clamps are real code, lab ignores the light
6. the atmosphere twin collapses under reduced motion
7. glass stays scarce — no wall surface (.shelf-grid, .reader,
   .archive, .drawer) may ever blur
8. the annotation identity colors remain the only saturated privilege

## what L12 deliberately did NOT add

no particles, no dither, no liquid-glass walls, no cursor glow. the
zip's own bar ("only if profiling and visual review prove the effect
improves the experience") is the rejection reason, recorded in the
registry's rejected list — the gatekeeper's first shipped act is a
documented NO.

## verification

- **P2**: typecheck + lint clean; **425 passed / 2 skipped** (+8
  registry laws; 2 gate checkers sharpened — laws intact)
- **P3 live**: the app renders identically (the fallback is
  conditional; the scrim blur is the same 6px through a token), the
  grain layer sits at 0.035, zero console errors

## next

L13 — the content/voice audit: strip SaaS/startup/AI-marketing
language, fix the error vocabulary, one fixed dictionary.
