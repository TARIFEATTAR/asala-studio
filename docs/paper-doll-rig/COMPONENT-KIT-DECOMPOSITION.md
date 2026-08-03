# Component-kit decomposition

Multi-part source artwork is evidence, not automatically one production plate. Before a source enters the component factory, its visible parts are grouped by reusable responsibility.

## Production rule

1. Preserve the original PSD/PSB filename, archive-relative path, and SHA-256.
2. Inspect the layered source and the assembled catalog reference together.
3. Recompose Photoshop layer fragments that belong to one physical responsibility. One Photoshop layer does not imply one paper-doll plate.
4. Split independently selectable exterior parts into separate full-canvas plates. When a translucent protective overcap cannot be optically reproduced by normal alpha compositing, emit open and closed compound assembly swatches instead of a synthetic clear-cap overlay.
5. Keep internal delivery hardware body-contextual when its length, visibility, refraction, or occlusion depends on the bottle.
6. Center non-transparent bounds only for isolated review framing. Production placement uses the physical mount axis, seat, body centerline, and verified interior depth.
7. Preserve the flattened source composite for provenance and visual comparison only. It is never geometry authority and never production eligible.

## Responsibility routing

| Source responsibility | Normal output | Placement authority |
|---|---|---|
| Sprayer or pump exterior | reusable full-canvas plate | mount axis + seat |
| Opaque or independently sold protective overcap | separate reusable full-canvas plate | mount axis + overcap seat |
| Translucent overcap with baked mechanism interaction | compound closed-assembly swatches, paired with exposed/open swatches | component-relative to exterior; shared mount axis + seat |
| Dip tube or inserted pipette | body-contextual weld or physical render | body centerline + verified interior depth |
| Roller housing and ball | one exterior fitment authority when not independently selectable | mount axis + seat |
| Roll-on overcap | separate reusable plate | mount axis + cap seat |
| Dropper bulb/collar | reusable exterior plate | mount axis + seat |
| Atomizer bulb, hose, or tassel | separate subassembly when independently selectable | component-relative verified anchor |
| Nozzle artwork split across PSD scenes | recomposed into its owning exterior authority | not an independent plate by default |
| Contact/refraction correction | narrow family-specific integration or weld | geometry-derived mask |

## Families that require this gate

- fine-mist sprayers;
- lotion pumps;
- droppers and pipettes;
- bulb atomizers, hoses, and tassels;
- roller assemblies plus roll-on overcaps;
- protective or decorative secondary overcaps;
- any Photoshop source with multiple large connected responsibilities or multiple catalog-selectable parts.

The machine-readable contract is implemented by `src/lib/paperDoll/componentKitDecomposition.ts`. The first real recipe is `sprayer-15-415-component-kit-decomposition.json`. Its SHA-verified source-extraction result and responsibility contact sheets are documented in `SPRAYER-15-415-SOURCE-EXTRACTION-REVIEW.md`.

The 17-415 spray and lotion lanes exercise the compound-swatches route. Their translucent overcaps are not independently selectable production layers: each closed swatch bakes the cap and visible mechanism together, while the exposed mechanism remains the open-state swatch. See `DISPENSER-17-415-CLOSED-ASSEMBLY-REVIEW.md`.

Run `npm run paperdoll:extract-component-kit-review` to reproduce that local
review set. The command writes review-only artifacts and records that production,
geometry lock, Current Release, and Sanity state remain unchanged.

Run `npm run paperdoll:compound-component-review-queue` to regenerate the
catalog-wide conservative gate. The resulting
`compound-component-review-queue.json` and
`COMPOUND-COMPONENT-REVIEW-QUEUE.md` identify every current pump, sprayer,
dropper, bulb/tassel, and compound-applicator lane that requires responsibility
review. Inclusion in that queue does not itself add a plate.

## Approval sequence

`source archive -> responsibility map -> extracted review cutouts -> exact authority masks -> material candidates -> family assembly QA -> named approval -> shared placement -> release cut`

No stage silently changes Current Release or Sanity. Every source and derived plate remains versioned and traceable.
