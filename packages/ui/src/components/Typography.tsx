/**
 * Typography — the room's voice as components (law 14: composite tokens
 * travel together; law 11/12: helvetica speaks for the room, literata for
 * the author).
 *
 * `<Text role="body">` — the role carries family + size + weight + leading
 * + tracking. arbitrary font-size in product ui is a violation; this is
 * the only sanctioned door.
 */
import type { ReactNode } from 'react';

/** the closed role set — every ui text is one of these */
export type TextRole =
  | 'display' // large statements, empty-room moments
  | 'screenTitle' // screen titles
  | 'title' // panel + section titles (700 — bold is spent deliberately)
  | 'emphasis' // emphasized body
  | 'body' // body ui
  | 'quiet' // quiet chrome, secondary text
  | 'control' // controls, list text
  | 'label' // inline labels in controls
  | 'meta' // mono, uppercase, tracked — data, counts
  | 'micro' // the mono micro floor — uppercase only, never prose
  | 'read'; // the author's voice (literata) — sovereign over its grid

const ROLE_CLASS: Record<TextRole, string> = {
  display: 't-display',
  screenTitle: 't-screen-title',
  title: 't-title',
  emphasis: 't-emphasis',
  body: 't-body',
  quiet: 't-quiet',
  control: 't-control',
  label: 't-label',
  meta: 't-meta',
  micro: 't-micro',
  read: 't-read',
};

export interface TextProps {
  role?: TextRole;
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'strong' | 'em' | 'small' | 'td' | 'th' | 'li';
  /** the ink level — hierarchy by color, not by invented sizes */
  ink?: 1 | 2 | 3;
  className?: string;
  children?: ReactNode;
}

export function Text({ role = 'body', as: Tag = 'span', ink, className = '', children }: TextProps): ReactNode {
  const classes = [ROLE_CLASS[role], ink ? `ink-${ink}` : '', className].filter(Boolean).join(' ');
  return <Tag className={classes}>{children}</Tag>;
}

/** Label — a form/control label, semantically a <label> */
export function Label({
  htmlFor,
  className = '',
  children,
}: {
  htmlFor?: string;
  className?: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <label htmlFor={htmlFor} className={`t-label ${className}`.trim()}>
      {children}
    </label>
  );
}

/** Metadata — the mono voice: data, counts, table heads, timestamps */
export function Metadata({ className = '', children }: { className?: string; children?: ReactNode }): ReactNode {
  return <span className={`t-meta ${className}`.trim()}>{children}</span>;
}
