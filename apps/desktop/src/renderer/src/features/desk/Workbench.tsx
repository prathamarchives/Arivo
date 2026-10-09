/**
 * the workbench (L10) — the desk's contextual work surface.
 *
 * the book stays the primary object; this drawer is the paper beside
 * it. three kinds, one engine: research (quotes collected from the
 * source + the questions they raise), make (artifacts composed from
 * the source's material), reflect (synthesis, disagreement, the
 * journal side).
 *
 * THE PERSISTENCE CONTRACT lives here: every keystroke lands in a
 * local mirror synchronously (drafts.ts); the store confirms and the
 * mirror retires. a death mid-write resurrects as `recovered` — the
 * mirror wins because the store never saw it.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { DeskDoc, DeskDocKind, SourceRef } from '@arivo/core';
import { uuidv7 } from '@arivo/core';
import type { BookWithProgress } from '@arivo/core';
import { api } from '../../services/api.ts';
import { DraftEngine, localStorageDraftStorage, draftStatusText, type DraftState } from '../../lib/drafts.ts';
import { Button, IconButton } from '@arivo/ui';
import { IconX, IconPlus, IconNote, IconTrash, IconChevronRight, IconSearch, IconPencil, IconBack } from '../../components/icons.tsx';

/** what the reader can ask the workbench to do */
export interface WorkbenchHandle {
  /** a quote collected from a selection — lands in the open research doc, or starts one */
  collect: (ref: SourceRef) => void;
}

/** the panel's view kinds: 'all' is the v0.3.1 notebook — every paper
 *  this book produced, the mode ceremony gone */
export type WorkbenchKind = DeskDocKind | 'all';

const KIND_META: Record<WorkbenchKind, { label: string; hint: string; refLabel: string; icon: ReactNode; fresh: DeskDocKind }> = {
  all: {
    label: 'notebook',
    hint: 'collected quotes and the papers you wrote',
    refLabel: 'collected quotes',
    icon: <IconNote />,
    fresh: 'research',
  },
  research: {
    label: 'research',
    hint: 'quotes from this source, citations, questions',
    refLabel: 'collected quotes',
    icon: <IconSearch />,
    fresh: 'research',
  },
  make: {
    label: 'make',
    hint: 'compose something from this source',
    refLabel: 'material',
    icon: <IconPencil />,
    fresh: 'make',
  },
  reflect: {
    label: 'reflect',
    hint: 'synthesis, disagreement, what changed',
    refLabel: 'passages',
    icon: <IconNote />,
    fresh: 'reflect',
  },
};

/** the more severe of two draft states — one honest status line */
function worstOf(a: DraftState, b: DraftState): DraftState {
  const rank: Record<DraftState, number> = {
    error: 5,
    recovered: 4,
    saving: 3,
    modified: 2,
    draft: 1,
    saved: 0,
  };
  return rank[a] >= rank[b] ? a : b;
}

interface WorkbenchProps {
  book: BookWithProgress;
  kind: WorkbenchKind;
  /** the open document (spatial memory — rides the desk context) */
  openDocId: string | null;
  onOpenDoc: (id: string | null) => void;
  /** jump back to a passage's exact place */
  onJump: (locator: string) => void;
  onClose: () => void;
  toast: (text: string) => void;
  /** a quote collected while the workbench was closed — consumed on mount */
  pendingCollect: SourceRef | null;
  onPendingConsumed: () => void;
  /** the notes panel's header (tabs) — replaces the default label row */
  header?: ReactNode;
}

