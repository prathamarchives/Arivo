/**
 * THE PDF SUBSTRATE'S PURE LAWS — no DOM, no pdfjs, runs anywhere.
 * pdf.ts owns the DOM + pdf.js wiring; everything decidable lives here
 * so the substrate's math is testable (D12: the reader package gets tests).
 */
import type { ChapterNode } from '@arivo/core';

/** fit modes + explicit numeric scale (1 = 100%) */
export type ZoomMode = 'fit-width' | 'fit-page' | number;

export const PDF_ZOOM_MIN = 0.5;
export const PDF_ZOOM_MAX = 4;
export const PDF_ZOOM_STEP = 1.25;
/** pages kept live on each side of the current page */
export const PDF_RENDER_BUFFER = 2;
/** the page's breathing room inside the scroller (matches the css padding scale) */
export const PDF_H_MARGIN = 48;

export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.min(Math.max(1, pageCount), Math.floor(page)));
}

/** 'page:12' | '12' | garbage → a legal page number */
export function parsePageTarget(target: string | undefined, pageCount: number): number {
  if (!target) return 1;
  const m = target.match(/^page:(\d+)$/);
  if (m) return clampPage(Number(m[1]), pageCount);
  const n = Number(target);
  if (!Number.isNaN(n)) return clampPage(n, pageCount);
  return 1;
}

/** the live render window around the current page — the laziness contract */
export function pageWindow(current: number, pageCount: number, buffer: number): { first: number; last: number } {
  const c = clampPage(current, pageCount);
  const first = Math.max(1, c - Math.max(0, buffer));
  const last = Math.min(pageCount, c + Math.max(0, buffer));
  return { first, last };
}

export function computeScale(
  zoom: ZoomMode,
  pageW: number,
  pageH: number,
  availW: number,
  availH: number,
): number {
  if (zoom === 'fit-width') return availW / Math.max(1, pageW);
  if (zoom === 'fit-page') {
    return Math.min(availW / Math.max(1, pageW), availH / Math.max(1, pageH));
  }
  return Math.max(PDF_ZOOM_MIN, Math.min(PDF_ZOOM_MAX, zoom));
}

/** step a zoom by the factor ladder — fit modes enter the ladder at 100% */
export function stepZoom(zoom: ZoomMode, factor: number): number {
  const base = typeof zoom === 'number' ? zoom : 1;
  const next = base * factor;
  return Math.max(PDF_ZOOM_MIN, Math.min(PDF_ZOOM_MAX, next));
}

/** the panel's honest readout */
export function zoomLabel(zoom: ZoomMode): string {
  if (zoom === 'fit-width') return 'fit width';
  if (zoom === 'fit-page') return 'fit page';
  return `${Math.round(zoom * 100)}%`;
}

/** the loose outline shape pdf.js hands back (title + dest + children) */
export interface OutlineItemLike {
  title?: string | null;
  items?: OutlineItemLike[] | null;
}

/**
 * real outline → chapter tree. `pageOf` resolves each item to a 1-based
 * page (or null — unresolved items are dropped, never guessed onto a
 * wrong page). targets are `page:N` locators the adapter understands.
 */
export function outlineToChapters(
  items: OutlineItemLike[],
  pageOf: (item: OutlineItemLike) => number | null,
  maxNodes = 2000,
): ChapterNode[] {
  let budget = maxNodes;
  const map = (list: OutlineItemLike[]): ChapterNode[] => {
    const out: ChapterNode[] = [];
    for (const item of list) {
      if (budget-- <= 0) return out;
      const label = String(item.title ?? '').trim();
      if (!label) continue;
      const page = pageOf(item);
      const children = item.items ? map(item.items) : [];
      if (page === null && children.length === 0) continue; // a title with no home and no children is noise
      const target = page === null ? children[0]?.target ?? '' : `page:${page}`;
      if (page === null && !target) continue;
      out.push({ id: `page:${page ?? target}`, label, target, children });
    }
    return out;
  };
  return map(items);
}

/** flatten the chapter tree into page-sorted leaves for progress labels */
export function chapterLeaves(chapters: ChapterNode[]): { page: number; label: string }[] {
  const leaves: { page: number; label: string }[] = [];
  const walk = (nodes: ChapterNode[]): void => {
    for (const n of nodes) {
      const m = n.target.match(/^page:(\d+)$/);
      if (m) leaves.push({ page: Number(m[1]), label: n.label });
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(chapters);
  leaves.sort((a, b) => a.page - b.page || a.label.localeCompare(b.label));
  return leaves;
}

/** the nearest chapter heading at or before the current page — the honest label */
export function chapterForPage(leaves: { page: number; label: string }[], page: number): string | null {
  let found: string | null = null;
  for (const leaf of leaves) {
    if (leaf.page <= page) found = leaf.label;
    else break;
  }
  return found;
}

/** pdf.js failures → plain language (errors explain themselves + what to do) */
export function pdfOpenError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'PasswordException':
      return 'this pdf is password-protected — arivo cannot open locked files';
    case 'InvalidPDFException':
      return 'this file is damaged — it is not a readable pdf';
    case 'MissingPDFException':
      return 'the pdf could not be read — the file may be missing or in use';
    case 'UnexpectedResponseException':
      return 'the pdf could not be read';
    default:
      return 'the pdf failed to open';
  }
}

/** a client rect + the page box → the normalized (0-1) anchor rect */
export function normalizeRect(
  r: { left: number; top: number; width: number; height: number },
  wrap: { left: number; top: number; width: number; height: number },
  page: number,
): { page: number; x: number; y: number; w: number; h: number } {
  return {
    page,
    x: (r.left - wrap.left) / Math.max(1, wrap.width),
    y: (r.top - wrap.top) / Math.max(1, wrap.height),
    w: r.width / Math.max(1, wrap.width),
    h: r.height / Math.max(1, wrap.height),
  };
}
