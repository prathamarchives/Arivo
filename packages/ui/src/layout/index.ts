/**
 * layout — L4, the spatial runtime's public face.
 *
 * the primitives are deliberately tiny: Box, Stack, Inline, Grid, Region,
 * Container, ReadingMeasure, Overlay, Spacer. together they are enough to
 * build the future shell WITHOUT raw positional css — that is the W3 gate,
 * and the lab's spatial matrix (section 14) proves it under 960 → 2560 and
 * both temperaments.
 */

export { Box } from './Box.tsx';
export type { BoxProps, SurfaceBackground, RadiusStep, ElevationStep } from './Box.tsx';
export { Stack } from './Stack.tsx';
export type { StackProps } from './Stack.tsx';
export { Inline } from './Inline.tsx';
export type { InlineProps, InlineAlign } from './Inline.tsx';
export { Grid } from './Grid.tsx';
export type { GridProps } from './Grid.tsx';
export { Region, REGION_ROLES } from './Region.tsx';
export type { RegionProps, RegionRole } from './Region.tsx';
export { Container } from './Container.tsx';
export type { ContainerProps } from './Container.tsx';
export { ReadingMeasure } from './ReadingMeasure.tsx';
export type { ReadingMeasureProps } from './ReadingMeasure.tsx';
export { Overlay } from './Overlay.tsx';
export type { OverlayProps } from './Overlay.tsx';
export { Spacer } from './Spacer.tsx';
export type { SpacerProps } from './Spacer.tsx';
export {
  SPACING_STEPS,
  stepVar,
  stepClass,
  densityVar,
  GRID_MIN_TRACKS,
  GRID_MIN_PX,
} from './steps.ts';
export type { SpacingStep, GridMin } from './steps.ts';
