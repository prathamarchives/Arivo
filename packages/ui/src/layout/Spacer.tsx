/**
 * Spacer — explicit emptiness (law 9: whitespace is a structural element).
 *
 * inside a Stack you rarely need it (gap is the rhythm); between two
 * siblings in an ad-hoc flex run, the spacer carries the ladder so no one
 * reaches for a margin pixel. collapses to nothing when its parent wraps
 * (the `hidden` variant for toolbar tails).
 */
import type { ReactNode } from 'react';
import { stepClass, type SpacingStep } from './steps.ts';

export interface SpacerProps {
  step?: SpacingStep;
  axis?: 'block' | 'inline';
  /** display:none below a declared width is NOT allowed (no breakpoints
   *  yet — gate 6); collapse is a prop contract, not a media query */
  className?: string;
}

export function Spacer({ step = 's4', axis = 'block', className = '' }: SpacerProps): ReactNode {
  const classes = ['spacer', `spacer-${stepClass(step)}`, `spacer-${axis}`, className]
    .filter(Boolean)
    .join(' ');
  return <span className={classes} aria-hidden="true" />;
}
