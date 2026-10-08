/**
 * Inputs — Input, Textarea, Select. the reading of controls: one skin
 * (bg-raised sheet, hairline line, interactive radius), one focus law
 * (border darkens + the ink selection ring), one quiet voice (ink-3
 * placeholder). select keeps the native popup — the OS menu is an
 * instrument we rent; the custom dropdown surface is a Menu composite
 * (L7) and arrives with positioning law.
 */
import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { Icon } from './Icon.tsx';
import { ariaForState, type UiState } from '../state/index.ts';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  state?: UiState;
  /** error/saved text lives outside — the input only carries state */
}

export function Input({ state, className = '', ...rest }: InputProps): ReactNode {
  const classes = ['input', state ? `is-${state}` : '', className].filter(Boolean).join(' ');
  return (
    <input
      className={classes}
      data-state={state}
      {...(state ? ariaForState(state) : {})}
      {...rest}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  state?: UiState;
}

export function Textarea({ state, className = '', ...rest }: TextareaProps): ReactNode {
  const classes = ['textarea', state ? `is-${state}` : '', className].filter(Boolean).join(' ');
  return (
    <textarea
      className={classes}
      data-state={state}
      {...(state ? ariaForState(state) : {})}
      {...rest}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  state?: UiState;
  children: ReactNode;
}

export function Select({ state, className = '', children, ...rest }: SelectProps): ReactNode {
  const classes = ['select', state ? `is-${state}` : '', className].filter(Boolean).join(' ');
  return (
    <div className="select-wrap">
      <select
        className={classes}
        data-state={state}
        {...(state ? ariaForState(state) : {})}
        {...rest}
      >
        {children}
      </select>
      <span className="select-chevron" aria-hidden="true">
        <Icon name="chevronRight" />
      </span>
    </div>
  );
}
