/**
 * the room — one place, two cameras (v0.3.2 — the simplification):
 *
 *   shelf    what do i own and what is around me?
 *   desk     what am i doing with this source right now?
 *
 * the archive died: it was a derived view of the marks, a name over a
 * join. its ledger (api.archive) survives as the feed the notebook
 * will read. spatial memory is the contract: the desk KEEPS its context
 * when you leave (the book stays open, the position is the truth file's
 * business), the shelf remembers its scroll, and returning is
 * restoration, never routing. attention (active / reading) drives the
 * shell's visibility: full on the shelf, quiet at the desk at rest,
 * absent when the text owns the user's eyes.
 *
 * v0.3.1 — the modes are gone. v0.3.2 — the notes panel is ONE list:
 * this book's highlights + notes. the workbench (desk documents) is
 * parked — its data survives untouched in the truth files; the notebook
 * (the book of you) arrives to claim it.
 */
import { create } from 'zustand';

export type Place = 'shelf' | 'desk';

export type Attention = 'active' | 'reading';

/** the desk's live context — survives navigation (spatial memory, law 32) */
export interface DeskContext {
  bookId: string;
  /** one-shot locator for an exact source return (palette jump);
   *  consumed by the reader's boot, then cleared — progress is truth. */
  pendingLocator: string | null;
  /** one-shot highlight to focus after an exact return */
  pendingFocusId: string | null;
  /** the notes panel — this book's highlights + notes, one list. rides
   *  the desk context so a shelf roundtrip returns to the same state. */
  notesOpen: boolean;
}

interface RoomState {
  place: Place;
  desk: DeskContext | null;
  attention: Attention;
  paletteOpen: boolean;
  toasts: { id: number; text: string }[];
  /** per-place spatial memory */
  shelfScroll: number;
  /** desk engagement (selection, drawers) — chrome cannot hide mid-work */
  engaged: boolean;

  /** the settings drawer (room-owned) */
  settingsOpen: boolean;
  /** the book whose detail drawer is open (library-side, bookId-keyed) */
  detailBookId: string | null;

  goShelf: () => void;
  goDesk: (bookId: string, locator?: string | null, focusId?: string | null) => void;
  /** back to the desk exactly as it was — no locator, progress is truth */
  returnToDesk: () => void;

  /** the notes panel: open, close — never recreating the desk context
   *  (spatial memory, law 32) */
  openNotes: () => void;
  closeNotes: () => void;

  setEngaged: (engaged: boolean) => void;
  /** pointer woke the chrome (edge proximity) — active until idle again */
  poke: () => void;
  setShelfScroll: (top: number) => void;
  /** the reader consumed the one-shot locator/focus — clear them */
  clearDeskPending: () => void;

  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  /** v0.3.3 — the notebook: a surface over any place, the book of you */
  notebookOpen: boolean;
  openNotebook: () => void;
  closeNotebook: () => void;
  openBookDetail: (bookId: string) => void;
  closeBookDetail: () => void;
  toast: (text: string) => void;
}

/** the chrome-idle budget — matches the pre-shell reader behavior */
const IDLE_MS = 2800;
let toastSeq = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/** arriving at the desk starts the withdrawal clock: you came to read,
 *  not to watch chrome. the fire-time guard re-checks place + engagement,
 *  so an interrupted schedule never steals the room from open work. */
function scheduleIdle(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const now = useRoom.getState();
    if (now.place === 'desk' && !now.engaged) useRoom.setState({ attention: 'reading' });
  }, IDLE_MS);
}

export const useRoom = create<RoomState>((set, get) => ({
  place: 'shelf',
  desk: null,
  attention: 'active',
  paletteOpen: false,
  toasts: [],
  shelfScroll: 0,
  engaged: false,
  settingsOpen: false,
  notebookOpen: false,
  detailBookId: null,

  goShelf: () => set({ place: 'shelf', attention: 'active' }),

  goDesk: (bookId, locator = null, focusId = null) => {
    set({
      place: 'desk',
      attention: 'active',
      desk: {
        bookId,
        // an exact return carries a one-shot locator; a fresh open lets
        // the truth file's progress speak
        pendingLocator: locator ?? null,
        pendingFocusId: focusId ?? null,
        // a fresh open rests: the panel is closed, the reading is primary
        notesOpen: false,
      },
    });
    scheduleIdle();
  },

  returnToDesk: () => {
    if (get().desk) {
      set({ place: 'desk', attention: 'active' });
      scheduleIdle();
    } else set({ place: 'shelf' });
  },

  setEngaged: (engaged) => {
    set({ engaged });
    if (engaged) set({ attention: 'active' });
  },

  poke: () => {
    const s = get();
    if (s.place !== 'desk' || s.engaged) return;
    if (idleTimer) clearTimeout(idleTimer);
    if (s.attention !== 'active') set({ attention: 'active' });
    scheduleIdle();
  },

  setShelfScroll: (top) => set({ shelfScroll: top }),

  /* the notes panel is a property of the desk, not a route: opening
   * never recreates the context. an open panel is engagement — the
   * chrome cannot withdraw mid-work; a closed panel releases it. */
  openNotes: () => {
    const d = get().desk;
    if (!d) return;
    set({ desk: { ...d, notesOpen: true }, engaged: true, attention: 'active' });
  },

  closeNotes: () => {
    const d = get().desk;
    if (!d) return;
    set({ desk: { ...d, notesOpen: false } });
  },

  clearDeskPending: () => {
    const d = get().desk;
    if (d && (d.pendingLocator !== null || d.pendingFocusId !== null)) {
      set({ desk: { ...d, pendingLocator: null, pendingFocusId: null } });
    }
  },

  setPaletteOpen: (open) => set({ paletteOpen: open }),

  /* the notebook is a surface, not a place — it opens over whatever
   * room you are in and closes back to it. an open notebook is
   * engagement: the chrome holds. */
  openNotebook: () => set({ notebookOpen: true, engaged: true, attention: 'active' }),
  closeNotebook: () => set({ notebookOpen: false }),

  /* drawers are engagement: the chrome cannot withdraw mid-work */
  setSettingsOpen: (open) => {
    set({ settingsOpen: open });
    if (open) set({ engaged: true });
  },
  openBookDetail: (bookId) => set({ detailBookId: bookId, engaged: true }),
  closeBookDetail: () => set({ detailBookId: null }),

  toast: (text) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, text }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 2600);
  },
}));

/**
 * the shell's visibility state, derived from place + attention:
 *   full    the room is present — the shelf
 *   quiet   the desk at rest — furniture dims, structure stays
 *   absent  the text owns the eyes — the room withdraws
 */
export type ShellVisibility = 'full' | 'quiet' | 'absent';

export function shellVisibility(place: Place, attention: Attention): ShellVisibility {
  if (place === 'desk') return attention === 'reading' ? 'absent' : 'quiet';
  return 'full';
}
