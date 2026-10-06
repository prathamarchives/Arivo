/**
 * THE PDF PLUGIN — pdf.js behind the format contract.
 * honest scope: fixed layout, zoom/fit, page bookmarks, text-layer highlights
 * when the text layer exists. scanned pages = page bookmarks only, said plainly.
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

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfAnchorData {
  page: number;
  a: number;
  b: number;
  rects: { page: number; x: number; y: number; w: number; h: number }[];
}

type ZoomMode = 'fit-width' | 'fit-page' | 1;

export class PdfAdapter implements FormatReader {
  readonly format = 'pdf' as const;
  private doc: pdfjs.PDFDocumentProxy | null = null;
  private container: HTMLElement | null = null;
  private scroller: HTMLElement | null = null;
  private zoom: ZoomMode = 'fit-width';
  private settings: ReaderSettings | null = null;
  private rendered = new Map<number, HTMLDivElement>();
  private annotations = new Map<string, AnnotationView>();
  private pageCount = 0;
  private currentPage = 1;
  private scrollT: ReturnType<typeof setTimeout> | null = null;

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

    const doc = await pdfjs.getDocument({ data: new Uint8Array(source.slice(0)) }).promise;
    this.doc = doc;
    this.pageCount = doc.numPages;

    scroller.addEventListener('scroll', () => {
      if (this.scrollT) clearTimeout(this.scrollT);
      this.scrollT = setTimeout(() => this.onScroll(), 120);
    });
    scroller.addEventListener('mouseup', () => this.onMouseUp());
    this.renderAll();
  }

  async display(target?: string): Promise<void> {
    const page = this.parseTarget(target);
    this.scrollToPage(page);
  }

  next(): void {
    this.scroller?.scrollBy({ top: this.scroller.clientHeight * 0.9, behavior: 'smooth' });
  }

  prev(): void {
    this.scroller?.scrollBy({ top: -this.scroller.clientHeight * 0.9, behavior: 'smooth' });
  }

  async jumpTo(locator: string): Promise<void> {
    this.scrollToPage(this.parseTarget(locator));
  }

  focusAnnotation(id: string): void {
    const view = this.annotations.get(id);
    const data = view ? parsePrimary(view.anchor.primary) : null;
    if (data) {
      this.scrollToPage(data.page);
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
    for (const layer of this.container.querySelectorAll('.pdf-text')) {
      (layer as HTMLElement).style.mixBlendMode = night ? 'difference' : 'multiply';
    }
  }

  getChapters(): ChapterNode[] {
    const nodes: ChapterNode[] = [];
    for (let i = 1; i <= this.pageCount; i++) {
      nodes.push({ id: `page:${i}`, label: `Page ${i}`, target: `page:${i}`, children: [] });
    }
    return nodes;
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
    if (this.scrollT) clearTimeout(this.scrollT);
    (this.doc as unknown as { destroy?: () => Promise<void> } | null)?.destroy?.();
    this.doc = null;
  }

  // ---------- rendering ----------

  private scale = 1;

  private async renderAll(): Promise<void> {
    const scroller = this.scroller;
    const doc = this.doc;
    if (!scroller || !doc) return;
    const first = await doc.getPage(1);
    const vp0 = first.getViewport({ scale: 1 });
    const avail = scroller.clientWidth - 48;
    this.scale =
      this.zoom === 'fit-width'
        ? avail / vp0.width
        : this.zoom === 'fit-page'
          ? Math.min(avail / vp0.width, (scroller.clientHeight - 48) / vp0.height)
          : 1;

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: this.scale });
      const wrap = document.createElement('div');
      wrap.className = 'pdf-page';
      wrap.dataset.page = String(i);
      wrap.style.width = `${vp.width}px`;
      wrap.style.height = `${vp.height}px`;

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width * window.devicePixelRatio);
      canvas.height = Math.floor(vp.height * window.devicePixelRatio);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport: vp,
          transform: window.devicePixelRatio !== 1 ? [window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0] : undefined,
        } as unknown as Parameters<typeof page.render>[0]).promise;
      }
      wrap.appendChild(canvas);

      // text layer: selection + anchoring live here
      const textLayer = document.createElement('div');
      textLayer.className = 'pdf-text';
      textLayer.dataset.page = String(i);
      wrap.appendChild(textLayer);
      void this.renderTextLayer(page, textLayer, vp);

      const pageLabel = document.createElement('div');
      pageLabel.className = 'pdf-page-label meta-label';
      pageLabel.textContent = `${i}`;
      wrap.appendChild(pageLabel);

      scroller.appendChild(wrap);
      this.rendered.set(i, wrap);
      if (this.settings) this.applySettings(this.settings);
      this.paintAnnotationsForPage(i);
      if (i === 1) this.onScroll();
    }
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
    const el = range.startContainer.parentElement;
    if (wrapRect && el) {
      for (const r of range.getClientRects()) {
        if (r.width <= 0 || r.height <= 0) continue;
        rects.push({
          page: pageNum,
          x: (r.left - wrapRect.left) / wrapRect.width,
          y: (r.top - wrapRect.top) / wrapRect.height,
          w: r.width / wrapRect.width,
          h: r.height / wrapRect.height,
        });
      }
    }

    const data: PdfAnchorData = { page: pageNum, a, b: a + text.length, rects };
    const anchor: Anchor = {
      format: 'pdf',
      primary: JSON.stringify(data),
      textRange: buildTextRange(fullText, a, a + text.length),
      position: { page: pageNum, percent: (pageNum - 1) / Math.max(1, this.pageCount - 1) },
    };
    const info: SelectionInfo = { anchor, text, chapter: `Page ${pageNum}` };
    this.hooks.onSelection(info);
  }

  // ---------- progress ----------

  private onScroll(): void {
    const scroller = this.scroller;
    if (!scroller) return;
    const mid = scroller.scrollTop + scroller.clientHeight / 2;
    let current = 1;
    for (const [i, el] of this.rendered) {
      const top = el.offsetTop;
      if (top <= mid) current = i;
    }
    if (current !== this.currentPage) {
      this.currentPage = current;
      const percent = (current - 1) / Math.max(1, this.pageCount - 1);
      this.hooks.onRelocated({
        locator: `page:${current}`,
        percent,
        chapter: `Page ${current}`,
      });
    }
  }

  private scrollToPage(page: number): void {
    const el = this.rendered.get(page);
    if (el && this.scroller) {
      this.scroller.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
    }
  }

  private parseTarget(target: string | undefined): number {
    if (!target) return 1;
    const m = target.match(/^page:(\d+)$/);
    if (m) return Math.max(1, Math.min(this.pageCount, Number(m[1])));
    const n = Number(target);
    if (!Number.isNaN(n)) return Math.max(1, Math.min(this.pageCount, n));
    return 1;
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
    for (const view of this.annotations.values()) {
      const data = parsePrimary(view.anchor.primary);
      if (!data) continue;
      for (const r of data.rects) if (r.page === page) this.paintRect(view, r);
    }
  }

  private paintRect(view: AnnotationView, r: PdfAnchorData['rects'][number]): void {
    const wrap = this.rendered.get(r.page);
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

  setZoom(zoom: ZoomMode): void {
    this.zoom = zoom;
    if (this.container && this.doc) {
      const keep = this.currentPage;
      this.rendered.clear();
      void this.renderAll().then(() => this.scrollToPage(keep));
    }
  }

  getPageCount(): number {
    return this.pageCount;
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
