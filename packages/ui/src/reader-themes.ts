/**
 * the reading themes — injected INTO the book content via epub.js.
 * the reading surface has its own controlled typography: literata, five
 * size steps, lh 1.65, measure 520-760, independent of window width.
 *
 * the author's voice is literata only — book headings belong to the
 * author (literata 600), never to the room's grotesque.
 *
 * highlight washes derive from the annotation identity colors (constant
 * across modes — law 38); the wash adapts to the light for legibility.
 * 'gray' is the legacy pencil mark, rendered but no longer offered.
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
  font-family: var(--font-read), Georgia, serif !important;
  font-weight: 600;
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
  border-radius: 4px;
  cursor: pointer;
  transition: filter var(--dur-state) var(--ease-settle);
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

/* drift repair flash (focusAnnotation: the epub mark carries data-flash,
   the pdf twin carries .ar-hl-flash — both are the same event) */
[class^='ar-hl-'][data-flash],
.ar-hl-flash {
  animation: ar-hl-flash 1.2s var(--ease-glide);
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

/* the reading palettes track the lighting axis (den family — the author's
   page is warm paper). washes = identity colors at legibility alpha. */
const palettes: Record<ReadingTheme, ReadPalette> = {
  paper: {
    bg: '#f4eee2',
    ink: '#2b2118',
    ink2: '#6b5f4f',
    ink3: '#a2988a',
    line: '#e2d9c6',
    yellow: 'rgba(220, 169, 59, 0.34)',
    blue: 'rgba(78, 143, 196, 0.28)',
    green: 'rgba(110, 153, 81, 0.30)',
    pink: 'rgba(198, 106, 103, 0.28)',
    gray: 'rgba(43, 33, 24, 0.12)',
  },
  sepia: {
    bg: '#f1e7d2',
    ink: '#33281c',
    ink2: '#74634c',
    ink3: '#a8977b',
    line: '#ddcfae',
    yellow: 'rgba(201, 150, 46, 0.34)',
    blue: 'rgba(66, 125, 176, 0.28)',
    green: 'rgba(96, 139, 68, 0.30)',
    pink: 'rgba(180, 92, 89, 0.28)',
    gray: 'rgba(51, 40, 28, 0.14)',
  },
  night: {
    bg: '#171310',
    ink: '#e9e2d5',
    ink2: '#97897a',
    ink3: '#5c5346',
    line: '#2b251d',
    yellow: 'rgba(220, 169, 59, 0.30)',
    blue: 'rgba(78, 143, 196, 0.32)',
    green: 'rgba(110, 153, 81, 0.30)',
    pink: 'rgba(198, 106, 103, 0.30)',
    gray: 'rgba(233, 226, 213, 0.12)',
  },
};

export function readThemeVars(theme: ReadingTheme): string {
  const p = palettes[theme];
  return `:root {
    --font-read: 'Literata';
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
