/**
 * Region — a named semantic zone of the room. more important than it
 * looks: this is the L8 shell's structural vocabulary arriving before any
 * shell is designed.
 *
 *   orientation — place, navigation, memory (the left)
 *   work        — the source, the sovereign center
 *   context     — instruments for the current mode (the right)
 *   overlay     — floating work over all of it
 *
 * density is INHERITED: the region multiplies its padding by var(--density),
 * which [data-temperament] already set on the root — den breathes, lab
 * tightens. no component multiplies spacing manually (law 36: regions
 * transform structurally, never legibility).
 */
import type { ReactNode } from 'react';
import { stepClass, type SpacingStep } from './steps.ts';

export const REGION_ROLES = ['orientation', 'work', 'context', 'overlay'] as const;
export type RegionRole = (typeof REGION_ROLES)[number];

/** the default breathing per role — region-level rhythm, density-modulated */
const ROLE_PADDING: Record<RegionRole, SpacingStep> = {
  orientation: 's4',
  work: 's8',
  context: 's4',
  overlay: 's4',
};

export interface RegionProps {
  role: RegionRole;
  /** override the role's default breathing (record why in the surface spec) */
  pad?: SpacingStep;
  /** the region owns its scroll when content exceeds it (never the page) */
  scroll?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Region({ role, pad, scroll = false, className = '', children }: RegionProps): ReactNode {
  const step = pad ?? ROLE_PADDING[role]!;
  const classes = [
    'region',
    `region-${role}`,
    `region-pad-${stepClass(step)}`,
    scroll ? 'region-scroll' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section data-region={role} className={classes}>
      {children}
    </section>
  );
}
