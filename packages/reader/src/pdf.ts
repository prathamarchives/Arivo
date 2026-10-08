/**
 * THE PDF PLUGIN — pdf.js behind the format contract.
 * honest scope: fixed layout, zoom/fit, page bookmarks, text-layer highlights
 * when the text layer exists. scanned pages = page bookmarks only, said plainly.
 *
 * W2.1 substrate laws (the pure halves live in pdf-logic.ts):
 * - pages render lazily: only the window around the current page holds
 *   canvases; the rest are sized placeholders (a 500-page pdf no longer
 *   means 500 canvases)
 * - the outline is real (pdf.js getOutline + destination resolution);
 *   flat "Page N" is the fallback, never the ceiling
 * - zoom re-renders only the visible window and keeps the reading spot
 * - failures speak plainly (password / damaged / unreadable)
 */
import * as pdfjs from 'pdfjs-dist';
// the worker as a bundled url — vite handles it
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {
  Anchor,
  AnnotationView,
  ChapterNode,
  FormatReader,
  FormatReaderHooks,
  ReaderSettings,
  SelectionInfo,
} from '@arivo/core';
import { buildTextRange } from '@arivo/core';
import {
  PDF_H_MARGIN,
  PDF_RENDER_BUFFER,
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  chapterForPage,
  chapterLeaves,
  clampPage,
  computeScale,
  normalizeRect,
  outlineToChapters,
  pageWindow,
  parsePageTarget,
  pdfOpenError,
  type OutlineItemLike,
  type ZoomMode,
} from './pdf-logic.ts';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfAnchorData {
  page: number;
  a: number;
  b: number;
  rects: { page: number; x: number; y: number; w: number; h: number }[];
}

export class PdfAdapter implements FormatReader {
  readonly format = 'pdf' as const;
  private doc: pdfjs.PDFDocumentProxy | null = null;
  private loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null;
  private container: HTMLElement | null = null;
  private scroller: HTMLElement | null = null;
  private zoom: ZoomMode = 'fit-width';
  private settings: ReaderSettings | null = null;
  /** every page's sized placeholder — the scroll geometry, always present */
  private wraps = new Map<number, HTMLDivElement>();
  /** pages currently holding a canvas + text layer */
  private live = new Set<number>();
  /** in-flight page render tasks, cancellable on zoom/relayout */
  private inflight = new Map<number, { cancel: () => void }>();
  private renderQueue: number[] = [];
  private draining = false;
  private annotations = new Map<string, AnnotationView>();
  private pageCount = 0;
  private currentPage = 1;
  private scale = 1;
  private pageBase = { w: 612, h: 792 };
  private chapters: ChapterNode[] = [];
  private leaves: { page: number; label: string }[] = [];
  private scrollT: ReturnType<typeof setTimeout> | null = null;
  private resizeT: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  private hooks: FormatReaderHooks;

  constructor(hooks: FormatReaderHooks) {
    this.hooks = hooks;
  }

  async open(container: HTMLElement, source: ArrayBuffer): Promise<void> {
    this.container = container;
    container.innerHTML = '';
    const scroller = document.createElement('div');
    scroller.className = 'pdf-scroll';
    container.appendChild(scroller);
    this.scroller = scroller;

    let doc: pdfjs.PDFDocumentProxy;
    try {
      const task = pdfjs.getDocument({ data: new Uint8Array(source.slice(0)) });
      this.loadingTask = task;
      doc = await task.promise;
    } catch (err) {
      throw new Error(pdfOpenError(err));
    }
    if (doc.numPages < 1) {
      void this.loadingTask?.destroy?.();
      this.loadingTask = null;
      throw new Error('this pdf has no pages — there is nothing to read');
    }
    this.doc = doc;
    this.pageCount = doc.numPages;

    // the base page box (page 1; individual pages correct themselves on render)
    const first = await doc.getPage(1);
    const vp0 = first.getViewport({ scale: 1 });
    this.pageBase = { w: vp0.width, h: vp0.height };

    await this.loadOutline();
    this.buildPlaceholders();
    if (this.settings) this.applySettings(this.settings);

    scroller.addEventListener('scroll', () => {
      if (this.scrollT) clearTimeout(this.scrollT);
      this.scrollT = setTimeout(() => this.onScroll(), 120);
    });
    scroller.addEventListener('mouseup', () => this.onMouseUp());
    window.addEventListener('resize', this.onWindowResize);

    this.syncWindow(1);
  }

