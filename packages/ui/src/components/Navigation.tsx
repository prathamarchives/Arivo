/**
 * Navigation — Tab, NavItem. place memory, not decoration.
 *
 * Tab: the tablist contract (roving tabindex, arrow keys, selected =
 * ink-backed) — the SLIDING PILL between tabs is spatial physics
 * (object continuity, law 32) and lands with the shell; the selected
 * state itself is instant and honest.
 * NavItem: the rail/section item — icon + label, selected = ink
 * emphasis + sunken ground, the left edge marks place.
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon.tsx';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabProps {
  tabs: readonly TabItem[];
  selected: string;
  onSelect: (id: string) => void;
  /** the tablist's accessible name */
  label: string;
  className?: string;
}

export function Tabs({ tabs, selected, onSelect, label, className = '' }: TabProps): ReactNode {
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const idx = tabs.findIndex((t) => t.id === selected);
    if (idx < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      const id = tabs[next]!.id;
      onSelect(id);
      document.getElementById(`tab-${id}`)?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className={`tabs ${className}`.trim()} onKeyDown={handleKey}>
      {tabs.map((t) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          role="tab"
          type="button"
          aria-selected={t.id === selected}
          tabIndex={t.id === selected ? 0 : -1}
          className={`tab ${t.id === selected ? 'is-selected' : ''}`}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export interface NavItemProps {
  icon: IconName;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  /** the nav's id — aria-current is place memory, not just styling */
  id?: string;
  badge?: number;
}

export function NavItem({ icon, label, selected, disabled, onSelect, id, badge }: NavItemProps): ReactNode {
  return (
    <button
      id={id}
      type="button"
      className={`nav-item ${selected ? 'is-selected' : ''}`.trim()}
      aria-current={selected ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onSelect}
      data-state={disabled ? 'disabled' : selected ? 'selected' : 'rest'}
    >
      <Icon name={icon} />
      <span className="nav-item-label">{label}</span>
      {badge !== undefined && badge > 0 ? (
        <span className="badge" aria-label={`${badge} items`}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
}
