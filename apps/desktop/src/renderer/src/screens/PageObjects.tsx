/**
 * the page objects (v0.3.1) — sticky notes and ink laid on the VISIBLE
 * page. the owner's two instruments for making the page itself markable:
 *
 *   sticky note   a small paper pinned to where you are — drag it, write
 *                 on it, tint it. it survives window resizing (x/y are
 *                 fractions of the reader stage) and finds its page again
 *                 through the anchor (epub spine+page / pdf page).
 *   ink           pencil, pen, highlighter — freehand strokes over the
 *                 page, one sketch per page, points as fractions so the
 *                 ink keeps its place over the text beneath.
 *
 * both are OVERLAYS: the reading column never moves, never reflows. the
 * layers rest pointer-transparent until a note or the draw mode claims
 * the pointer — selection always belongs to the text first.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Anchor, Book, InkStroke, InkTool, RelocatedEvent, Sketch, StickyColor, StickyNote } from '@arivo/core';
import { uuidv7 } from '@arivo/core';
import { useDraft } from '../lib/useDraft.ts';
import { IconX, IconCheck, IconTrash, IconPencil, IconNote, IconBack } from '../components/icons.tsx';

export const STICKY_COLORS: readonly StickyColor[] = ['yellow', 'blue', 'green', 'pink', 'violet'];

/** the tilt set — a paper on a desk is never perfectly straight */
const TILTS = ['-1.1deg', '0.6deg', '-0.5deg', '1.2deg', '-0.2deg'] as const;
const tiltFor = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return TILTS[Math.abs(h) % TILTS.length]!;
};

/** does this page object's anchor belong to the visible view? */
export function onVisiblePage(anchor: Anchor, view: RelocatedEvent | null, format: Book['format']): boolean {
  if (!view) return false;
  if (format === 'pdf') {
    const p = anchor.position?.page;
    return p === undefined || view.page === undefined ? true : p === view.page;
  }
  const spine = anchor.position?.spineIndex;
  if (spine !== undefined && view.spineIndex !== undefined && spine !== view.spineIndex) return false;
  const p = anchor.position?.page;
  if (p === undefined || view.pageInSpine === undefined) return true;
  return p === view.pageInSpine;
}

/** the anchor a NEW page object gets: the visible view's identity */
export function pageAnchor(book: Book, ev: RelocatedEvent): Anchor {
  return {
    format: book.format,
    primary: ev.locator,
    textRange: null,
    position: {
      spineIndex: ev.spineIndex,
      page: book.format === 'pdf' ? ev.page : ev.pageInSpine,
      percent: ev.percent,
      chapter: ev.chapter ?? undefined,
    },
  };
}

// ---------------- sticky note ----------------

function StickyCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: StickyNote;
  onUpdate: (s: StickyNote) => void;
  onDelete: (id: string) => void;
}): ReactNode {
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; x0: number; y0: number; w: number; h: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  /* sticky text is user text: the draft engine's mirror law applies —
   * keystrokes land locally at once; the store only sees a save that
   * was asked for. a death mid-edit resurrects on this same note. */
  const draft = useDraft({
    key: `arivo.draft.sticky.${note.bookId}.${note.id}`,
    loadStore: async () => note.body,
    save: async (t) => {
      onUpdate({ ...note, body: t, updatedAt: Date.now() });
    },
    autoSave: false,
  });

  const commit = (): void => {
    if (draft.text.trim() !== note.body) void draft.flush();
    setEditing(false);
  };

  /* drag: pointer capture on the head strip; the card translates live,
   * the fractions commit once on release (clamped so the paper stays
   * reachable on the page) */
  const onHeadPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (editing || e.button !== 0) return;
    const stage = cardRef.current?.parentElement;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, x0: note.x, y0: note.y, w: r.width, h: r.height };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHeadPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d || !cardRef.current) return;
    const dx = (e.clientX - d.startX) / d.w;
    const dy = (e.clientY - d.startY) / d.h;
    const x = Math.min(Math.max(d.x0 + dx, 0), 0.94);
    const y = Math.min(Math.max(d.y0 + dy, 0), 0.9);
    cardRef.current.style.left = `${x * 100}%`;
    cardRef.current.style.top = `${y * 100}%`;
    cardRef.current.dataset.x = String(x);
    cardRef.current.dataset.y = String(y);
  };
  const onHeadPointerUp = (): void => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d) return;
    const el = cardRef.current;
    const x = el?.dataset.x ? Number(el.dataset.x) : d.x0;
    const y = el?.dataset.y ? Number(el.dataset.y) : d.y0;
    if (x !== note.x || y !== note.y) onUpdate({ ...note, x, y, updatedAt: Date.now() });
  };

  return (
    <div
      ref={cardRef}
      className={`sticky-note${dragging ? ' sticky-dragging' : ''}`}
      data-color={note.color}
      style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%`, '--sticky-tilt': tiltFor(note.id) } as React.CSSProperties}
      aria-label="sticky note"
    >
      <div
        className="sticky-head"
        onPointerDown={onHeadPointerDown}
        onPointerMove={onHeadPointerMove}
        onPointerUp={onHeadPointerUp}
        title="drag to move"
      >
        <span className="sticky-grip" aria-hidden="true" />
        <div className="sticky-dots" onClick={(e) => e.stopPropagation()}>
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`sticky-dot sticky-dot-${c}`}
              aria-label={`tint ${c}`}
              onClick={() => onUpdate({ ...note, color: c, updatedAt: Date.now() })}
            />
          ))}
        </div>
        <button
          type="button"
          className="sticky-x"
          aria-label="remove sticky note"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
        >
          <IconX />
        </button>
      </div>
      {editing ? (
        <div className="sticky-edit" onClick={(e) => e.stopPropagation()}>
          <textarea
            className="sticky-input"
            autoFocus
            value={draft.text}
            placeholder="write something…"
            onChange={(e) => draft.edit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && draft.text.trim()) commit();
              if (e.key === 'Escape') {
                draft.discard();
                setEditing(false);
              }
            }}
            rows={4}
          />
          <div className="sticky-edit-foot">
            <span className="meta-label">
              <span data-status={draft.status} className="sticky-status">
                {draft.text.trim() ? 'ctrl+enter saves' : 'esc cancels'}
              </span>
            </span>
            <button type="button" className="sticky-save" onClick={commit} aria-label="save note">
              <IconCheck />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="sticky-body" onClick={() => setEditing(true)}>
          {note.body || <span className="sticky-empty">write something…</span>}
        </button>
      )}
    </div>
  );
}

// ---------------- the sticky layer ----------------

export function StickyLayer({
  stickies,
  onUpdate,
  onDelete,
}: {
  stickies: StickyNote[];
  onUpdate: (s: StickyNote) => void;
  onDelete: (id: string) => void;
}): ReactNode {
  return (
    <div className="sticky-layer" aria-hidden="false">
      {stickies.map((s) => (
        <StickyCard key={s.id} note={s} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ---------------- the ink layer ----------------

/** resolve an annotation identity color to a paintable rgb string —
 *  law 38 keeps them constant, so one resolution serves every theme */
function annoCss(varName: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || '#DCA93B';
}

const TOOL_STYLE: Record<InkTool, { width: number; alpha: number; blend: boolean }> = {
  pencil: { width: 2, alpha: 0.55, blend: false },
  pen: { width: 3.5, alpha: 1, blend: false },
  highlighter: { width: 14, alpha: 0.32, blend: true },
};

export const INK_TOOLS: readonly InkTool[] = ['pencil', 'pen', 'highlighter'];

export function InkLayer({
  sketch,
  active,
  tool,
  color,
  onCommitStrokes,
}: {
  sketch: Sketch | null;
  active: boolean;
  tool: InkTool;
  color: StickyColor;
  onCommitStrokes: (strokes: InkStroke[], sketchId: string | null) => void;
}): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  /** the live stroke — viewport fractions, flat pairs */
  const liveRef = useRef<number[] | null>(null);

  const redraw = useCallback((): void => {
    const canvas = canvasRef.current;
    const size = sizeRef.current;
    if (!canvas || !size) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const strokes = [...(sketch?.strokes ?? [])];
    if (liveRef.current && liveRef.current.length >= 4) {
      strokes.push({ tool, color, size: TOOL_STYLE[tool].width, points: liveRef.current });
    }
    for (const stroke of strokes) {
      const style = TOOL_STYLE[stroke.tool] ?? TOOL_STYLE.pen;
      ctx.globalAlpha = style.alpha;
      ctx.globalCompositeOperation = style.blend ? 'multiply' : 'source-over';
      ctx.strokeStyle = annoCss(`--anno-${stroke.color === 'yellow' ? 'amber' : stroke.color}`);
      ctx.lineWidth = stroke.size || style.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const pts = stroke.points;
      if (pts.length >= 2) {
        ctx.moveTo(pts[0]! * size.w, pts[1]! * size.h);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]! * size.w, pts[i + 1]! * size.h);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [sketch, tool, color]);

  /* the canvas tracks its stage: resize re-measures, re-scales, repaints.
   * dpr-aware so ink stays crisp on dense displays. */
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas?.parentElement;
    if (!canvas || !stage) return;
    const measure = (): void => {
      const r = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { w: r.width, h: r.height };
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      redraw();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const pointAt = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!active || e.button !== 0) return;
    const p = pointAt(e);
    if (!p) return;
    liveRef.current = [p.x, p.y];
    e.currentTarget.setPointerCapture(e.pointerId);
    redraw();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const live = liveRef.current;
    if (!live) return;
    const p = pointAt(e);
    if (!p) return;
    /* the last point and this one far enough apart to be a point (the
     * fraction floor keeps the stored stroke honest and small) */
    const lx = live[live.length - 2]!;
    const ly = live[live.length - 1]!;
    if (Math.hypot(p.x - lx, p.y - ly) < 0.0025) return;
    live.push(p.x, p.y);
    redraw();
  };
  const onPointerUp = (): void => {
    const live = liveRef.current;
    liveRef.current = null;
    if (!live || live.length < 4) {
      redraw();
      return;
    }
    const stroke: InkStroke = { tool, color, size: TOOL_STYLE[tool].width, points: live };
    const next = [...(sketch?.strokes ?? []), stroke];
    if (next.length > 512) next.splice(0, next.length - 512);
    onCommitStrokes(next, sketch?.id ?? null);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`ink-layer${active ? ' ink-active' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label={active ? 'drawing on the page' : undefined}
    />
  );
}

