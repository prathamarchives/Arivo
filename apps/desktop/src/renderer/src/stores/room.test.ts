/**
 * the room's contract (L8): place, spatial memory, attention.
 * the shell's behavioral laws are testable without a dom — the store is
 * the room's truth, and the room must never lie about where you are or
 * what you were doing.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useRoom, shellVisibility } from './room.ts';

describe('the room model (L8)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useRoom.setState({
      place: 'shelf',
      desk: null,
      attention: 'active',
      engaged: false,
      shelfScroll: 0,
      archiveScroll: 0,
      paletteOpen: false,
      toasts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('boots into the shelf — the room starts owned, not routed', () => {
    expect(useRoom.getState().place).toBe('shelf');
  });

  it('the three places are camera positions over one room', () => {
    useRoom.getState().goDesk('b1');
    expect(useRoom.getState().place).toBe('desk');
    useRoom.getState().goArchive();
    expect(useRoom.getState().place).toBe('archive');
    useRoom.getState().goShelf();
    expect(useRoom.getState().place).toBe('shelf');
  });

  it('spatial memory: the desk survives navigation (golden 6)', () => {
    useRoom.getState().goDesk('b1');
    useRoom.getState().goShelf();
    const desk = useRoom.getState().desk;
    expect(desk).not.toBeNull();
    expect(desk?.bookId).toBe('b1');
    useRoom.getState().returnToDesk();
    expect(useRoom.getState().place).toBe('desk');
    expect(useRoom.getState().desk?.bookId).toBe('b1');
  });

  it('returnToDesk with no desk falls to the shelf, never a hole', () => {
    useRoom.getState().returnToDesk();
    expect(useRoom.getState().place).toBe('shelf');
  });

  it('an exact source return is one-shot: consumed, then progress is truth', () => {
    useRoom.getState().goDesk('b1', 'epubcfi(/6/4!/4/10/2)', 'hl-1');
    expect(useRoom.getState().desk?.pendingLocator).toBe('epubcfi(/6/4!/4/10/2)');
    expect(useRoom.getState().desk?.pendingFocusId).toBe('hl-1');
    useRoom.getState().clearDeskPending();
    expect(useRoom.getState().desk?.pendingLocator).toBeNull();
    expect(useRoom.getState().desk?.pendingFocusId).toBeNull();
    /* the desk itself survives the consumption — the book stays open */
    expect(useRoom.getState().desk?.bookId).toBe('b1');
  });

  it('a fresh open carries no locator — the truth file speaks', () => {
    useRoom.getState().goDesk('b2');
    expect(useRoom.getState().desk?.pendingLocator).toBeNull();
  });

  it('visibility follows attention: full on shelf, quiet at desk, absent when reading', () => {
    expect(shellVisibility('shelf', 'active')).toBe('full');
    expect(shellVisibility('archive', 'active')).toBe('full');
    expect(shellVisibility('desk', 'active')).toBe('quiet');
    expect(shellVisibility('desk', 'reading')).toBe('absent');
  });

  it('attention idles to reading only at an unencumbered desk', () => {
    useRoom.getState().goDesk('b1');
    useRoom.getState().poke();
    expect(useRoom.getState().attention).toBe('active');
    vi.advanceTimersByTime(3000);
    expect(useRoom.getState().attention).toBe('reading');

    /* engagement holds the room present — selection, drawers */
    useRoom.getState().setEngaged(true);
    useRoom.getState().poke();
    vi.advanceTimersByTime(3000);
    expect(useRoom.getState().attention).toBe('active');

    useRoom.getState().setEngaged(false);
    useRoom.getState().poke();
    vi.advanceTimersByTime(3000);
    expect(useRoom.getState().attention).toBe('reading');
  });

  it('arriving at the desk withdraws the chrome with no pointer at all', () => {
    /* you came to read, not to watch chrome — the clock starts on arrival */
    useRoom.getState().goDesk('b1');
    expect(useRoom.getState().attention).toBe('active');
    vi.advanceTimersByTime(3000);
    expect(useRoom.getState().attention).toBe('reading');
    /* engagement that arrives before the clock fires holds the room */
    useRoom.getState().goDesk('b1');
    useRoom.getState().setEngaged(true);
    vi.advanceTimersByTime(3000);
    expect(useRoom.getState().attention).toBe('active');
  });

  it('the idle budget never quiets the shelf or the archive', () => {
    useRoom.getState().poke();
    vi.advanceTimersByTime(3000);
    expect(useRoom.getState().attention).toBe('active');
    useRoom.getState().goArchive();
    vi.advanceTimersByTime(3000);
    expect(useRoom.getState().attention).toBe('active');
  });

  it('per-place scroll memory records and restores', () => {
    useRoom.getState().setShelfScroll(420);
    expect(useRoom.getState().shelfScroll).toBe(420);
    useRoom.getState().setArchiveScroll(80);
    expect(useRoom.getState().archiveScroll).toBe(80);
    /* independent rooms, independent memory */
    expect(useRoom.getState().shelfScroll).not.toBe(useRoom.getState().archiveScroll);
  });
});

