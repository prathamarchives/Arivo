/**
 * Feedback — Badge, Progress, Status. the quiet announcers.
 *
 * Badge: counts and tags — mono, uppercase, ink-2 on sunken ground.
 * Progress: the hairline bar — scaleX transform only (never width: the
 * layout-animation law), indeterminate state travels at component mass.
 * Status: truth states (saving/saved/error/needs-attention…) with the
 * accent family (D-004) and a live region — the phrase comes from the
 * state runtime so voice and state cannot drift.
 */
import type { ReactNode } from 'react';
import { ariaForState, liveForState, phraseForState, type UiState } from '../state/index.ts';

export function Badge({
  count,
  max = 99,
  className = '',
}: {
  count: number;
  max?: number;
  className?: string;
}): ReactNode {
  const shown = count > max ? `${max}+` : `${count}`;
  return (
    <span className={`badge ${className}`.trim()} aria-label={`${count} unread`}>
      {shown}
    </span>
  );
}

export interface ProgressProps {
  /** 0..1 — clamped; the bar is a transform, not a layout change */
  value: number;
  /** indeterminate: the slow traveler — honest work, no lie about % */
  indeterminate?: boolean;
  label: string;
  className?: string;
}

export function Progress({ value, indeterminate, label, className = '' }: ProgressProps): ReactNode {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      className={`progress ${indeterminate ? 'is-indeterminate' : ''} ${className}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped * 100)}
    >
      <span
        className="progress-fill"
        style={indeterminate ? undefined : { transform: `scaleX(${clamped})` }}
      />
    </div>
  );
}

export function Status({
  state,
  className = '',
}: {
  state: UiState;
  className?: string;
}): ReactNode {
  const live = liveForState(state);
  return (
    <span
      className={`status status-${state} ${className}`.trim()}
      role={live ? 'status' : undefined}
      aria-live={live ?? undefined}
      {...ariaForState(state)}
    >
      <span className="status-dot" aria-hidden="true" />
      {phraseForState(state) || state}
    </span>
  );
}
