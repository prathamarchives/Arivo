/**
 * THE EPUB PLUGIN — epub.js behind the format contract.
 * all format knowledge stays here; the reader above never learns what a CFI is.
 */
import ePub from 'epubjs';
import {
  EpubCFI,
  type Book,
  type Rendition,
  type Contents,
  type NavItem,
} from 'epubjs';
import type {
  Anchor,
  ChapterNode,
  AnnotationView,
  FormatReader,
  FormatReaderHooks,
  ReaderSettings,
  SelectionInfo,
  HighlightColor,
} from '@arivo/core';
import { buildTextRange, findTextRangeMatch } from '@arivo/core';
import { READ_CSS, readThemeVars } from '@arivo/ui';



// epubjs ships loose types; pin the shapes we rely on
type LooseRendition = Rendition & {
  themes: { register: (name: string, css: string) => void; select: (name: string) => void; fontSize?: (px: number | string) => void; default?: (css: string) => void };
  annotations: {
    add: (type: string, cfiRange: string, data: Record<string, unknown>, cb: (e: unknown, data: Record<string, unknown>) => void, className: string, styles?: unknown) => void;
    remove: (cfiRange: string, type: string) => void;
  };
};

interface LooseSection {
  index: number;
  href: string;
  cfiBase?: string;
  load: (req: unknown) => Promise<unknown>;
  document?: Document;
}

export class EpubAdapter implements FormatReader {
  readonly format = 'epub' as const;
  private book: Book | null = null;
  private rendition: LooseRendition | null = null;
  private container: HTMLElement | null = null;
  private settings: ReaderSettings | null = null;
  private annotations = new Map<string, AnnotationView>();
  private chapterByHref = new Map<string, string>();
  private cfiBaseByIndex = new Map<number, string>();
  private currentChapter = 'Chapter 1';
  private lastContents: (Contents & { window: Window; document: Document }) | null = null;
  /** @font-face css for the book content — the app injects it (fonts are app assets) */
  private fontFaceCss = '';

  private hooks: FormatReaderHooks;

  constructor(hooks: FormatReaderHooks) {
    this.hooks = hooks;
  }

