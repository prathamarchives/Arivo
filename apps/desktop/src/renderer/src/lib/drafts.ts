/**
 * the desk's persistence engine (L10).
 *
 * THE LAW: user text must never disappear. every keystroke lands in a
 * local mirror synchronously — a crash one keystroke later still finds
 * every character. the store (truth file + index through IPC) is the
 * standing record, written after a debounce; the mirror survives until
 * a save is CONFIRMED, so a death mid-save resurrects as `recovered`.
 *
 * states:
 *   draft      written, never saved — the mirror is the only copy
 *   saving     the store write is in flight
 *   saved      the store confirmed; mirror retired
 *   modified   diverged from the last confirmed save
 *   error      the store write failed — text kept, retry available
 *   recovered  boot found a mirror the store never confirmed — it wins
 */

export type DraftState = 'draft' | 'saving' | 'saved' | 'modified' | 'error' | 'recovered';

/** where the mirror lives — localStorage in the app, a map in tests */
export interface DraftStorage {
  read(key: string): string | null;
  write(key: string, text: string): void;
  remove(key: string): void;
}

export function memoryDraftStorage(): DraftStorage {
  const map = new Map<string, string>();
  return {
    read: (k) => map.get(k) ?? null,
    write: (k, t) => void map.set(k, t),
    remove: (k) => void map.delete(k),
  };
}

export function localStorageDraftStorage(): DraftStorage {
  return {
    read: (k) => {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return null; // private mode / disabled storage — the store still saves
      }
    },
    write: (k, t) => {
      try {
        window.localStorage.setItem(k, t);
      } catch {
        /* quota or disabled — the debounced store save still runs */
      }
    },
    remove: (k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* nothing to retire */
      }
    },
  };
}

/** the durable side: create-or-update is the target's business */
export interface DraftTarget {
  save(text: string): Promise<void>;
}

export class DraftEngine {
  private text_ = '';
  private savedText: string | null = null;
  private state: DraftState = 'draft';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly key: string,
    private readonly target: DraftTarget,
    private readonly storage: DraftStorage = memoryDraftStorage(),
    private readonly debounceMs = 800,
    /**
     * false for explicit-save surfaces (composers): keystrokes mirror,
     * the store only sees a save on flush — never an accidental mark.
     */
    private readonly autoSave = true,
  ) {}

  get text(): string {
    return this.text_;
  }

  get status(): DraftState {
    return this.state;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /**
   * reconcile with the store on open. the mirror wins when the two
   * disagree — it was written after the last confirmed save and the
   * store never saw it.
   */
  boot(storeText: string | null): void {
    const mirror = this.storage.read(this.key);
    if (mirror !== null && mirror !== (storeText ?? '')) {
      this.text_ = mirror;
      this.savedText = storeText;
      this.state = 'recovered';
    } else {
      this.text_ = storeText ?? '';
      this.savedText = storeText;
      this.state = storeText && storeText.length > 0 ? 'saved' : 'draft';
    }
    this.emit();
  }

  edit(text: string): void {
    this.text_ = text;
    // THE LAW — synchronous, before anything else can fail
    this.storage.write(this.key, text);
    this.state = this.savedText === null ? 'draft' : 'modified';
    this.emit();
    if (this.autoSave) this.schedule();
  }

  /** intentional cancel — the user spoke; the mirror goes, the store stands */
  discard(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.storage.remove(this.key);
    this.text_ = this.savedText ?? '';
    this.state = this.savedText !== null ? 'saved' : 'draft';
    this.emit();
  }

  /** save now — unmount, mode switch, explicit retry all call this */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return this.save();
  }

  retry(): Promise<void> {
    return this.flush();
  }

  /**
   * leaving the surface. a pending debounced save is promoted to an
   * immediate one; a mirror that is not confirmed stays — unmounting
   * must never cost text.
   */
  dispose(): Promise<void> {
    if (this.timer && this.text_ !== (this.savedText ?? '') && this.text_.length > 0) {
      if (this.autoSave) return this.flush();
      // an explicit-save surface keeps its mirror on unmount — the text
      // stays recoverable; the store was never promised it
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return this.inFlight ?? Promise.resolve();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save();
    }, this.debounceMs);
  }

  private async save(): Promise<void> {
    const snapshot = this.text_;
    // nothing to create: an empty never-saved draft saves nothing
    if (this.savedText === null && snapshot.length === 0) return;
    // already confirmed identical text — unless the last attempt failed
    if (this.state !== 'error' && snapshot === (this.savedText ?? '')) return;
    this.state = 'saving';
    this.emit();
    const attempt = (async () => {
      try {
        await this.target.save(snapshot);
        this.savedText = snapshot;
        if (this.text_ === snapshot) {
          // still the same text — confirmed; the mirror retires
          this.storage.remove(this.key);
          this.state = 'saved';
        } else {
          // typed during the flight — the newer text schedules its own save
          this.state = 'modified';
          this.schedule();
        }
      } catch {
        // the text survives in the mirror; the user can retry
        this.state = 'error';
      }
      this.emit();
    })();
    this.inFlight = attempt;
    await attempt;
    this.inFlight = null;
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

/** the status line's honest words — one vocabulary, every surface */
export function draftStatusText(state: DraftState): string {
  switch (state) {
    case 'draft':
      return 'kept on this device — not saved yet';
    case 'saving':
      return 'saving…';
    case 'saved':
      return 'saved';
    case 'modified':
      return 'edited — saving shortly';
    case 'error':
      return 'not saved — your text is kept on this device';
    case 'recovered':
      return 'recovered from this device';
  }
}
