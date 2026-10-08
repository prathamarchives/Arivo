/**
 * motion — L3, the motion runtime's public face.
 *
 * the component asks a QUESTION, not a number:
 *
 *   motion.surface.enter   — a drawer opening
 *   motion.component.exit  — a chip leaving
 *   motion.spatial.follow  — an instrument chasing the selection
 *   motion.press           — the 0.985 receipt
 *
 * the semantic tree is the sanctioned vocabulary. specs built outside
 * motion.define (raw durations, invented curves) are violations the
 * design-law tests catch in css, and this module's contracts catch in ts.
 *
 * two layers, one law (see MOTION.md):
 *   STATE MOTION   css transitions — hover/focus/color/border, entrances
 *   PHYSICAL MOTION the spring runtime — drag, follow, pill travel
 * css is cheaper; physics is reserved for velocity continuity.
 */

import { defineMotion } from './spec.ts';
import type { MotionJob, MotionSpec, PhysicalMotionSpec } from './spec.ts';
import type { MotionMass } from './durations.ts';

export * from './curves.ts';
export * from './durations.ts';
export * from './mass.ts';
export * from './reduced.ts';
export * from './transitions.ts';
export * from './spatial.ts';
export * from './scroll.ts';
export * from './spec.ts';

/** motion.define — the contract constructor. see spec.ts. */
export const define = defineMotion;

/** a pre-approved css contract, memoized per access */
function css(mass: MotionMass, job: MotionJob): MotionSpec {
  return defineMotion({ mass, job }) as MotionSpec;
}

function physics(mass: MotionMass, job: 'follow'): PhysicalMotionSpec {
  return defineMotion({ mass, job }) as PhysicalMotionSpec;
}

export const motion = {
  define: defineMotion,

  micro: {
    get enter(): MotionSpec {
      return css('micro', 'enter');
    },
    get exit(): MotionSpec {
      return css('micro', 'exit');
    },
  },

  component: {
    get enter(): MotionSpec {
      return css('component', 'enter');
    },
    get exit(): MotionSpec {
      return css('component', 'exit');
    },
  },

  surface: {
    get enter(): MotionSpec {
      return css('surface', 'enter');
    },
    get exit(): MotionSpec {
      return css('surface', 'exit');
    },
  },

  spatial: {
    get enter(): MotionSpec {
      return css('spatial', 'enter');
    },
    get exit(): MotionSpec {
      return css('spatial', 'exit');
    },
    /** the physical layer — velocity-continuous following */
    get follow(): PhysicalMotionSpec {
      return physics('spatial', 'follow');
    },
    /** a component-mass physical follow (lighter instrument) */
    get followComponent(): PhysicalMotionSpec {
      return physics('component', 'follow');
    },
  },

  state: {
    get shift(): MotionSpec {
      return css('state', 'settle');
    },
  },

  turn: {
    get settle(): MotionSpec {
      return css('turn', 'turn');
    },
  },

  material: {
    get shift(): MotionSpec {
      return css('material', 'material');
    },
  },

  atmosphere: {
    get shift(): MotionSpec {
      return css('atmosphere', 'settle');
    },
  },

  /** interaction receipts */
  get press(): MotionSpec {
    return css('micro', 'press');
  },
  get hover(): MotionSpec {
    return css('state', 'hover');
  },
  get focus(): MotionSpec {
    return css('state', 'focus');
  },
  get selection(): MotionSpec {
    return css('state', 'selection');
  },
};