  async open(container: HTMLElement, source: ArrayBuffer): Promise<void> {
    this.container = container;
    const book = ePub(source);
    this.book = book;

    await (book as Book & { loaded: { navigation: Promise<{ toc: NavItem[] }> } }).loaded
      .navigation as unknown as Promise<{ toc: NavItem[] }>;

    const rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'none',
      manager: 'default',
    }) as LooseRendition;
    this.rendition = rendition;

    // chapter labels by href (for annotations + the notebook)
    const nav = await (book as Book & { loaded: { navigation: Promise<{ toc: NavItem[] }> } }).loaded
      .navigation;
    const walk = (items: NavItem[]) => {
      for (const item of items) {
        const label = String(item.label?.trim?.() ?? item.label ?? '').trim();
        if (item.href) this.chapterByHref.set(item.href.split('#')[0]!, label);
        if (item.subitems) walk(item.subitems);
      }
    };
    walk(nav.toc ?? []);

    // spine index → chapter label (fallback: nearest previous toc entry)
    const spine = (book as Book & { spine?: { items?: LooseSection[]; get?: (i: number) => LooseSection | undefined } }).spine;
    const spineItems = (spine?.items ?? []) as LooseSection[];
    const hrefs = spineItems.map((s) => s.href);
    let lastLabel = '';
    for (let i = 0; i < hrefs.length; i++) {
      const href = hrefs[i] ?? '';
      const label = this.chapterByHref.get(href.split('#')[0] ?? '');
      if (label) lastLabel = label;
      const base = spineItems[i]?.cfiBase;
      if (base) this.cfiBaseByIndex.set(i, base);
      this.chapterByHref.set(`__spine:${i}`, lastLabel || `Section ${i + 1}`);
    }

    // theme

    // relocated → progress
    rendition.on('relocated', (location: unknown) => {
      const loc = location as {
        start?: { cfi: string; index?: number; percentage?: number; href?: string };
      } | undefined;
      if (!loc?.start?.cfi) return;
      const spineIdx = new EpubCFI(loc.start.cfi).spinePos;
      const chapter = this.chapterLabelFor(spineIdx, loc.start.href);
      this.currentChapter = chapter;
      let percent = loc.start.percentage;
      if (typeof percent !== 'number' || Number.isNaN(percent)) {
        percent = spineIdx / Math.max(1, spineItems.length - 1);
      }
      this.hooks.onRelocated({ locator: loc.start.cfi, percent, chapter });
    });

    // selected → the signature moment
    rendition.on(
      'selected',
      (cfiRange: string, contents: Contents & { window: Window; document: Document }) => {
        this.lastContents = contents;
        void this.buildSelection(cfiRange, contents);
      },
    );

    // our theme lives as a <style> in each rendered section — epub.js's
    // css-string theme path is broken in 0.3.93, so we inject it ourselves
    rendition.on('rendered', (_section: unknown, contents: Contents) => {
      this.injectStyleInto(contents as Contents & { document: Document });
    });

    // resize
    window.addEventListener('resize', this.onResize);
  }

  async display(target?: string): Promise<void> {
    if (!this.rendition) return;
    await this.rendition.display(target || undefined).catch(() => this.rendition?.display());
    void this.generateLocations();
  }

  private locationsReady = false;
  private async generateLocations(): Promise<void> {
    if (this.locationsReady || !this.book) return;
    this.locationsReady = true;
    try {
      await (this.book as Book & { locations: { generate: (n: number) => Promise<void> } })
        .locations.generate(1024);
    } catch {
      /* percent falls back to spine fraction — honest enough */
    }
  }

  next(): void {
    this.rendition?.next();
  }

  prev(): void {
    this.rendition?.prev();
  }

  async jumpTo(locator: string): Promise<void> {
    if (locator.startsWith('__spine:')) {
      await this.rendition?.display(Number(locator.slice('__spine:'.length)));
      return;
    }
    await this.rendition?.display(locator).catch(() => undefined);
  }

  focusAnnotation(id: string): void {
    const view = this.annotations.get(id);
    if (!view) return;
    void this.rendition?.display(view.anchor.primary).then(() => {
      this.renderOne(view, true);
    });
  }

  applySettings(settings: ReaderSettings): void {
    this.settings = settings;
    const r = this.rendition;
    if (!r) return;
    try {
      r.themes.fontSize?.(`${[16, 18, 20, 22, 24][settings.fontStep] ?? 20}px`);
    } catch {
      /* size applies on the next render — honest */
    }
    if (this.container) {
      this.container.dataset.readTheme = settings.theme;
    }
    this.restyleLiveContents();
  }

  /** swap the style element in every live section (theme/font changes) */
  private restyleLiveContents(): void {
    const r = this.rendition as unknown as {
      getContents?: () => (Contents & { document: Document })[];
    } | null;
    const contents = r?.getContents?.() ?? [];
    for (const c of contents) this.injectStyleInto(c);
  }

  private injectStyleInto(contents: Contents & { document: Document }): void {
    const doc = contents.document;
    if (!doc?.head) return;
    const old = doc.getElementById('arivo-style');
    if (old) old.remove();
    const style = doc.createElement('style');
    style.id = 'arivo-style';
    const vars = readThemeVars(this.settings?.theme ?? 'paper');
    style.textContent = `${this.fontFaceCss}\n${vars}\n${READ_CSS}`;
    doc.head.appendChild(style);
  }

  /** the app owns the fonts; the reader injects them into book content */
  setFontFace(css: string): void {
    this.fontFaceCss = css;
    if (this.settings) this.applySettings(this.settings);
  }

  getChapters(): ChapterNode[] {
    const nav = (this.book as unknown as { navigation?: { toc?: NavItem[] } })?.navigation;
    const toc = nav?.toc ?? [];
    const map = (items: NavItem[]): ChapterNode[] =>
      items
        .filter((i) => i.href)
        .map((i) => ({
          id: i.href!,
          label: String(i.label?.trim?.() ?? i.label ?? '').trim() || '—',
          target: i.href!,
          children: i.subitems ? map(i.subitems) : [],
        }));
    const tree = map(toc);
    if (tree.length > 0) return tree;
    // spine fallback
    const spineItems = ((this.book as unknown as { spine?: { items?: LooseSection[] } }).spine?.items ?? []) as LooseSection[];
    return spineItems.map((s, i) => ({
      id: `__spine:${i}`,
      label: this.chapterByHref.get(`__spine:${i}`) ?? `Section ${i + 1}`,
      target: `__spine:${i}`,
      children: [],
    }));
  }

  renderAnnotations(items: AnnotationView[]): void {
    // remove stale, re-add all (colors/notes change; count is small)
    for (const [id] of this.annotations) {
      const view = this.annotations.get(id);
      if (view && !items.find((i) => i.id === id)) {
        try {
          this.rendition?.annotations.remove(view.anchor.primary, 'highlight');
        } catch {
          /* gone already */
        }
      }
    }
    this.annotations.clear();
    for (const item of items) this.annotations.set(item.id, item);
    for (const item of items) this.renderOne(item, false);
  }

  removeAnnotation(id: string): void {
    const view = this.annotations.get(id);
    if (!view) return;
    try {
      this.rendition?.annotations.remove(view.anchor.primary, 'highlight');
    } catch {
      /* already gone */
    }
    this.annotations.delete(id);
  }

  private renderOne(view: AnnotationView, flash: boolean): void {
    const r = this.rendition;
    if (!r) return;
    const cls = `ar-hl ar-hl-${view.color}${flash ? ' ar-hl-flash' : ''}${
      view.anchor.primary === '' ? ' ar-hl-orphaned' : ''
    }`;
    const data = { id: view.id, color: view.color, note: view.note };
    const click = (e: unknown, d: Record<string, unknown>) => {
      if (typeof e === 'object' && e && 'preventDefault' in (e as object)) {
        (e as { preventDefault: () => void }).preventDefault();
      }
      this.hooks.onAnnotationClick(String(d.id));
    };
    try {
      r.annotations.add(
        'highlight',
        view.anchor.primary,
        data,
        click as unknown as () => void,
        cls,
      );
    } catch {
      /* invalid cfi — the drift pass handles it visibly */
    }
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    try {
      this.rendition?.destroy();
      (this.book as unknown as { destroy?: () => void })?.destroy?.();
    } catch {
      /* teardown best-effort */
    }
    this.book = null;
    this.rendition = null;
  }

  clearSelection(): void {
    try {
      this.lastContents?.window.getSelection()?.removeAllRanges();
    } catch {
      /* the iframe is gone — nothing to clear */
    }
  }

  private onResize = () => {
    (this.rendition as unknown as { resize?: (...args: unknown[]) => void })?.resize?.();
  };

  private chapterLabelFor(spineIndex: number, href?: string): string {
    if (href) {
      const label = this.chapterByHref.get(href.split('#')[0] ?? '');
      if (label) return label;
    }
    return this.chapterByHref.get(`__spine:${spineIndex}`) ?? `Section ${spineIndex + 1}`;
  }

  // ---------- selection → anchor ----------

  private async buildSelection(
    cfiRange: string,
    contents: Contents & { window: Window; document: Document },
  ): Promise<void> {
    try {
      const book = this.book;
      if (!book) return;
      const range = (await (book as Book & { getRange?: (cfi: string) => Promise<Range> }).getRange?.(
        cfiRange,
      )) as Range | undefined;
      const text = range?.toString() ?? '';
      if (text.trim().length === 0) {
        this.hooks.onSelection(null);
        return;
      }
      const doc = contents?.document ?? (range?.startContainer.ownerDocument ?? null);
      const fullText = doc?.body?.textContent ?? text;
      let start = fullText.indexOf(text);
      if (start === -1) start = 0;
      const cfi = new EpubCFI(cfiRange);
      const spineIdx = typeof cfi.spinePos === 'number' ? cfi.spinePos : 0;
      const chapter = this.chapterLabelFor(spineIdx);
      const anchor: Anchor = {
        format: 'epub',
        primary: cfiRange,
        textRange: buildTextRange(fullText, start, start + text.length),
        position: { spineIndex: spineIdx, chapter },
      };

      // position the selection menu: range rect + iframe offset
      let rect: SelectionInfo['rect'] | undefined;
      try {
        const iframe = doc?.defaultView?.frameElement as HTMLElement | null;
        if (range && iframe) {
          const r = range.getBoundingClientRect();
          const ir = iframe.getBoundingClientRect();
          rect = {
            x: ir.left + r.left,
            y: ir.top + r.top,
            w: r.width,
            h: r.height,
          };
        }
      } catch {
        /* menu falls back to center */
      }

      const sel: SelectionInfo = { anchor, text, chapter, rect };
      this.hooks.onSelection(sel);
    } catch {
      this.hooks.onSelection(null);
    }
  }

  // ---------- drift resolution: the crown jewel's runtime ----------

  /** try to re-anchor a highlight whose CFI died: text match → mint a new CFI */
  async repairAnchor(anchor: Anchor): Promise<Anchor | null> {
    const book = this.book;
    if (!book || !anchor.textRange) return null;
    const spineIdx = anchor.position?.spineIndex ?? 0;
    const spine = (book as Book & { spine?: { get?: (i: number) => LooseSection | undefined } }).spine;
    const section = spine?.get?.(spineIdx);
    if (!section) return null;
    try {
      const loaded = (await section.load(
        (book as unknown as { load: (...args: unknown[]) => unknown }).load,
      )) as Document | null;
      const doc = loaded;
      const fullText = doc?.body?.textContent ?? '';
      const match = findTextRangeMatch(fullText, anchor.textRange);
      if (!match) return null;
      const domRange = this.rangeFromOffsets(doc!, match.index, match.end);
      if (!domRange) return null;
      const base = this.cfiBaseByIndex.get(spineIdx) ?? section.cfiBase;
      if (!base) return null;
      const gen = new EpubCFI();
      const minted = (
        gen as unknown as { generateFromRange?: (r: Range, base: string) => string }
      ).generateFromRange?.(domRange, base);
      if (typeof minted === 'string' && minted.includes('epubcfi')) {
        return { ...anchor, primary: minted };
      }
      return null;
    } catch {
      return null;
    }
  }

  private rangeFromOffsets(doc: Document, start: number, end: number): Range | null {
    try {
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      let consumed = 0;
      let startNode: Text | null = null;
      let startOff = 0;
      let endNode: Text | null = null;
      let endOff = 0;
      let node = walker.nextNode() as Text | null;
      while (node) {
        const len = node.data.length;
        if (startNode === null && consumed + len >= start) {
          startNode = node;
          startOff = start - consumed;
        }
        if (consumed + len >= end) {
          endNode = node;
          endOff = end - consumed;
          break;
        }
        consumed += len;
        node = walker.nextNode() as Text | null;
      }
      if (!startNode || !endNode) return null;
      const range = doc.createRange();
      range.setStart(startNode, Math.max(0, Math.min(startOff, startNode.data.length)));
      range.setEnd(endNode, Math.max(0, Math.min(endOff, endNode.data.length)));
      return range;
    } catch {
      return null;
    }
  }

  /** validate a CFI against the loaded book */
  async cfiValid(cfi: string): Promise<boolean> {
    const book = this.book as (Book & { getRange?: (cfi: string) => Promise<Range> }) | null;
    if (!book?.getRange) return true;
    try {
      const r = await book.getRange(cfi);
      return r !== undefined && r !== null;
    } catch {
      return false;
    }
  }
}

export function createEpubPlugin(): { format: 'epub'; create: (hooks: FormatReaderHooks) => EpubAdapter } {
  return {
    format: 'epub',
    create: (hooks) => new EpubAdapter(hooks),
  };
}

export type { HighlightColor };
