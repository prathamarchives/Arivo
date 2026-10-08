/**
 * Container — the room's outer frame. centers the workspace, frames the
 * canvas breathing (density-inherited), and stays out of the way: it has
 * no opinion about what happens inside. Regions do the semantic work;
 * the container is the walls.
 */
import type { ReactNode } from 'react';
import { stepClass, type SpacingStep } from './steps.ts';

export interface ContainerProps {
  as?: 'div' | 'main';
  /** canvas breathing — the outer margin of the room */
  pad?: SpacingStep;
  className?: string;
  children?: ReactNode;
}

export function Container({ as: Tag = 'div', pad = 's8', className = '', children }: ContainerProps): ReactNode {
  const classes = ['container', `container-pad-${stepClass(pad)}`, className]
    .filter(Boolean)
    .join(' ');
  return <Tag className={classes}>{children}</Tag>;
}
