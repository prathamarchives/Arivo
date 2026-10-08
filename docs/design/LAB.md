# the design lab — operating manual

the lab is where visual claims are isolated from product state. it is a
product-adjacent surface, not a dev tool: it renders from the same tokens
and fonts the app uses.

## opening it

- dev: `pnpm dev` then append `#lab` to the renderer url
- production build: `pnpm --filter @arivo/desktop smoke -- --lab`
  (captured section-by-section to `apps/desktop/smoke-lab-*.png`)
- a keyboard entry point ships with the L8 shell

## what it proves

| section | claim |
|---|---|
| 01 typography | the room's voice: helvetica sizes/weights, the wordmark cut, literata + 68ch sample |
| 02 color | the room under the current light — all semantic surfaces |
| 03 annotation | the saturation privilege: five identity colors + washes |
| 04 material | matte paper, raised sheets, the well, scarce glass over color |
| 05 elevation | contact + ambient progression |
| 06 spacing | the 4/8 ladder, exact |
| 07 radius | proximity to the hand, ending in the pill |
| 08 controls | state coverage of the primitives |
| 09 booklight | the aura wash — light, never walls |
| 10 motion | the four easings on hover tracks + the duration table |
| 11 motion runtime | the engine: two-layer map, mass-class demos, twin inspection |
| 12 interruption | the drag-retarget torture test — velocity survives |
| 13 scroll runtime | passive sampling readout + opt-in exposure/dissolve toggles |
| 14 spatial runtime | the room at every width — 960→2560, primitives only |
| 15 state runtime | the precedence playground + the canonical nine, simultaneously |

every specimen shows its token name. `lab-data.ts` mirrors the token
file and `tests/design-law.test.ts` proves the mirror — the lab cannot
lie about a value.

## the promotion rule

the lab may contain experiments. production never consumes an effect
until it passes promotion review: rendered evidence under all six room
conditions + a performance note for anything gpu-touching (blur, grain,
shadows). promotions land as decision-ledger rows.
