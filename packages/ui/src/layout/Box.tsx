/**
 * Box — the atomic layout primitive.
 *
 * composes the closed vocabularies: padding from the spacing ladder,
 * background from the semantic surface roles, radius from the grammar,
 * elevation from the two-shadow system. every value is a class from
 * layout.css — a Box can never carry a raw number.
 */
import type { ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { stepClass, type SpacingStep } from './steps.ts';

export type SurfaceBackground = 'transparent' | 'raised' | 'sunken' | 'ink';
export type RadiusStep = 'structural' | 'surface' | 'interactive' | 'object' | 'generous' | 'instrument';
export type ElevationStep = 'none' | '1' | '2' | '3';

export interface BoxProps {
  as?: 'div' | 'section' | 'aside' | 'header' | 'footer' | 'nav' | 'li' | 'article';
  padding?: SpacingStep;
  paddingBlock?: SpacingStep;
  paddingInline?: SpacingStep;
  background?: SurfaceBackground;
  radius?: RadiusStep;
  elevation?: ElevationStep;
  /** borders communicate structure; shadows communicate elevation (law 24) */
  bordered?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Box({
  as: Tag = 'div',
  padding,
  paddingBlock,
  paddingInline,
  background = 'transparent',
  radius,
  elevation = 'none',
  bordered = false,
  className = '',
  style,
  children,
}: BoxProps): ReactNode {
  const classes = [
    'box',
    padding ? `pad-${stepClass(padding)}` : '',
    paddingBlock ? `padb-${stepClass(paddingBlock)}` : '',
    paddingInline ? `padi-${stepClass(paddingInline)}` : '',
    `bg-${background}`,
    radius ? `radius-${radius}` : '',
    elevation !== 'none' ? `elev-${elevation}` : '',
    bordered ? 'box-bordered' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} style={style}>
      {children}
    </Tag>
  );
}
