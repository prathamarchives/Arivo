/**
 * Icon — the one icon language (gate 1, law: no random icon families).
 *
 * 24 glyphs, one 16×16 grid, one 1.5px round-capped stroke, currentColor.
 * the app never mixes lucide + random svgs + customs: every mark in the
 * room comes from this set. new glyphs land here through a specimen
 * review (stroke, cap, join, optical offsets all agree), not ad hoc.
 *
 * named exports (IconSearch…) keep the existing call sites; the Icon
 * component takes a name for data-driven surfaces.
 */
import type { ReactNode } from 'react';

/** the path dictionary — the whole language, visible in one place */
export const ICON_PATHS = {
  search: 'M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11.5 11.5 14 14',
  plus: 'M8 3v10M3 8h10',
  grid: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5V7H9zM2.5 9H7v4.5H2.5zM9 9h4.5v4.5H9z',
  list: 'M2.5 4h11M2.5 8h11M2.5 12h11',
  book: 'M2.5 3.5c2-1 4-1 5.5 0 1.5-1 3.5-1 5.5 0v9c-2-1-4-1-5.5 0-1.5-1-3.5-1-5.5 0v-9ZM8 3.5v9',
  sun: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1',
  moon: 'M13 9.5A6 6 0 0 1 6.5 3a6 6 0 1 0 6.5 6.5Z',
  lamp: 'M5 2.5h6l1 6H4l1-6ZM7.5 8.5v5M5.5 13.5h4',
  type: 'M2.5 4.5 8 2.5l5.5 2M4.5 4.5 8 12.5l3.5-8',
  toc: 'M2.5 4h11M2.5 8h7M2.5 12h9',
  note: 'M3.5 2.5h9v8l-3.5 3.5H3.5v-11.5ZM12.5 10.5H9v3.5',
  bookmark: 'M4 2.5h8v11l-4-3-4 3v-11Z',
  x: 'M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5',
  back: 'M9.5 3 4.5 8l5 5',
  trash: 'M2.5 4.5h11M5.5 4.5v-1.5h5v1.5M4 4.5 4.7 13.5h6.6l.7-9M6.7 7v4M9.3 7v4',
  download: 'M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10',
  collection: 'M2.5 5.5h11v8h-11v-8ZM5.5 3h5v2.5',
  check: 'M3 8.5 6.5 12 13 4',
  chevronRight: 'M6 3.5 10.5 8 6 12.5',
  dots: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
  zoomIn: 'M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11.5 11.5 14 14M5 7h4M7 5v4',
  zoomOut: 'M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11.5 11.5 14 14M5 7h4',
  fitWidth: 'M2.5 5.5v5M13.5 5.5v5M4.5 8h7M4.5 8l2-2M4.5 8l2 2M11.5 8l-2-2M11.5 8l-2 2',
  fitPage: 'M4 2.5h8v11H4v-11ZM4 8h8',
  /* the three places (L8): standing books on a shelf line, the archive box.
     same grid, same stroke, same round caps — the language stays one. */
  shelf: 'M2.5 13.5h11M5 13.5V7.5M8 13.5V4.5M11 13.5V8.5',
  archive: 'M2.5 5.5h11v8h-11v-8ZM2.5 9h11M6.5 11.5h3',
  /* the wave-1 surfaces (library tools + settings): settings sliders, info,
     tag, pencil, folder, pulse — the reading life's line. v0.3.2: the
     spiky gear retired for the sliders — unambiguous at 16px. */
  settings: 'M2.5 4.75h11M2.5 8h11M2.5 11.25h11M10.25 4.75h.01M5.75 8h.01M9.25 11.25h.01',
  info: 'M8 14.25a6.25 6.25 0 1 0 0-12.5 6.25 6.25 0 0 0 0 12.5ZM8 7.25v4M8 4.6v.01',
  tag: 'M2.5 3.5h5l5.5 5.5-5 5L2.5 8.5v-5ZM5 6v.01',
  pencil: 'M10.5 2.5 13.5 5.5 5.5 13.5 2.5 13.5 2.5 10.5 10.5 2.5Z',
  folder: 'M2 4.5h4l1.5 2H14v7H2v-9Z',
  pulse: 'M2.5 8.5 5 8.5 6.5 4.5 9 12 10.5 8.5 13.5 8.5',
  /* v0.3.1 — the page objects: a tilted sticky paper (two dots of text
     on a pinned sheet) and the copy pair. same grid, same stroke. */
  sticky: 'M4.6 5.7 10.3 3.5 12.5 9.2 6.8 11.4 4.6 5.7ZM7 7.8h.01M9.4 6.9h.01',
  copy: 'M5.5 5.5h7v7h-7v-7ZM3.5 10.5v-7h7',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName;
  /** the set is drawn for 16; scale only with a specimen note */
  size?: 16;
  className?: string;
  /** decorative by default — set a label when the icon IS the content */
  label?: string;
}

export function Icon({ name, size = 16, className = '', label }: IconProps): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`.trim()}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** named factories — the ergonomics the call sites already use */
function named(name: IconName): (props?: { label?: string; className?: string }) => ReactNode {
  return ({ label, className }: { label?: string; className?: string } = {}) => (
    <Icon name={name} label={label} className={className} />
  );
}

export const IconSearch = named('search');
export const IconPlus = named('plus');
export const IconGrid = named('grid');
export const IconList = named('list');
export const IconBook = named('book');
export const IconSun = named('sun');
export const IconMoon = named('moon');
export const IconLamp = named('lamp');
export const IconType = named('type');
export const IconToc = named('toc');
export const IconNote = named('note');
export const IconBookmark = named('bookmark');
export const IconX = named('x');
export const IconBack = named('back');
export const IconTrash = named('trash');
export const IconDownload = named('download');
export const IconCollection = named('collection');
export const IconCheck = named('check');
export const IconChevronRight = named('chevronRight');
export const IconDots = named('dots');
export const IconZoomIn = named('zoomIn');
export const IconZoomOut = named('zoomOut');
export const IconFitWidth = named('fitWidth');
export const IconFitPage = named('fitPage');
export const IconShelf = named('shelf');
export const IconArchive = named('archive');
export const IconSettings = named('settings');
export const IconInfo = named('info');
export const IconTag = named('tag');
export const IconPencil = named('pencil');
export const IconSticky = named('sticky');
export const IconCopy = named('copy');
export const IconFolder = named('folder');
export const IconPulse = named('pulse');