export const Workbench = forwardRef<WorkbenchHandle, WorkbenchProps>(function Workbench(
  { book, kind, openDocId, onOpenDoc, onJump, onClose, toast, pendingCollect, onPendingConsumed, header },
  ref,
) {
  const [docs, setDocs] = useState<DeskDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openDoc, setOpenDoc] = useState<DeskDoc | null>(null);

  /* ---------- load the book's docs once ---------- */
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const list = await api.desk.listDocs(book.id);
        if (!disposed) {
          setDocs(list);
          setLoaded(true);
        }
      } catch {
        if (!disposed) setLoaded(true); // the list fails; the mirror law still holds
      }
    })();
    return () => {
      disposed = true;
    };
  }, [book.id]);

  /* ---------- the open doc follows the room's memory ---------- */
  useEffect(() => {
    if (openDocId === null) {
      setOpenDoc(null);
      return;
    }
    const found = docs.find((d) => d.id === openDocId);
    if (found) setOpenDoc(found);
    // not found + not loaded yet: wait for the load to land
  }, [openDocId, docs]);

  /* ---------- persistence: the serialized single writer ---------- */
  const docRef = useRef<DeskDoc | null>(openDoc);
  docRef.current = openDoc;
  /* the store's known ids — kept in sync with every load/persist, never a
   * stale first-render snapshot (the duplicate-doc bug: a loaded doc that
   * looked unknown got CREATED twice) */
  const existsInStore = useRef<Set<string>>(new Set());
  /* ids THIS session created — synchronous, so two rapid persists can never
   * both choose the create path before react re-renders (the desktop store
   * would rightly refuse the second create; the engine would error forever) */
  const createdHere = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const d of docs) existsInStore.current.add(d.id);
  }, [docs]);
  const persistQueue = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback(
    (patch: { title?: string; body?: string; sourceRefs?: SourceRef[] }) => {
      const run = persistQueue.current.then(async () => {
        const current = docRef.current;
        if (!current) return;
        const next: DeskDoc = { ...current, ...patch, updatedAt: Date.now() };
        docRef.current = next;
        try {
          if (existsInStore.current.has(next.id) || createdHere.current.has(next.id)) {
            await api.desk.updateDoc(book.id, next);
          } else {
            await api.desk.createDoc(book.id, next);
            createdHere.current.add(next.id);
            existsInStore.current.add(next.id);
          }
          setDocs((prev) => {
            const i = prev.findIndex((d) => d.id === next.id);
            return i === -1 ? [next, ...prev] : prev.map((d) => (d.id === next.id ? next : d));
          });
        } catch {
          throw new Error('the store did not take the write');
        }
      });
      persistQueue.current = run.catch(() => {});
      return run;
    },
    [book.id],
  );

  /* ---------- the two engines: title + body ---------- */
  const engines = useRef<{ title: DraftEngine; body: DraftEngine; docId: string } | null>(null);
  const [titleState, setTitleState] = useState<DraftState>('draft');
  const [bodyState, setBodyState] = useState<DraftState>('draft');
  /* the engines OWN the text — the editor renders what they say, so a
   * recovered mirror reaches the display, not just the state machine */
  const [titleText, setTitleText] = useState('');
  const [bodyText, setBodyText] = useState('');

  useEffect(() => {
    if (!openDoc) {
      engines.current = null;
      setTitleState('draft');
      setBodyState('draft');
      setTitleText('');
      setBodyText('');
      return;
    }
    const base = `arivo.draft.deskdoc.${book.id}.${openDoc.id}`;
    const titleEngine = new DraftEngine(
      `${base}.title`,
      { save: (t) => persist({ title: t }) },
      localStorageDraftStorage(),
    );
    const bodyEngine = new DraftEngine(
      `${base}.body`,
      { save: (t) => persist({ body: t }) },
      localStorageDraftStorage(),
    );
    engines.current = { title: titleEngine, body: bodyEngine, docId: openDoc.id };
    const unt = titleEngine.subscribe(() => {
      setTitleState(titleEngine.status);
      setTitleText(titleEngine.text);
    });
    const unb = bodyEngine.subscribe(() => {
      setBodyState(bodyEngine.status);
      setBodyText(bodyEngine.text);
    });
    const inStore = existsInStore.current.has(openDoc.id);
    // start from the store's copy, then boot — a recovered mirror wins
    setTitleText(openDoc.title);
    setBodyText(openDoc.body);
    titleEngine.boot(inStore ? openDoc.title : null);
    bodyEngine.boot(inStore ? openDoc.body : null);

    return () => {
      unt();
      unb();
      // unmounting a surface never costs text: settle pending writes,
      // keep unconfirmable mirrors
      void titleEngine.dispose();
      void bodyEngine.dispose();
    };
  }, [openDoc, book.id, persist]);

  /* ---------- quote collection (the reader's MARK→RESEARCH bridge) ---------- */
  const collectInternal = useCallback(
    (quote: SourceRef) => {
      const target = docRef.current;
      if (target && target.kind === 'research') {
        void persist({ sourceRefs: [...target.sourceRefs, quote] })
          .then(() => toast('quote collected'))
          .catch(() => toast('collection kept — not saved yet'));
        return;
      }
      // no research doc open: start one holding the quote
      const fresh: DeskDoc = {
        id: uuidv7(),
        bookId: book.id,
        kind: 'research',
        title: quote.chapter ? `quotes — ${quote.chapter}` : 'collected quotes',
        body: '',
        sourceRefs: [quote],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setOpenDoc(fresh);
      docRef.current = fresh;
      setDocs((prev) => [fresh, ...prev]);
      onOpenDoc(fresh.id);
      void persist({ sourceRefs: [quote] })
        .then(() => toast('quote collected — research started'))
        .catch(() => toast('quote kept — not saved yet'));
    },
    [book.id, persist, toast, onOpenDoc],
  );

  useImperativeHandle(ref, () => ({ collect: collectInternal }), [collectInternal]);

  /* consume a quote stashed while the workbench was closed */
  const consumedRef = useRef(false);
  useEffect(() => {
    if (pendingCollect && loaded && !consumedRef.current) {
      consumedRef.current = true;
      collectInternal(pendingCollect);
      onPendingConsumed();
    }
  }, [pendingCollect, loaded, collectInternal, onPendingConsumed]);

  const meta = KIND_META[kind];

  /* ---------- kind switching closes foreign docs (the notebook keeps all) ---------- */
  useEffect(() => {
    if (kind !== 'all' && openDoc && openDoc.kind !== kind) onOpenDoc(null);
  }, [kind, openDoc, onOpenDoc]);

  /* ---------- new document ---------- */
  const startNew = useCallback(() => {
    const fresh: DeskDoc = {
      id: uuidv7(),
      bookId: book.id,
      kind: meta.fresh,
      title: '',
      body: '',
      sourceRefs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setOpenDoc(fresh);
    docRef.current = fresh;
    onOpenDoc(fresh.id);
  }, [book.id, kind, onOpenDoc]);

  const deleteDoc = useCallback(
    async (id: string) => {
      try {
        await api.desk.deleteDoc(book.id, id);
      } catch {
        toast('the document stayed — try again');
        return;
      }
      existsInStore.current.delete(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      if (openDocId === id) onOpenDoc(null);
      toast('document removed');
    },
    [book.id, openDocId, onOpenDoc, toast],
  );

  const kindDocs = kind === 'all' ? docs : docs.filter((d) => d.kind === kind);

  return (
    <aside className="drawer drawer-right drawer-wide rise" aria-label={`${meta.label} workbench`}>
      <header className="drawer-head">
        {header ?? (
          <span className="meta-label">
            {meta.icon} {meta.label} · {kindDocs.length} {kindDocs.length === 1 ? 'document' : 'documents'}
          </span>
        )}
        {header ? null : (
          <IconButton label={`close ${meta.label}`} onClick={onClose}>
            <IconX />
          </IconButton>
        )}
      </header>
      <div className="drawer-body">
        {openDoc ? (
          <DocEditor
            doc={openDoc}
            meta={meta}
            title={titleText}
            body={bodyText}
            titleState={titleState}
            bodyState={bodyState}
            onTitle={(t) => engines.current?.title.edit(t)}
            onBody={(t) => engines.current?.body.edit(t)}
            onRetry={() => {
              void engines.current?.title.retry();
              void engines.current?.body.retry();
            }}
            onJump={onJump}
            onDelete={() => void deleteDoc(openDoc.id)}
            onBack={() => onOpenDoc(null)}
          />
        ) : (
          <>
            <button className="chip chip-add note-new" onClick={startNew}>
              <IconPlus />
              new {meta.label} {kind === 'reflect' ? 'entry' : kind === 'research' ? 'collection' : 'artifact'}
            </button>
            {!loaded && <div className="meta-label drawer-empty-note">opening the workbench…</div>}
            {loaded && kindDocs.length === 0 && (
              <div className="drawer-empty">
                <div className="type-title">nothing here yet</div>
                <p className="meta-label">{meta.hint}</p>
                <p className="meta-label">
                  {kind === 'research'
                    ? 'select a passage while reading and collect it — it lands here with its place kept'
                    : kind === 'make'
                      ? 'start an artifact, then attach passages as material'
                      : 'write what this book made you think'}
                </p>
              </div>
            )}
            {kindDocs.map((d) => (
              <button
                key={d.id}
                className="note-card note-card-click"
                onClick={() => onOpenDoc(d.id)}
              >
                <div className="note-card-head">
                  <span className="meta-label note-chapter">
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="type-title doc-title">{d.title || d.body.slice(0, 60) || 'untitled'}</div>
                {d.body && <p className="note-text doc-snippet">{d.body.slice(0, 120)}</p>}
                {d.sourceRefs.length > 0 && (
                  <span className="meta-label doc-refcount">
                    {d.sourceRefs.length} {d.sourceRefs.length === 1 ? 'passage' : 'passages'}
                  </span>
                )}
              </button>
            ))}
          </>
        )}
      </div>
    </aside>
  );
});

/* ---------------- the editor ---------------- */

function DocEditor({
  doc,
  meta,
  title,
  body,
  titleState,
  bodyState,
  onTitle,
  onBody,
  onRetry,
  onJump,
  onDelete,
  onBack,
}: {
  doc: DeskDoc;
  meta: (typeof KIND_META)[DeskDocKind];
  title: string;
  body: string;
  titleState: DraftState;
  bodyState: DraftState;
  onTitle: (t: string) => void;
  onBody: (t: string) => void;
  onRetry: () => void;
  onJump: (locator: string) => void;
  onDelete: () => void;
  onBack: () => void;
}): ReactNode {
  const status = worstOf(titleState, bodyState);

  return (
    <div className="doc-editor">
      <div className="doc-editor-head">
        <button className="sel-action" onClick={onBack}>
          <IconBack />
          {meta.label}s
        </button>
        <IconButton label="remove this document" onClick={onDelete}>
          <IconTrash />
        </IconButton>
      </div>
      <input
        className="doc-title-input"
        value={title}
        placeholder={doc.kind === 'reflect' ? 'an entry needs no title' : 'title'}
        aria-label="document title"
        onChange={(e) => {
          onTitle(e.target.value);
        }}
      />
      <textarea
        className="note-input doc-body-input"
        value={body}
        placeholder={
          doc.kind === 'research'
            ? 'what does this source say? gather, question, connect…'
            : doc.kind === 'make'
              ? 'compose it — the material is below'
              : 'what did this book make you think? where do you disagree?'
        }
        aria-label="document body"
        rows={10}
        onChange={(e) => {
          onBody(e.target.value);
        }}
      />
      <div className="doc-status" data-status={status}>
        <span className="meta-label">{draftStatusText(status)}</span>
        {status === 'error' && (
          <Button variant="solid" onClick={onRetry}>
            retry saving
          </Button>
        )}
        {status === 'recovered' && (
          <span className="meta-label">· the store never saw this text — it saves with your next edit</span>
        )}
      </div>
      {doc.sourceRefs.length > 0 && (
        <div className="doc-refs">
          <div className="meta-label">{meta.refLabel}</div>
          {doc.sourceRefs.map((r, i) => (
            <div key={`${r.locator}-${i}`} className="note-card note-ref">
              <blockquote className="note-text">{r.quote}</blockquote>
              <div className="note-ref-foot">
                <span className="meta-label">{r.chapter ?? 'passage'}</span>
                <button
                  className="sel-action"
                  onClick={() => onJump(r.locator)}
                  aria-label="return to this passage"
                >
                  <IconChevronRight />
                  source
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
