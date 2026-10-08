/**
 * Stack — vertical rhythm. one of the highest-leverage primitives in the
 * repo: `<Stack gap="s4">` instead of `gap: 16px`.
 *
 * the gap is a spacing STEP (the closed ladder); the css class system
 * carries the var. stacks never pick a number, never justify their
 * children (alignment belongs to the parent's intent, not the stack).
 */
import type { ReactNode } from 'react';
import { stepClass, type SpacingStep } from './steps.ts';

export interface StackProps {
  as?: 'div' | 'section' | 'ol' | 'ul' | 'nav';
  gap?: SpacingStep;
  /** let tall children collapse the rhythm (lists, wells) */
  collapse?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Stack({ as: Tag = 'div', gap = 's3', collapse, className = '', children }: StackProps): ReactNode {
  const classes = ['stack', `stack-${stepClass(gap)}`, collapse ? 'stack-collapse' : '', className]
    .filter(Boolean)
    .join(' ');
  return <Tag className={classes}>{children}</Tag>;
}
