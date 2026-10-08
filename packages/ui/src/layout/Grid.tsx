/**
 * Grid — auto-fill tracks with a closed minimum vocabulary. `min` is TRACK
 * GEOMETRY (narrow/wide/object — D-015), not spacing; the tracks decide
 * how content reflows at extreme widths without a single breakpoint.
 */
import type { ReactNode } from 'react';
import { stepClass, type SpacingStep, type GridMin } from './steps.ts';

export interface GridProps {
  as?: 'div' | 'ul' | 'section';
  gap?: SpacingStep;
  min?: GridMin;
  className?: string;
  children?: ReactNode;
}

export function Grid({ as: Tag = 'div', gap = 's3', min = 'wide', className = '', children }: GridProps): ReactNode {
  const classes = ['grid', `grid-${stepClass(gap)}`, `grid-min-${min}`, className]
    .filter(Boolean)
    .join(' ');
  return <Tag className={classes}>{children}</Tag>;
}
