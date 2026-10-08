/**
 * components — the L6 primitive library's public face.
 *
 * the primitives consume the foundations and invent nothing:
 *   typography  Text/Label/Metadata (law 14 — composite roles)
 *   surface     Surface/Divider (material · elevation · radius as roles)
 *   actions     Button/IconButton/Toggle (one physical family)
 *   inputs      Input/Textarea/Select
 *   feedback    Badge/Progress/Status (the quiet announcers)
 *   navigation  Tabs/NavItem (place memory)
 *   utility     Tooltip/Kbd/VisuallyHidden
 *   reader      Selection/HighlightMarker/ProgressMarker (annotation)
 *   icon        the one icon language (24 glyphs, one stroke)
 *
 * everything travels through components.css (the tokenized skin) — a
 * primitive inventing a foundational value is a violation caught by the
 * design law.
 */

export * from './components/Icon.tsx';
export * from './components/Typography.tsx';
export * from './components/Surface.tsx';
export * from './components/Actions.tsx';
export * from './components/Inputs.tsx';
export * from './components/Feedback.tsx';
export * from './components/Navigation.tsx';
export * from './components/Utility.tsx';
export * from './components/Reader.tsx';
