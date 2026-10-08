/**
 * Surface — probably the most important primitive in the room (W5.1).
 *
 * encapsulates material + elevation + radius + interaction in one door:
 *
 *   <Surface material="paper" elevation="resting" radius="object">
 *
 * the component does not invent its own shadow, its own blur, its own
 * roundness — the token grammar owns all three. materials are ROLES:
 *
 *   paper  matte, warm, quiet — the default wall and sheet
 *   glass  an instrument, never wallpaper — floating chrome only
 *   ink    the authoritative dark for high-priority expression
 *
 * borders communicate structure; shadows communicate elevation — never
 * both for one job (law 24). glass never also draws a border-line job.
 */
import type { ReactNode } from 'react';
import type { RadiusStep, ElevationStep } from '../layout/Box.tsx';

export type MaterialRole = 'paper' | 'glass' | 'ink';

/** elevation speaks in meaning, not numbers */
export type Elevation = 'none' | 'resting' | 'raised' | 'floating';

const ELEVATION_STEP: Record<Elevation, ElevationStep> = {
  none: 'none',
  resting: '1',
  raised: '2',
  floating: '3',
};

export interface SurfaceProps {
  as?: 'div' | 'section' | 'aside' | 'header' | 'footer' | 'article';
  material?: MaterialRole;
  elevation?: Elevation;
  radius?: RadiusStep;
  /** structural hairline — paper only (glass has its rim, ink needs none) */
  bordered?: boolean;
  /** sunken paper: the well (quiet insets, trays) */
  sunken?: boolean;
  padding?: import('../layout/steps.ts').SpacingStep;
  className?: string;
  children?: ReactNode;
}

export function Surface({
  as: Tag = 'div',
  material = 'paper',
  elevation = 'none',
  radius = 'surface',
  bordered = false,
  sunken = false,
  padding,
  className = '',
  children,
}: SurfaceProps): ReactNode {
  const classes = [
    'surface-mat',
    `mat-${material}`,
    elevation !== 'none' ? `elev-${ELEVATION_STEP[elevation]}` : '',
    `radius-${radius}`,
    bordered && material === 'paper' ? 'mat-bordered' : '',
    sunken && material === 'paper' ? 'mat-sunken' : '',
    padding ? `pad-gap-${padding}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} data-material={material}>
      {children}
    </Tag>
  );
}

/**
 * Divider — a structural rule. borders communicate structure (law 24):
 * the divider is a hairline, quiet, ink-3 at rest; never a shadow, never
 * a gradient. vertical dividers live in region seams.
 */
export function Divider({
  orientation = 'horizontal',
  className = '',
}: {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}): ReactNode {
  return (
    <hr className={`divider divider-${orientation} ${className}`.trim()} aria-hidden="true" />
  );
}