  async display(target?: string): Promise<void> {
    const page = parsePageTarget(target, this.pageCount);
    this.scrollToPage(page);
    this.syncWindow(page);
    this.emitProgress(page);
  }

  next(): void {
    this.scroller?.scrollBy({ top: this.scroller.clientHeight * 0.9, behavior: 'smooth' });
  }

  prev(): void {
    this.scroller?.scrollBy({ top: -this.scroller.clientHeight * 0.9, behavior: 'smooth' });
  }

  async jumpTo(locator: string): Promise<void> {
    const page = parsePageTarget(locator, this.pageCount);
    this.scrollToPage(page);
    this.syncWindow(page);
    this.emitProgress(page);
  }

  focusAnnotation(id: string): void {
    const view = this.annotations.get(id);
    const data = view ? parsePrimary(view.anchor.primary) : null;
    if (data) {
      const page = clampPage(data.page, this.pageCount);
      this.scrollToPage(page);
      this.syncWindow(page);
      for (const el of this.container?.querySelectorAll(`[data-hl="${id}"]`) ?? []) {
        el.classList.add('ar-hl-flash');
      }
    }
  }

  renderAnnotations(items: AnnotationView[]): void {
    this.annotations.clear();
    for (const item of items) this.annotations.set(item.id, item);
    this.paintAnnotations();
  }

  removeAnnotation(id: string): void {
    this.annotations.delete(id);
    for (const el of this.container?.querySelectorAll(`[data-hl="${id}"]`) ?? []) el.remove();
  }

  applySettings(settings: ReaderSettings): void {
    this.settings = settings;
    if (!this.container) return;
    this.container.dataset.readTheme = settings.theme;
    const night = settings.theme === 'night';
    for (const canvas of this.container.querySelectorAll('canvas')) {
      (canvas as HTMLCanvasElement).style.filter = night
        ? 'invert(0.92) hue-rotate(180deg)'
        : 'none';
    }
  }

  getChapters(): ChapterNode[] {
    return this.chapters;
  }

  /** pdf pages render to canvas — no font injection needed */
  setFontFace(_css: string): void {
    void _css;
  }

