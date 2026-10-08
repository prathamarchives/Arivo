# objects — the composite contract (L7)

> a composite represents a recurring product concept, never a visual
> arrangement. `BookObject` is a concept. `RoundedBoxWithShadow` is not.

composites compose primitives and the runtimes beneath them; they invent
no foundational value (the design law scans `objects.css` like every
other skin). the current vocabulary:

| object | concept | proves |
|---|---|---|
| `BookObject` | the book | material, depth, booklight, hover vocabulary, cover treatment, metadata hierarchy, progress, selection |
| `SelectionMenu` | the annotation moment | glass, z-space, causality, positioning, surface-mass entry |
| `Workbench` | the contextual workspace | open/close/resize, density breathing, attachments — the desk's bridge |
| `Dialog` | a room over the room | scrim, focus trap, escape, elevation 3 |
| `Panel` | a titled section | surface + structure |
| `NotePreview` | the mark | identity swatch + the author's quote + source |

## the book object

- cover is 2:3 at `--cover-w`; images carry the scrim for legibility.
- no cover → the **designed typographic fallback** (D-019): literata
  title on sunken ground with a spine hairline. the author speaks even
  when the author shipped no art.
- hover = component-mass glide, `--lift-m` + shadow bloom — the quiet
  precursor to the physical shelf-hover (L9).
- booklight: an optional `aura` prop writes the three aura slots
  locally; the room's `[data-temperament]` still decides whether alpha
  is allowed to exist (lab pins it to 0).
- object continuity: the open contract exists (`onOpen`); the shared
  element handoff lands with the desk (L10).

## the selection menu

- exists ONLY as a consequence: no selection rect, no instrument.
- glass at `z-floating`, clamped to the viewport, Escape dismisses.
- enters with `arivo-rise` at surface mass — glide, causal.

## the workbench

- resize is direct manipulation: width follows the pointer with no
  transition — the motion law governs state changes, not the user's own
  hand (D-021).
- width range is recorded geometry: 300–460px (D-020).
- padding breathes with inherited density; attachments slot at the foot.

## the dialog

- focus is trapped inside while open; Escape, scrim, and the close
  button are three honest doors; focus returns to the caller on close.
- the scrim reuses `--img-scrim` (theme-independent reclusion, D-016).

## the gate (W6)

the synthetic room (lab section 17): `BookObject + SelectionMenu +
Workbench + Toolbar + Note + Button + Input + Panel + Dialog` coexist in
one room. select text and meet the instrument; hover a book; drag the
workbench's handle; open a book. if they belong to the same physical
world, the foundation is doing its job. if they don't, fix the system
before touching the shelf.
