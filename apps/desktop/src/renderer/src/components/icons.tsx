import type { ReactNode } from 'react';

const S = (d: string, extra?: ReactNode): ReactNode => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
    {extra}
  </svg>
);

export const IconSearch = (): ReactNode => S('M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11.5 11.5 14 14');
export const IconPlus = (): ReactNode => S('M8 3v10M3 8h10');
export const IconGrid = (): ReactNode =>
  S('M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5V7H9zM2.5 9H7v4.5H2.5zM9 9h4.5v4.5H9z');
export const IconList = (): ReactNode => S('M2.5 4h11M2.5 8h11M2.5 12h11');
export const IconBook = (): ReactNode => S('M2.5 3.5c2-1 4-1 5.5 0 1.5-1 3.5-1 5.5 0v9c-2-1-4-1-5.5 0-1.5-1-3.5-1-5.5 0v-9ZM8 3.5v9');
export const IconSun = (): ReactNode => S('M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1');
export const IconMoon = (): ReactNode => S('M13 9.5A6 6 0 0 1 6.5 3a6 6 0 1 0 6.5 6.5Z');
export const IconLamp = (): ReactNode => S('M5 2.5h6l1 6H4l1-6ZM7.5 8.5v5M5.5 13.5h4');
export const IconType = (): ReactNode => S('M2.5 4.5 8 2.5l5.5 2M4.5 4.5 8 12.5l3.5-8');
export const IconToc = (): ReactNode => S('M2.5 4h11M2.5 8h7M2.5 12h9');
export const IconNote = (): ReactNode => S('M3.5 2.5h9v8l-3.5 3.5H3.5v-11.5ZM12.5 10.5H9v3.5');
export const IconBookmark = (): ReactNode => S('M4 2.5h8v11l-4-3-4 3v-11Z');
export const IconX = (): ReactNode => S('M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5');
export const IconBack = (): ReactNode => S('M9.5 3 4.5 8l5 5');
export const IconTrash = (): ReactNode => S('M2.5 4.5h11M5.5 4.5v-1.5h5v1.5M4 4.5 4.7 13.5h6.6l.7-9M6.7 7v4M9.3 7v4');
export const IconDownload = (): ReactNode => S('M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10');
export const IconCollection = (): ReactNode => S('M2.5 5.5h11v8h-11v-8ZM5.5 3h5v2.5');
export const IconCheck = (): ReactNode => S('M3 8.5 6.5 12 13 4');
export const IconChevronRight = (): ReactNode => S('M6 3.5 10.5 8 6 12.5');
export const IconDots = (): ReactNode => S('M3.5 8h.01M8 8h.01M12.5 8h.01');
export const IconZoomIn = (): ReactNode => S('M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11.5 11.5 14 14M5 7h4M7 5v4');
export const IconZoomOut = (): ReactNode => S('M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11.5 11.5 14 14M5 7h4');
export const IconFitWidth = (): ReactNode => S('M2.5 5.5v5M13.5 5.5v5M4.5 8h7M4.5 8l2-2M4.5 8l2 2M11.5 8l-2-2M11.5 8l-2 2');
export const IconFitPage = (): ReactNode => S('M4 2.5h8v11H4v-11ZM4 8h8');