// ---------------- the ink toolbar ----------------

export function InkToolbar({
  tool,
  color,
  onTool,
  onColor,
  onUndo,
  onClear,
  onExit,
  canUndo,
}: {
  tool: InkTool;
  color: StickyColor;
  onTool: (t: InkTool) => void;
  onColor: (c: StickyColor) => void;
  onUndo: () => void;
  onClear: () => void;
  onExit: () => void;
  canUndo: boolean;
}): ReactNode {
  return (
    <div className="ink-toolbar glass rise" role="toolbar" aria-label="drawing tools">
      {INK_TOOLS.map((t) => (
        <button
          key={t}
          type="button"
          className={`ink-tool${tool === t ? ' ink-tool-active' : ''}`}
          onClick={() => onTool(t)}
          aria-pressed={tool === t}
          title={t}
        >
          {t === 'pencil' ? <IconPencil /> : t === 'pen' ? <IconNote /> : <span className="ink-highlighter-glyph" aria-hidden="true" />}
        </button>
      ))}
      <span className="sel-sep" />
      {STICKY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`sel-dot sel-dot-${c}${color === c ? ' sel-dot-active' : ''}`}
          onClick={() => onColor(c)}
          aria-label={`ink ${c}`}
          aria-pressed={color === c}
        />
      ))}
      <span className="sel-sep" />
      <button type="button" className="ink-tool" onClick={onUndo} disabled={!canUndo} title="undo stroke" aria-label="undo stroke">
        <IconBack />
      </button>
      <button type="button" className="ink-tool" onClick={onClear} title="clear this page's ink" aria-label="clear ink">
        <IconTrash />
      </button>
      <button type="button" className="ink-tool ink-exit" onClick={onExit} title="done drawing (esc)" aria-label="done drawing">
        <IconCheck />
      </button>
    </div>
  );
}

/** a fresh sketch object for a page that has none yet */
export function newSketch(book: Book, anchor: Anchor, chapter: string | null): Sketch {
  return {
    id: uuidv7(),
    bookId: book.id,
    anchor,
    strokes: [],
    chapter,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