describe('the notes panel (v0.3.1 — the modes became one panel)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useRoom.setState({
      place: 'shelf',
      desk: null,
      attention: 'active',
      engaged: false,
      shelfScroll: 0,
      archiveScroll: 0,
      paletteOpen: false,
      toasts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a fresh desk opens with the panel closed — the reading is primary', () => {
    useRoom.getState().goDesk('b1');
    expect(useRoom.getState().desk?.notesOpen).toBe(false);
    expect(useRoom.getState().desk?.notesTab).toBe('marks');
    expect(useRoom.getState().desk?.workbenchDocId).toBeNull();
  });

  it('the panel preserves spatial memory: a shelf roundtrip returns to the same tab + document', () => {
    useRoom.getState().goDesk('b1');
    useRoom.getState().openNotes('notebook');
    useRoom.getState().setWorkbenchDoc('doc-9');
    /* the shelf roundtrip — the desk keeps its context (law 32) */
    useRoom.getState().goShelf();
    useRoom.getState().returnToDesk();
    expect(useRoom.getState().desk?.notesOpen).toBe(true);
    expect(useRoom.getState().desk?.notesTab).toBe('notebook');
    expect(useRoom.getState().desk?.workbenchDocId).toBe('doc-9');
    expect(useRoom.getState().desk?.bookId).toBe('b1');
  });

  it('tab switching never recreates the desk context — same object identity for book + pendings', () => {
    useRoom.getState().goDesk('b1', 'cfi-loc', 'hl-1');
    const before = useRoom.getState().desk!;
    useRoom.getState().openNotes();
    useRoom.getState().setNotesTab('notebook');
    const after = useRoom.getState().desk!;
    expect(after.bookId).toBe(before.bookId);
    expect(after.pendingLocator).toBe(before.pendingLocator);
    expect(after.pendingFocusId).toBe(before.pendingFocusId);
  });

  it('an open panel is engagement — the chrome cannot withdraw mid-work', () => {
    useRoom.getState().goDesk('b1');
    useRoom.getState().openNotes('notebook');
    expect(useRoom.getState().engaged).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(useRoom.getState().attention).toBe('active');
  });

  it('closing the panel releases the room — the idle law owns chrome again', () => {
    useRoom.getState().goDesk('b1');
    useRoom.getState().openNotes();
    useRoom.getState().closeNotes();
    useRoom.getState().setEngaged(false);
    vi.advanceTimersByTime(3000);
    expect(useRoom.getState().attention).toBe('reading'); // withdrawn, as the law demands
  });

  it('panel actions with no desk are inert', () => {
    useRoom.getState().openNotes('notebook');
    expect(useRoom.getState().desk).toBeNull();
    expect(useRoom.getState().place).toBe('shelf');
  });
});