  clearSelection(): void {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* nothing to clear */
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.scrollT) clearTimeout(this.scrollT);
    if (this.resizeT) clearTimeout(this.resizeT);
    window.removeEventListener('resize', this.onWindowResize);
    for (const task of this.inflight.values()) task.cancel();
    this.inflight.clear();
    // v6: teardown lives on the loading task (the proxy's destroy is gone)
    void this.loadingTask?.destroy?.();
    this.loadingTask = null;
    this.doc = null;
  }

  // ---------- geometry ----------

  private currentScale(): number {
    const scroller = this.scroller;
    if (!scroller) return 1;
    return computeScale(
      this.zoom,
      this.pageBase.w,
      this.pageBase.h,
      scroller.clientWidth - PDF_H_MARGIN,
      scroller.clientHeight - PDF_H_MARGIN,
    );
  }

  /** placeholders for every page — the scroll geometry exists before pixels do */
  private buildPlaceholders(): void {
    const scroller = this.scroller;
    if (!scroller) return;
    this.scale = this.currentScale();
    for (let i = 1; i <= this.pageCount; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'pdf-page';
      wrap.dataset.page = String(i);
      wrap.dataset.pending = '1';
      wrap.style.width = `${Math.round(this.pageBase.w * this.scale)}px`;
      wrap.style.height = `${Math.round(this.pageBase.h * this.scale)}px`;
      const pageLabel = document.createElement('div');
      pageLabel.className = 'pdf-page-label meta-label';
      pageLabel.textContent = `${i}`;
      wrap.appendChild(pageLabel);
      scroller.appendChild(wrap);
      this.wraps.set(i, wrap);
    }
  }

  // ---------- lazy rendering ----------

  /** bring the live window to the current page: dispose far, queue near */
  private syncWindow(center: number): void {
    if (this.destroyed || !this.doc) return;
    const { first, last } = pageWindow(center, this.pageCount, PDF_RENDER_BUFFER);
    for (const p of [...this.live]) {
      if (p < first || p > last) this.disposePage(p);
    }
    for (let p = first; p <= last; p++) this.queueRender(p);
  }

  private queueRender(page: number): void {
    if (this.live.has(page) || this.renderQueue.includes(page)) return;
    this.renderQueue.push(page);
    void this.drainQueue();
  }

  private async drainQueue(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.renderQueue.length > 0 && !this.destroyed) {
        const page = this.renderQueue.shift();
        if (page === undefined) break;
        if (!this.live.has(page) && !this.inflight.has(page)) {
          await this.renderPage(page);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async renderPage(i: number): Promise<void> {
    const doc = this.doc;
    const wrap = this.wraps.get(i);
    if (!doc || !wrap || this.destroyed || this.live.has(i)) return;

    try {
      const page = await doc.getPage(i);
      if (this.destroyed) return;
      const vp = page.getViewport({ scale: this.scale });

      // a page taller/wider than page 1 corrects its own box now
      wrap.style.width = `${vp.width}px`;
      wrap.style.height = `${vp.height}px`;

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width * window.devicePixelRatio);
      canvas.height = Math.floor(vp.height * window.devicePixelRatio);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const task = page.render({
        canvas,
        canvasContext: ctx,
        viewport: vp,
        transform:
          window.devicePixelRatio !== 1
            ? [window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0]
            : undefined,
      } as unknown as Parameters<typeof page.render>[0]);
      this.inflight.set(i, { cancel: () => void task.cancel() });

      // inserts keep annotation divs on top: [canvas][text][...hl]
      const firstHl = wrap.querySelector('.pdf-hl');
      wrap.insertBefore(canvas, firstHl ?? null);
      await task.promise;
      this.inflight.delete(i);
      if (this.destroyed) return;

      // text layer: selection + anchoring live here
      const textLayer = document.createElement('div');
      textLayer.className = 'pdf-text';
      textLayer.dataset.page = String(i);
      canvas.after(textLayer);
      void this.renderTextLayer(page, textLayer, vp);

      delete wrap.dataset.pending;
      wrap.classList.add('pdf-live');
      this.live.add(i);
      if (this.settings) this.applySettings(this.settings);
      this.paintAnnotationsForPage(i);
    } catch {
      // cancelled renders are expected during zoom; real failures mark the page
      this.inflight.delete(i);
      if (this.destroyed) return;
      wrap.classList.add('pdf-render-failed');
      const label = wrap.querySelector('.pdf-page-label');
      if (label) label.textContent = `${i} — failed`;
    }
  }

  /** a page leaving the window gives back its pixels, keeps its geometry + marks */
  private disposePage(i: number): void {
    const wrap = this.wraps.get(i);
    if (!wrap) return;
    const task = this.inflight.get(i);
    if (task) {
      task.cancel();
      this.inflight.delete(i);
    }
    wrap.querySelector('canvas')?.remove();
    wrap.querySelector('.pdf-text')?.remove();
    wrap.classList.remove('pdf-live', 'pdf-render-failed');
    wrap.dataset.pending = '1';
    this.live.delete(i);
    this.renderQueue = this.renderQueue.filter((p) => p !== i);
  }

  private async renderTextLayer(
    page: pdfjs.PDFPageProxy,
    container: HTMLElement,
    viewport: pdfjs.PageViewport,
  ): Promise<void> {
    try {
      const TextLayerCtor = (pdfjs as unknown as {
        TextLayer?: new (opts: {
          textContentSource: unknown;
          container: HTMLElement;
          viewport: unknown;
        }) => { render: () => Promise<void> };
      }).TextLayer;
      if (TextLayerCtor) {
        const layer = new TextLayerCtor({
          textContentSource: await page.getTextContent(),
          container,
          viewport,
        });
        await layer.render();
      }
    } catch {
      // no text layer (scanned pdf) → page bookmarks still work, said plainly
      container.dataset.noText = '1';
    }
  }

  // ---------- outline ----------

  private async loadOutline(): Promise<void> {
    const doc = this.doc;
    if (!doc) return;
    try {
      const outline = (await doc.getOutline()) as OutlineItemLike[] | null;
      if (outline && outline.length > 0) {
        const pages = new Map<OutlineItemLike, number>();
        const walk = async (items: OutlineItemLike[]): Promise<void> => {
          for (const item of items) {
            const dest = (item as { dest?: unknown }).dest;
            let resolved: unknown[] | null = null;
            try {
              if (typeof dest === 'string') {
                resolved = (await doc.getDestination(dest)) as unknown[] | null;
              } else if (Array.isArray(dest)) {
                resolved = dest as unknown[];
              }
              if (resolved && resolved.length > 0) {
                const index = await doc.getPageIndex(resolved[0] as never);
                pages.set(item, index + 1);
              }
            } catch {
              /* one unresolvable destination never sinks the outline */
            }
            if (item.items && item.items.length > 0) await walk(item.items);
          }
        };
        await walk(outline);
        const tree = outlineToChapters(outline, (item) => pages.get(item) ?? null);
        if (tree.length > 0) {
          this.chapters = tree;
          this.leaves = chapterLeaves(tree);
          return;
        }
      }
    } catch {
      /* fall through to the flat page list */
    }
    this.chapters = this.flatChapters();
    this.leaves = [];
  }

  private flatChapters(): ChapterNode[] {
    const nodes: ChapterNode[] = [];
    for (let i = 1; i <= this.pageCount; i++) {
      nodes.push({ id: `page:${i}`, label: `Page ${i}`, target: `page:${i}`, children: [] });
    }
    return nodes;
  }

  // ---------- selection → anchor ----------

  private onMouseUp(): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const text = sel.toString();
    if (text.trim().length === 0) return;
    let node: Node | null = range.startContainer;
    while (node && !(node instanceof HTMLElement && node.classList.contains('pdf-text'))) {
      node = node.parentElement;
    }
    if (!node) return;
    const layer = node as HTMLElement;
    if (layer.dataset.noText === '1') {
      this.hooks.onSelection(null);
      return;
    }
    const pageNum = Number(layer.dataset.page ?? 1);
    const fullText = layer.textContent ?? '';
    let a = fullText.indexOf(text);
    if (a === -1) a = 0;

    const wrap = layer.closest('.pdf-page') as HTMLElement | null;
    const wrapRect = wrap?.getBoundingClientRect();
    const rects: PdfAnchorData['rects'] = [];
    let menuRect: SelectionInfo['rect'] | undefined;
    if (wrapRect) {
      for (const r of range.getClientRects()) {
        if (r.width <= 0 || r.height <= 0) continue;
        rects.push(normalizeRect(r, wrapRect, pageNum));
        if (!menuRect) menuRect = { x: r.left, y: r.top, w: r.width, h: r.height };
      }
    }

    const data: PdfAnchorData = { page: pageNum, a, b: a + text.length, rects };
    const anchor: Anchor = {
      format: 'pdf',
      primary: JSON.stringify(data),
      textRange: buildTextRange(fullText, a, a + text.length),
      position: { page: pageNum, percent: (pageNum - 1) / Math.max(1, this.pageCount - 1) },
    };
    const info: SelectionInfo = { anchor, text, chapter: this.chapterLabel(pageNum), rect: menuRect };
    this.hooks.onSelection(info);
  }

  private chapterLabel(page: number): string {
    const label = chapterForPage(this.leaves, page);
    return label ?? `Page ${page}`;
  }

  // ---------- progress ----------

  private onScroll(): void {
    const scroller = this.scroller;
    if (!scroller || this.destroyed) return;
    const mid = scroller.scrollTop + scroller.clientHeight / 2;
    let current = this.currentPage;
    for (const [i, el] of this.wraps) {
      if (el.offsetTop <= mid) current = i;
      else break;
    }
    if (current !== this.currentPage) {
      this.emitProgress(current);
    }
    this.syncWindow(current);
  }

  /** the one writer of relocation truth — display, jump, and scroll all speak it */
  private emitProgress(page: number): void {
    this.currentPage = page;
    const percent = (page - 1) / Math.max(1, this.pageCount - 1);
    this.hooks.onRelocated({
      locator: `page:${page}`,
      percent,
      chapter: this.chapterLabel(page),
    });
  }

  private scrollToPage(page: number): void {
    const el = this.wraps.get(clampPage(page, this.pageCount));
    if (el && this.scroller) {
      this.scroller.scrollTo({ top: Math.max(0, el.offsetTop - 16), behavior: 'smooth' });
    }
  }

  // ---------- annotation painting ----------

  private paintAnnotations(): void {
    for (const el of this.container?.querySelectorAll('.pdf-hl') ?? []) el.remove();
    for (const view of this.annotations.values()) {
      const data = parsePrimary(view.anchor.primary);
      if (!data) continue;
      for (const r of data.rects) this.paintRect(view, r);
    }
  }

  private paintAnnotationsForPage(page: number): void {
    if (!this.annotations.size) return;
    for (const el of this.wraps.get(page)?.querySelectorAll('.pdf-hl') ?? []) el.remove();
    for (const view of this.annotations.values()) {
      const data = parsePrimary(view.anchor.primary);
      if (!data) continue;
      for (const r of data.rects) if (r.page === page) this.paintRect(view, r);
    }
  }

  private paintRect(view: AnnotationView, r: PdfAnchorData['rects'][number]): void {
    const wrap = this.wraps.get(r.page);
    if (!wrap) return;
    const div = document.createElement('div');
    div.className = `ar-hl pdf-hl ar-hl-${view.color}`;
    div.dataset.hl = view.id;
    div.style.left = `${r.x * 100}%`;
    div.style.top = `${r.y * 100}%`;
    div.style.width = `${r.w * 100}%`;
    div.style.height = `${r.h * 100}%`;
    div.style.position = 'absolute';
    div.style.cursor = 'pointer';
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hooks.onAnnotationClick(view.id);
    });
    wrap.appendChild(div);
  }

  // ---------- zoom + resize ----------

  setZoom(zoom: ZoomMode): void {
    const z = typeof zoom === 'number'
      ? Math.max(PDF_ZOOM_MIN, Math.min(PDF_ZOOM_MAX, zoom))
      : zoom;
    this.zoom = z;
    if (this.container && this.doc) {
      const keep = this.currentPage;
      this.relayout(keep);
    }
  }

  /** recompute scale, resize every placeholder, re-render only the window —
   *  the current page stays under the reader's eye */
  private relayout(keepPage: number): void {
    const scroller = this.scroller;
    if (!scroller || !this.doc) return;
    const wrap = this.wraps.get(keepPage);
    const anchorTop = wrap?.offsetTop ?? 0;
    const anchorRatio = Math.min(1, Math.max(0, (scroller.scrollTop - anchorTop) / Math.max(1, scroller.clientHeight)));

    for (const task of this.inflight.values()) task.cancel();
    this.inflight.clear();
    this.renderQueue = [];
    for (const p of [...this.live]) this.disposePage(p);
    this.scale = this.currentScale();
    for (const [i, w] of this.wraps) {
      w.style.width = `${Math.round(this.pageBase.w * this.scale)}px`;
      w.style.height = `${Math.round(this.pageBase.h * this.scale)}px`;
      if (i === keepPage) {
        // corrected on render; the estimate keeps the anchor stable for now
      }
    }
    this.currentPage = keepPage;
    this.syncWindow(keepPage);
    // restore the eye's position on the same page
    const target = this.wraps.get(keepPage);
    requestAnimationFrame(() => {
      if (!this.scroller || this.destroyed) return;
      const top = (target?.offsetTop ?? 0) + anchorRatio * this.scroller!.clientHeight - 16;
      this.scroller!.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    });
  }

  private onWindowResize = (): void => {
    // fit modes track the viewport; explicit zooms are the reader's own geometry
    if (typeof this.zoom === 'number') return;
    if (this.resizeT) clearTimeout(this.resizeT);
    this.resizeT = setTimeout(() => {
      if (!this.destroyed) this.relayout(this.currentPage);
    }, 150);
  };

  getPageCount(): number {
    return this.pageCount;
  }

  getLivePages(): number[] {
    return [...this.live].sort((a, b) => a - b);
  }
}

function parsePrimary(primary: string): PdfAnchorData | null {
  try {
    return JSON.parse(primary) as PdfAnchorData;
  } catch {
    return null;
  }
}

export function createPdfPlugin(): { format: 'pdf'; create: (hooks: FormatReaderHooks) => PdfAdapter } {
  return {
    format: 'pdf',
    create: (hooks) => new PdfAdapter(hooks),
  };
}
