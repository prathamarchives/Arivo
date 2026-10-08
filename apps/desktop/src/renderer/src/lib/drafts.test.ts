/**
 * the persistence contract (L10), as executable law.
 *
 * every clause of "user text must never disappear" is proven here:
 * keystroke-level mirroring, confirmed saves retiring the mirror,
 * failures keeping text, restart-mid-save resurrecting as recovered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DraftEngine, memoryDraftStorage, draftStatusText, type DraftTarget } from './drafts.ts';

describe('the desk persistence contract (L10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const engine = (opts: {
    target: DraftTarget;
    mirror?: Map<string, string>;
    debounce?: number;
  }): { e: DraftEngine; storage: ReturnType<typeof memoryDraftStorage> } => {
    const storage = memoryDraftStorage();
    const e = new DraftEngine('test-draft', opts.target, storage, opts.debounce ?? 800);
    return { e, storage };
  };

  it('a keystroke is mirrored synchronously — before any save runs', () => {
    let saved = '';
    const { e } = engine({ target: { save: async (t) => void (saved = t) } });
    e.boot(null);
    e.edit('a single character');
    // no timer has fired — the store never saw this — but the mirror has it
    expect(e.status).toBe('draft');
    expect(saved).toBe('');
    expect(e.text).toBe('a single character');
  });

  it('debounce lands the save; confirmation retires the mirror', async () => {
    const saved: string[] = [];
    const { e, storage } = engine({ target: { save: async (t) => void saved.push(t) } });
    e.boot(null);
    e.edit('the thought');
    await vi.advanceTimersByTimeAsync(900);
    expect(saved).toEqual(['the thought']);
    expect(e.status).toBe('saved');
    expect(storage.read('test-draft')).toBeNull();
  });

  it('an empty never-saved draft creates nothing', async () => {
    const saved: string[] = [];
    const { e } = engine({ target: { save: async (t) => void saved.push(t) } });
    e.boot(null);
    e.edit('');
    await vi.advanceTimersByTimeAsync(900);
    expect(saved).toEqual([]);
    expect(e.status).toBe('draft');
  });

  it('edits after a save become modified, then saved again', async () => {
    const saved: string[] = [];
    const { e } = engine({ target: { save: async (t) => void saved.push(t) } });
    e.boot(null);
    e.edit('first');
    await vi.advanceTimersByTimeAsync(900);
    e.edit('first, then second');
    expect(e.status).toBe('modified');
    await vi.advanceTimersByTimeAsync(900);
    expect(saved).toEqual(['first', 'first, then second']);
    expect(e.status).toBe('saved');
  });

  it('a failed save keeps every character and offers retry', async () => {
    let fail = true;
    const saved: string[] = [];
    const { e, storage } = engine({
      target: {
        save: async (t) => {
          if (fail) throw new Error('ipc dead');
          saved.push(t);
        },
      },
    });
    e.boot(null);
    e.edit('text that must survive');
    await vi.advanceTimersByTimeAsync(900);
    expect(e.status).toBe('error');
    expect(e.text).toBe('text that must survive');
    expect(storage.read('test-draft')).toBe('text that must survive');
    fail = false;
    await e.retry();
    expect(saved).toEqual(['text that must survive']);
    expect(e.status).toBe('saved');
  });

  it('restart mid-save: the mirror wins, the state is recovered', async () => {
    // simulate: keystrokes mirrored, save never confirmed, process died
    const storage = memoryDraftStorage();
    const e1 = new DraftEngine('k', { save: () => new Promise<void>(() => {}) }, storage);
    e1.boot(null);
    e1.edit('half-saved words');
    // the debounced save is in flight (never resolves) — engine dies here

    // a fresh boot (new engine, same storage) against a store without the text
    const e2 = new DraftEngine('k', { save: async () => {} }, storage);
    e2.boot('');
    expect(e2.status).toBe('recovered');
    expect(e2.text).toBe('half-saved words');
  });

  it('boot against a matching store stays saved — no false recovery', async () => {
    const storage = memoryDraftStorage();
    const e1 = new DraftEngine('k', { save: async () => {} }, storage);
    e1.boot(null);
    e1.edit('confirmed words');
    await vi.advanceTimersByTimeAsync(900);
    expect(e1.status).toBe('saved');
    expect(storage.read('k')).toBeNull(); // retired

    const e2 = new DraftEngine('k', { save: async () => {} }, storage);
    e2.boot('confirmed words');
    expect(e2.status).toBe('saved');
    expect(e2.text).toBe('confirmed words');
  });

  it('typing during an in-flight save is never falsely marked saved', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => void (release = r));
    const saved: string[] = [];
    const { e, storage } = engine({
      target: {
        save: async (t) => {
          await gate;
          saved.push(t);
        },
      },
    });
    e.boot(null);
    e.edit('first');
    await vi.advanceTimersByTimeAsync(900); // in flight
    expect(e.status).toBe('saving');
    e.edit('first plus more'); // typed during the flight
    release();
    await vi.runAllTimersAsync();
    // the flight confirmed only the snapshot; the newer text still saves
    expect(saved).toContain('first');
    expect(saved[saved.length - 1]).toBe('first plus more');
    expect(e.status).toBe('saved');
    expect(e.text).toBe('first plus more');
    expect(storage.read('test-draft')).toBeNull();
  });

  it('dispose promotes a pending save immediately — unmount never costs text', async () => {
    const saved: string[] = [];
    const { e, storage } = engine({ target: { save: async (t) => void saved.push(t) } });
    e.boot(null);
    e.edit('leaving mid-thought');
    await e.dispose();
    expect(saved).toEqual(['leaving mid-thought']);
    expect(storage.read('test-draft')).toBeNull();
    expect(e.status).toBe('saved');
  });

  it('dispose keeps an unconfirmable mirror when the store is down', async () => {
    const { e, storage } = engine({
      target: { save: async () => { throw new Error('store down'); } },
    });
    e.boot(null);
    e.edit('text under a dead store');
    await e.dispose();
    expect(e.status).toBe('error');
    expect(storage.read('test-draft')).toBe('text under a dead store');
  });

  it('the status vocabulary never lies about where text lives', () => {
    expect(draftStatusText('draft')).toContain('device');
    expect(draftStatusText('error')).toContain('kept');
    expect(draftStatusText('recovered')).toContain('recovered');
    expect(draftStatusText('saving')).toContain('saving');
    expect(draftStatusText('saved')).toBe('saved');
  });
});
