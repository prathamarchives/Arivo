import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

export { READ_CSS, readThemeVars, hlClass } from './reader-themes.ts';

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'solid' | 'ghost';
  size?: 'md' | 'lg';
}): ReactNode {
  const v = variant === 'solid' ? ' btn-solid' : variant === 'ghost' ? ' btn-ghost' : '';
  const s = size === 'lg' ? ' btn-lg' : '';
  return (
    <button className={`btn${v}${s} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): ReactNode {
  return (
    <button aria-label={label} title={label} className={`icon-btn ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Input({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return <input className={`input ${className}`} {...rest} />;
}

export function Kbd({ children }: { children: ReactNode }): ReactNode {
  return <span className="kbd">{children}</span>;
}
