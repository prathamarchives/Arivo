/**
 * useDraft — the persistence engine's React binding.
 *
 * one hook per writing surface. the engine owns the text; the component
 * renders what the engine says. explicit-save surfaces (composers) pass
 * autoSave: false — keystrokes mirror, the store only sees a save when
 * the user asks for one.
 */
import { useEffect, useRef, useState } from 'react';
import { DraftEngine, localStorageDraftStorage, type DraftState } from './drafts.ts';

export interface UseDraftOptions {
  /** stable per surface — book + doc / passage identity */
  key: string;
  /** the store's current text, if any — null for a fresh surface */
  loadStore: () => Promise<string | null>;
  /** create-or-update; throwing marks the engine's error state */
  save: (text: string) => Promise<void>;
  debounceMs?: number;
  autoSave?: boolean;
}

export interface DraftHandle {
  text: string;
  status: DraftState;
  edit: (t: string) => void;
  /** save now (explicit save / retry) */
  flush: () => Promise<void>;
  /** intentional cancel — the mirror goes, the store stands */
  discard: () => void;
}

export function useDraft(opts: UseDraftOptions): DraftHandle {
  const { key, debounceMs, autoSave = true } = opts;
  const [snap, setSnap] = useState<{ text: string; status: DraftState }>({
    text: '',
    status: 'draft',
  });
  const engineRef = useRef<DraftEngine | null>(null);

  // the save target may change identity every render; the engine must not
  const targetRef = useRef(opts);
  targetRef.current = opts;

  useEffect(() => {
    const engine = new DraftEngine(
      key,
      {
        save: (t) => targetRef.current.save(t),
      },
      localStorageDraftStorage(),
      debounceMs,
      autoSave,
    );
    engineRef.current = engine;
    const unsub = engine.subscribe(() => setSnap({ text: engine.text, status: engine.status }));
    let disposed = false;
    setSnap({ text: engine.text, status: engine.status });
    void targetRef.current
      .loadStore()
      .then((storeText) => {
        if (disposed) return;
        engine.boot(storeText ?? null);
      })
      .catch(() => {
        if (!disposed) engine.boot(null); // store unreadable: the mirror decides
      });
    return () => {
      disposed = true;
      unsub();
      void engine.dispose();
    };
  }, [key, debounceMs, autoSave]);

  return {
    text: snap.text,
    status: snap.status,
    edit: (t) => engineRef.current?.edit(t),
    flush: () => engineRef.current?.flush() ?? Promise.resolve(),
    discard: () => engineRef.current?.discard(),
  };
}
