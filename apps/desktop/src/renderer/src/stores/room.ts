/**
 * the room — L8's state model. the app stops being a router (library ↔
 * reader) and becomes one place with three camera positions:
 *
 *   shelf    what do i own and what is around me?
 *   desk     what am i doing with this source right now?
 *   archive  what came out of my work?
 *
 * spatial memory is the contract: the desk KEEPS its context when you
 * leave (the book stays open, the position is the truth file's business),
 * the shelf remembers its scroll, and returning is restoration, never
 * routing. attention (active / reading) drives the shell's visibility:
 * full on shelf/archive, quiet at the desk at rest, absent when the text
 * owns the user's eyes.
 */
import { create } from 'zustand';

export type Place = 'shelf' | 'desk' | 'archive';

export type Attention = 'active' | 'reading';

/**
 * L10 — the desk's attention modes. not pages, not routes: instruments.
 * the book stays the primary object; the mode decides which work surface
 * is available beside it. READ is the resting state and stays sacred —
 * the chrome-withdrawal law (attention) is untouched by mode switches.
 */
export type DeskMode = 'read' | 'mark' | 'research' | 'make' | 'reflect';

export const DESK_MODES: readonly DeskMode[] = ['read', 'mark', 'research', 'make', 'reflect'];

/** the desk's live context — survives navigation (spatial memory, law 32) */
export interface DeskContext {
  bookId: string;
  /** one-shot locator for an exact source return (archive/palette jump);
   *  consumed by the reader's boot, then cleared — progress is truth. */
  pendingLocator: string | null;
  /** one-shot highlight to focus after an exact return */
  pendingFocusId: string | null;
  /** L10 — the desk's mode. rides the desk context: a shelf roundtrip
   *  returns to the same instruments, the same open document. */
  mode: DeskMode;
  /** the workbench's open document, if any — part of the desk's state */
  workbenchDocId: string | null;
}

interface RoomState {
  place: Place;
  desk: DeskContext | null;
  attention: Attention;
  paletteOpen: boolean;
  toasts: { id: number; text: string }[];
  /** per-place spatial memory */
  shelfScroll: number;
  archiveScroll: number;
  /** desk engagement (selection, drawers) — chrome cannot hide mid-work */
  engaged: boolean;

  /** the settings drawer (wave 1's settings surface, room-owned) */
  settingsOpen: boolean;
  /** the book whose detail drawer is open (library-side, bookId-keyed) */
  detailBookId: string | null;

  goShelf: () => void;
  goDesk: (bookId: string, locator?: string | null, focusId?: string | null) => void;
  goArchive: () => void;
  /** back to the desk exactly as it was — no locator, progress is truth */
  returnToDesk: () => void;

  /** L10 — switch the desk's mode without losing any desk context */
  setDeskMode: (mode: DeskMode) => void;
  /** L10 — the workbench's open document (part of spatial memory) */
  setWorkbenchDoc: (docId: string | null) => void;

  setEngaged: (engaged: boolean) => void;
  /** pointer woke the chrome (edge proximity) — active until idle again */
  poke: () => void;
  setShelfScroll: (top: number) => void;
  setArchiveScroll: (top: number) => void;
  /** the reader consumed the one-shot locator/focus — clear them */
  clearDeskPending: () => void;

  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
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
  archiveScroll: 0,
  engaged: false,
  settingsOpen: false,
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
        // a fresh open starts in READ — the resting state, the sacred one
        mode: 'read',
        workbenchDocId: null,
      },
    });
    scheduleIdle();
  },

  goArchive: () => set({ place: 'archive', attention: 'active' }),

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
  setArchiveScroll: (top) => set({ archiveScroll: top }),

  /* L10 — mode is a property of the desk, not a route: switching never
   * recreates the context, never touches attention's withdrawal law.
   * the work modes (research/make/reflect) are engagement — the chrome
   * cannot withdraw mid-work. READ and MARK leave the attention model
   * exactly as it was: mark's engagement is the selection in hand. */
  setDeskMode: (mode) => {
    const d = get().desk;
    if (!d || d.mode === mode) return;
    set({ desk: { ...d, mode } });
    if (mode === 'research' || mode === 'make' || mode === 'reflect') {
      set({ engaged: true });
    }
  },

  setWorkbenchDoc: (docId) => {
    const d = get().desk;
    if (!d || d.workbenchDocId === docId) return;
    set({ desk: { ...d, workbenchDocId: docId } });
  },

  clearDeskPending: () => {
    const d = get().desk;
    if (d && (d.pendingLocator !== null || d.pendingFocusId !== null)) {
      set({ desk: { ...d, pendingLocator: null, pendingFocusId: null } });
    }
  },

  setPaletteOpen: (open) => set({ paletteOpen: open }),

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
 *   full    the room is present — shelf, archive
 *   quiet   the desk at rest — furniture dims, structure stays
 *   absent  the text owns the eyes — the room withdraws
 */
export type ShellVisibility = 'full' | 'quiet' | 'absent';

export function shellVisibility(place: Place, attention: Attention): ShellVisibility {
  if (place === 'desk') return attention === 'reading' ? 'absent' : 'quiet';
  return 'full';
}
