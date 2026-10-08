/**
 * transitions — the css layer of the motion runtime.
 *
 * STATE MOTION lives here: hover, focus, press, color/border/shadow
 * shifts, simple entrances. css transitions are cheaper and simpler than
 * springs for ~80% of ui motion — the physics layer (spatial.ts) is
 * reserved for where velocity continuity actually matters.
 *
 * the builder emits `property var(--dur-*) var(--ease-*)` — token-mode is
 * canonical, so the prefers-reduced-motion block in tokens.css zeroes
 * every duration automatically. ms-mode exists only for js-measured
 * contexts (canvas, tests) and is never written into stylesheets.
 */

import { bezier, easeVar } from './curves.ts';
import type { MotionSpec } from './spec.ts';
import { REDUCED_MS } from './durations.ts';

/** the reduced-motion twin of a spec's transition string */
export function cssTransition(spec: MotionSpec): string {
  if (spec.kind !== 'css') throw new Error('cssTransition: physics specs never become css transitions');
  const dur = `var(${spec.duration.token})`;
  const ease = easeVar(spec.easing);
  return spec.properties.map((p) => `${p} ${dur} ${ease}`).join(', ');
}

/** ms-mode twin: literal numbers for js-driven contexts. not for stylesheets. */
export function cssTransitionMs(spec: MotionSpec, reduced = false): string {
  if (spec.kind !== 'css') throw new Error('cssTransitionMs: physics specs never become css transitions');
  const ms = reduced ? REDUCED_MS : spec.duration.ms;
  const ease = bezier(spec.easing);
  return spec.properties.map((p) => `${p} ${ms}ms ${ease}`).join(', ');
}

/** the crossfade twin: opacity-only at state duration — permitted motion
 *  under reduce (a material change, not movement) */
export function crossfadeTwin(): string {
  return 'opacity var(--dur-state) var(--ease-settle)';
}

/** the instant twin: zero duration, the change simply happens */
export function instantTwin(spec: MotionSpec): string {
  if (spec.kind !== 'css') throw new Error('instantTwin: physics specs never become css transitions');
  return spec.properties.map((p) => `${p} 0ms`).join(', ');
}

/**
 * the full twin rule for a spec, as a stylesheet fragment:
 *   base → cssTransition(spec)
 *   @media (prefers-reduced-motion: reduce) → twin
 * write components with the base transition; the token hammer already
 * covers durations. this exists for keyframes and js-authored css.
 */
export function twinFor(spec: MotionSpec): string {
  if (spec.kind !== 'css') throw new Error('twinFor: physics specs never become css transitions');
  switch (spec.reducedMotion) {
    case 'crossfade':
      return crossfadeTwin();
    case 'instant':
      return instantTwin(spec);
    case 'none':
      return 'none';
  }
}
