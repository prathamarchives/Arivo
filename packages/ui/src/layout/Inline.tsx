/**
 * Inline — the horizontal run: icon + text, metadata lines, controls,
 * chips, toolbars. it owns alignment and gap so callers never re-invent
 * the flex row. wraps by default (chrome must not overflow its region);
 * `nowrap` is a deliberate contract for toolbars that scroll.
 */
import type { ReactNode } from 'react';
import { stepClass, type SpacingStep } from './steps.ts';

export type InlineAlign = 'baseline' | 'center' | 'start' | 'end' | 'stretch';

export interface InlineProps {
  as?: 'div' | 'span' | 'ul' | 'nav';
  gap?: SpacingStep;
  align?: InlineAlign;
  wrap?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Inline({
  as: Tag = 'div',
  gap = 's2',
  align = 'center',
  wrap = true,
  className = '',
  children,
}: InlineProps): ReactNode {
  const classes = [
    'inline',
    `inline-${stepClass(gap)}`,
    `inline-${align}`,
    wrap ? '' : 'inline-nowrap',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <Tag className={classes}>{children}</Tag>;
}
