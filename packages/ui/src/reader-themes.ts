/**
 * the reading themes — injected INTO the book content via epub.js.
 * the reading surface has its own controlled typography:
 * literata, five size steps, lh 1.65, measure 520-760, independent of window width.
 */
import type { ReadingTheme, HighlightColor } from '@arivo/core';

export const READ_CSS = `
html, body {
  margin: 0;
  padding: 0;
  background: transparent !important;
}
body {
  font-family: var(--font-read), Georgia, serif !important;
  line-height: 1.65 !important;
  color: var(--read-ink) !important;
  -webkit-font-smoothing: antialiased;
  text-align: justify;
  hyphens: auto;
}
p {
  margin: 0 0 0.9em 0 !important;
  text-indent: 1.2em;
  font-variant-numeric: oldstyle-nums;
}
h1, h2, h3, h4 {
  font-family: var(--font-display), Georgia, serif !important;
  color: var(--read-ink) !important;
  line-height: 1.25 !important;
  page-break-after: avoid;
}
h1 { font-size: 1.7em !important; margin: 1.2em 0 0.7em !important; text-align: left; }
h2 { font-size: 1.35em !important; margin: 1.1em 0 0.6em !important; text-align: left; }
h3 { font-size: 1.15em !important; margin: 1em 0 0.5em !important; text-align: left; }
a, a * {
  color: var(--read-ink) !important;
  text-decoration: underline;
  text-decoration-color: var(--read-ink-3);
  text-underline-offset: 2px;
}
img, svg {
  max-width: 100% !important;
  height: auto !important;
}
blockquote {
  margin: 1em 1.4em !important;
  color: var(--read-ink-2) !important;
  border-left: 2px solid var(--read-line);
  padding-left: 1em;
}
hr {
  border: none;
  border-top: 1px solid var(--read-line);
  margin: 1.6em 20%;
}
em, i { font-style: italic; }
strong, b { font-weight: 600; }

/* the highlight materials — one class token per mark: marks-pane applies
   the class via classList.add, which rejects spaces. the mark is an svg
   group — the color is the FILL (css overrides the presentation
   attributes epub.js sets, and the rects inherit from the group). */
[class^='ar-hl-'] {
  cursor: pointer;
  transition: filter var(--t-hover) var(--ease);
  fill-opacity: 0.75;
  mix-blend-mode: multiply;
}
[class^='ar-hl-']:hover { filter: brightness(0.95); }
.ar-hl-yellow { fill: var(--hl-yellow); }
.ar-hl-blue   { fill: var(--hl-blue); }
.ar-hl-green  { fill: var(--hl-green); }
.ar-hl-pink   { fill: var(--hl-pink); }
.ar-hl-gray   { fill: var(--hl-gray); }
.ar-hl-orphaned {
  fill: var(--hl-gray);
  fill-opacity: 0.4;
  cursor: default;
}

/* drift repair flash (focusAnnotation) */
[class^='ar-hl-'][data-flash] {
  animation: ar-hl-flash 1.2s var(--ease-out);
}
@keyframes ar-hl-flash {
  0% { filter: brightness(1.4); }
  100% { filter: brightness(1); }
}
`;

interface ReadPalette {
  bg: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  yellow: string;
  blue: string;
  green: string;
  pink: string;
  gray: string;
}

const palettes: Record<ReadingTheme, ReadPalette> = {
  paper: {
    bg: '#f6f3ec',
    ink: '#23201b',
    ink2: '#6e675e',
    ink3: '#a39b90',
    line: '#e4dfd3',
    yellow: '#eccf8f',
    blue: '#b7c9e6',
    green: '#bdd4b2',
    pink: '#e8c2cd',
    gray: '#d4cfc4',
  },
  sepia: {
    bg: '#f1e7d4',
    ink: '#3a2f22',
    ink2: '#77664e',
    ink3: '#ab9a7d',
    line: '#e0d2b6',
    yellow: '#e2c483',
    blue: '#b3c0d6',
    green: '#b5c9a4',
    pink: '#e0b7c2',
    gray: '#cbc2ac',
  },
  night: {
    bg: '#141311',
    ink: '#e9e4da',
    ink2: '#978f83',
    ink3: '#5c564d',
    line: '#2a2723',
    yellow: '#7a6428',
    blue: '#384a63',
    green: '#3c5038',
    pink: '#5f3e48',
    gray: '#3c3831',
  },
};

export function readThemeVars(theme: ReadingTheme): string {
  const p = palettes[theme];
  return `:root {
    --font-read: 'Literata';
    --font-display: 'Instrument Serif';
    --read-bg: ${p.bg};
    --read-ink: ${p.ink};
    --read-ink-2: ${p.ink2};
    --read-ink-3: ${p.ink3};
    --read-line: ${p.line};
    --hl-yellow: ${p.yellow};
    --hl-blue: ${p.blue};
    --hl-green: ${p.green};
    --hl-pink: ${p.pink};
    --hl-gray: ${p.gray};
  }`;
}

export function hlClass(color: HighlightColor, orphaned = false): string {
  // single token: marks-pane's classList.add rejects multi-class strings
  return orphaned ? 'ar-hl-orphaned' : `ar-hl-${color}`;
}
