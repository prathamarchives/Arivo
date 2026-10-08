/**
 * lab data — the canonical tables mirrored from tokens.css for display
 * and for the consistency test (lab.test.ts proves the mirror matches
 * the token file; a drift is a failure, not a note).
 */

export const SPACING = [
  ['--s1', 4],
  ['--s2', 8],
  ['--s3', 12],
  ['--s4', 16],
  ['--s6', 24],
  ['--s8', 32],
  ['--s12', 48],
  ['--s16', 64],
  ['--s24', 96],
  ['--s32', 128],
] as const;

export const RADIUS = [
  ['--r-structural', 4],
  ['--r-surface', 8],
  ['--r-interactive', 12],
  ['--r-object', 14],
  ['--r-generous', 16],
  ['--r-instrument', 999],
] as const;

export const TYPE_SCALE = [
  ['--text-micro', 10],
  ['--text-meta', 11],
  ['--text-xs', 12],
  ['--text-sm', 14],
  ['--text-base', 15],
  ['--text-md', 17],
  ['--text-lg', 19],
  ['--text-xl', 23],
  ['--text-2xl', 29],
  ['--text-hero', 42],
] as const;

export const DURATIONS = [
  ['--dur-state', '150ms'],
  ['--dur-micro-in', '120ms'],
  ['--dur-micro-out', '90ms'],
  ['--dur-comp-in', '200ms'],
  ['--dur-comp-out', '140ms'],
  ['--dur-surface-in', '320ms'],
  ['--dur-surface-out', '220ms'],
  ['--dur-spatial-in', '560ms'],
  ['--dur-spatial-out', '380ms'],
  ['--dur-turn', '250ms'],
  ['--dur-material', '700ms'],
  ['--dur-atmosphere', '1400ms'],
] as const;

export const EASINGS = [
  ['--ease-glide', 'cubic-bezier(0.16, 1, 0.3, 1)', 'enter'],
  ['--ease-retreat', 'cubic-bezier(0.4, 0, 1, 1)', 'exit'],
  ['--ease-shift', 'cubic-bezier(0.3, 0, 0.2, 1)', 'move'],
  ['--ease-settle', 'cubic-bezier(0.2, 0, 0, 1)', 'rest'],
] as const;

export const ANNOTATION = [
  ['--anno-amber', '#DCA93B'],
  ['--anno-sage', '#6E9951'],
  ['--anno-blue', '#4E8FC4'],
  ['--anno-rose', '#C66A67'],
  ['--anno-violet', '#9074C2'],
] as const;

export const TYPE_ROLES = [
  ['--text-micro', 'mono micro · uppercase only'],
  ['--text-meta', 'meta labels · mono · tracked'],
  ['--text-xs', 'quiet chrome · timestamps'],
  ['--text-sm', 'controls · list text'],
  ['--text-base', 'body ui'],
  ['--text-md', 'emphasized body'],
  ['--text-lg', 'panel titles'],
  ['--text-xl', 'screen titles'],
  ['--text-2xl', 'large statements'],
  ['--text-hero', 'wordmark · empty-room moments'],
] as const;
