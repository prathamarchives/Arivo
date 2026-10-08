/**
 * Actions — Button, IconButton, Toggle. one physical family: same press
 * receipt (scale 0.985, micro), same hover (state settle), same focus
 * (the ink ring), same disabled (45%, still readable), same async law
 * (press dies, hover acknowledges, focus survives).
 *
 * the `state` prop is the semantic door (L5): the component knows it is
 * loading; the css + aria decide what that means. native attrs carry
 * device truth.
 */
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { ariaForState, isAsync, type UiState } from '../state/index.ts';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'solid' | 'ghost';
  size?: 'md' | 'lg';
  /** semantic data-state: loading / error / needs-attention / saved … */
  state?: UiState;
  /** the spinner for async states — transform only, linear (D-018) */
  busyIcon?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  state,
  busyIcon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps): ReactNode {
  const async = isAsync(state ?? 'rest');
  const classes = [
    'btn',
    variant === 'solid' ? 'btn-solid' : variant === 'ghost' ? 'btn-ghost' : '',
    size === 'lg' ? 'btn-lg' : '',
    state ? `is-${state}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      className={classes}
      disabled={disabled}
      data-state={state}
      {...(state ? ariaForState(state) : {})}
      {...rest}
    >
      {async ? (busyIcon ?? <span className="spinner" aria-hidden="true" />) : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** required — an icon button without a name is a bug, not a shortcut */
  label: string;
  state?: UiState;
  children: ReactNode;
}

export function IconButton({ label, state, className = '', children, disabled, ...rest }: IconButtonProps): ReactNode {
  const classes = ['icon-btn', state ? `is-${state}` : '', className].filter(Boolean).join(' ');
  return (
    <button
      aria-label={label}
      title={label}
      className={classes}
      disabled={disabled}
      data-state={state}
      {...(state ? ariaForState(state) : {})}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface ToggleProps {
  /** semantic identity — the switch's job, named */
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean, e: { source: 'pointer' | 'keyboard' }) => void;
  disabled?: boolean;
  /** visual rhythm variant */
  compact?: boolean;
  id?: string;
}

/**
 * Toggle — a switch. the thumb travels at micro mass (120ms settle): a
 * receipt, not a journey. the MODE PILL travel (segmented control) is
 * spatial physics — that lands with the shell, not here.
 */
export function Toggle({ label, checked, onCheckedChange, disabled, compact, id }: ToggleProps): ReactNode {
  const handleKey = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCheckedChange(!checked, { source: 'keyboard' });
    }
  };
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'is-on' : ''} ${compact ? 'toggle-compact' : ''} ${disabled ? 'is-disabled' : ''}`.trim()}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked, { source: 'pointer' })}
      onKeyDown={handleKey}
      data-state={disabled ? 'disabled' : checked ? 'selected' : 'rest'}
    >
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </button>
  );
}
