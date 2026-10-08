/**
 * objects — L7, the composite layer's public face.
 *
 * a composite must represent a recurring PRODUCT CONCEPT, never a visual
 * arrangement: BookObject (the book), SelectionMenu (the annotation
 * moment), Workbench (the contextual workspace), Dialog/Panel (rooms
 * over rooms), NotePreview (the mark). "RoundedBoxWithShadow" would be
 * rejected here.
 */

export { BookObject } from './BookObject.tsx';
export type { BookObjectProps, BookAura } from './BookObject.tsx';
export { SelectionMenu } from './SelectionMenu.tsx';
export type { SelectionMenuProps, SelectionMenuAction } from './SelectionMenu.tsx';
export { Workbench } from './Workbench.tsx';
export type { WorkbenchProps, WorkbenchAttachment } from './Workbench.tsx';
export { Dialog, Panel, NotePreview } from './Dialog.tsx';
export type { DialogProps, PanelProps, NotePreviewProps } from './Dialog.tsx';
