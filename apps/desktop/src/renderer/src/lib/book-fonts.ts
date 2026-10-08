/**
 * the reading fonts as data-embedded @font-face css.
 * book content lives in blob iframes — they don't inherit the parent's
 * @font-face, so the reader injects these directly into the content.
 * the author's voice is literata only: book headings belong to the
 * author (literata 600), never to the room's grotesque.
 */
import literata400 from '@fontsource/literata/files/literata-latin-400-normal.woff?inline';
import literata400i from '@fontsource/literata/files/literata-latin-400-italic.woff?inline';
import literata600 from '@fontsource/literata/files/literata-latin-600-normal.woff?inline';

export const BOOK_FONT_FACE_CSS = `
@font-face { font-family: 'Literata'; font-style: normal; font-weight: 400; src: url(${literata400}) format('woff'); }
@font-face { font-family: 'Literata'; font-style: italic; font-weight: 400; src: url(${literata400i}) format('woff'); }
@font-face { font-family: 'Literata'; font-style: normal; font-weight: 600; src: url(${literata600}) format('woff'); }
`;
