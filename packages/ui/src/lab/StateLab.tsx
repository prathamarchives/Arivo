/**
 * the state runtime lab — W4's evidence, rendered.
 *
 * section 15 — the state laboratory:
 *   - the precedence playground: toggle any combination of states and
 *     watch resolveState decide which one owns the surface, what it
 *     suppresses, and what assistive tech hears
 *   - the matrix strip: the canonical nine on a real button + input,
 *     all simultaneously — a missing state is a visible hole, not a
 *     footnote (law 39)
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ALL_STATES,
  resolveState,
  suppresses,
  behaviorFor,
  ariaForState,
  liveForState,
  phraseForState,
  isAsync,
  type UiState,
} from '../state/index.ts';

function StateToggle({
  state,
  on,
  onToggle,
}: {
  state: UiState;
  on: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <button
      className={`btn lab-state-toggle ${on ? 'btn-solid' : ''}`}
      aria-pressed={on}
      onClick={onToggle}
    >
      {state}
    </button>
  );
}

function MatrixButton({ state }: { state: UiState }): ReactNode {
  const isAria = isAsync(state);
  return (
    <div className="lab-state-cell">
      <button
        className="btn lab-state-btn"
        data-state={state}
        disabled={state === 'disabled'}
        aria-busy={isAria || undefined}
        aria-invalid={state === 'error' || undefined}
      >
        {state === 'loading' || state === 'saving' || state === 'processing' || state === 'recovering' ? (
          <span className="lab-state-spinner" aria-hidden="true" />
        ) : null}
        {state}
      </button>
    </div>
  );
}

function MatrixInput({ state }: { state: UiState }): ReactNode {
  return (
    <div className="lab-state-cell">
      <input
        className="input lab-state-input"
        data-state={state}
        disabled={state === 'disabled'}
        placeholder={state === 'empty' ? 'empty — authored, never blank' : `${state}`}
        aria-invalid={state === 'error' || undefined}
      />
    </div>
  );
}

export function StateRuntimeLab(): ReactNode {
  const [active, setActive] = useState<Set<UiState>>(new Set(['selected', 'hover']));

  const resolved = useMemo(
    () => resolveState(Object.fromEntries([...active].map((s) => [s, true])) as never),
    [active],
  );
  const supp = useMemo(() => suppresses(resolved), [resolved]);
  const aria = useMemo(() => ariaForState(resolved, { selected: active.has('selected') }), [resolved, active]);
  const live = liveForState(resolved);

  const toggle = (state: UiState): void => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  return (
    <section className="lab-section">
      <LabHead
        n="15"
        title="state runtime — the interaction contract"
        note="precedence is executable · semantics separate from rendering"
      />

      <div className="lab-state-playground">
        <div className="lab-state-toggles">
          {ALL_STATES.filter((s) => s !== 'rest').map((state) => (
            <StateToggle
              key={state}
              state={state}
              on={active.has(state)}
              onToggle={() => toggle(state)}
            />
          ))}
          <button className="btn btn-ghost" onClick={() => setActive(new Set())}>
            clear
          </button>
        </div>
        <div className="lab-state-verdict surface">
          <span className="meta-label">resolved</span>
          <span className="type-title lab-state-resolved">{resolved}</span>
          <span className="meta-label">
            {phraseForState(resolved) ? `voice: "${phraseForState(resolved)}"` : 'voice: —'}
          </span>
          <div className="lab-state-facts">
            <span className="meta-label">
              suppresses: {supp.hover ? 'hover ' : ''}
              {supp.press ? 'press ' : ''}
              {supp.focus ? 'focus ' : ''}
              {supp.selected ? 'selected' : ''}
              {!supp.hover && !supp.press && !supp.focus && !supp.selected ? 'nothing — all live' : ''}
            </span>
            <span className="meta-label">
              pointer: {behaviorFor(resolved).acceptsPointer ? 'live' : 'dead'} · aria-busy:{' '}
              {aria['aria-busy'] ? 'true' : '—'} · aria-invalid: {aria['aria-invalid'] ? 'true' : '—'} ·
              live: {live ?? '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="lab-state-matrix">
        <span className="meta-label">
          the canonical nine, simultaneously — a missing state is a hole, not a footnote (law 39)
        </span>
        <div className="lab-state-grid">
          {(['rest', 'hover', 'press', 'focus', 'selected', 'disabled', 'loading', 'error', 'empty'] as const).map(
            (state) => <MatrixButton key={state} state={state} />,
          )}
        </div>
        <div className="lab-state-grid">
          {(['rest', 'hover', 'focus', 'selected', 'disabled', 'loading', 'error', 'empty', 'modified'] as const).map(
            (state) => <MatrixInput key={state} state={state} />,
          )}
        </div>
        <span className="meta-label">
          hover/press/focus are forced for display — the runtime derives them from real events
        </span>
      </div>
    </section>
  );
}

function LabHead({ n, title, note }: { n: string; title: string; note?: string }): ReactNode {
  return (
    <div className="lab-h">
      <span className="meta-label">{n}</span>
      <span className="type-title">{title}</span>
      {note ? <span className="meta-label">{note}</span> : null}
    </div>
  );
}
