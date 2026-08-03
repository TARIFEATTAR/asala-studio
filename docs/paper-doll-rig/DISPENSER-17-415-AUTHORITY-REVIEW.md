# 17-415 sprayer and lotion-pump exterior authority

Status: shared exterior geometry locked by named family-fit approval; complete assemblies remain pre-release.

## Approved result

Jordan Richter approved the shared 17-415 exterior silhouette, calibrated width,
mount seat, material set, and five-body CYL-9ML family fit on 2026-08-03.
The lock applies to the exposed actuator/head plus collar responsibility only.

The approved set contains:

- six fine-mist sprayer appearances: shiny gold, matte silver, black, shiny
  silver, red, and turquoise;
- three lotion-pump appearances: matte silver, shiny gold, and black;
- one exact authority alpha shared by all nine appearances;
- one placement on the five locked clear, frosted, swirl, amber, and cobalt
  CYL-9ML body plates.

Sprayer and pump remain distinct functional catalog lanes even though the three
matching Photoshop appearance sources resolve to byte-identical exterior
cutouts. Visual equality does not collapse their catalog identities.

## Physical calibration and scope

- neck finish: 17-415;
- verified outside diameter: 19 ±0.5 mm;
- canonical scale: 18.15 px/mm;
- locked authority width: 345 px;
- canonical canvas: 2080 × 2288;
- center axis: x = 1041;
- mount seat: y = 1002.

The canonical catalog records a 31 ±0.5 mm height, while the approved source
aspect at the verified 19 mm width resolves to approximately 33.5 mm. The
approved family-fit silhouette preserves the reviewed source aspect. This
geometry lock records the approved pixels and placement; it does not silently
rewrite or claim to correct the conflicting catalog height field.

## Responsibility boundary

| Responsibility | State | Production route |
|---|---|---|
| Exposed actuator/head plus collar | Geometry locked | Reusable full-canvas plate with exact authority alpha |
| Sprayer translucent overcap | Independent existing plate; not approved by this decision | Its own mask, placement, and assembled translucent QA |
| Lotion-pump translucent overcap | Independent existing plate; not approved by this decision | Its own mask, placement, and assembled translucent QA |
| Sprayer dip tube and inserted plug | Body-contextual | Weld/render against the target body depth, occlusion, and refraction |
| Pump dip tube and inserted plug | Body-contextual; length unresolved | Verify length, then weld/render against the target body |

The source Photoshop composites are never promoted as flattened production
plates. They are decomposed by physical responsibility. Dip tubes remain out of
the reusable exterior plate because visible length and optical interaction
change with the target bottle.

## QA evidence

- All nine candidates have byte-exact alpha identity to the authority mask.
- Maximum mismatched alpha pixels: 0.
- Detached source islands are removed only through the measured, source-specific
  topology contract.
- Resized authority topology is rechecked after resampling.
- Nearly-transparent Photoshop RGB pollution cannot seed the material dilation;
  only pixels with alpha 128 or greater supply edge color before the exact
  authority alpha is restored.
- All nine appearances were inspected in close material sheets.
- Sprayer and pump appearances were assembled on all five locked bodies using
  the same placement; no per-body production nudges were written.

Local evidence:

- `docs/paper-doll-rig/sprayer-17-415-component-kit-decomposition.json`
- `docs/paper-doll-rig/pump-17-415-component-kit-decomposition.json`
- `outputs/paper-doll-component-kit-reviews/17-415-sprayer/source-extraction-v1/manifest.json`
- `outputs/paper-doll-component-kit-reviews/17-415-pump/source-extraction-v1/manifest.json`
- `outputs/paper-doll-dispenser-17-415/authority-review-v1/manifest.json`
- `outputs/paper-doll-dispenser-17-415/authority-review-v1/review/sprayer-materials.png`
- `outputs/paper-doll-dispenser-17-415/authority-review-v1/review/sprayer-five-body-family-fit.png`
- `outputs/paper-doll-dispenser-17-415/authority-review-v1/review/pump-materials.png`
- `outputs/paper-doll-dispenser-17-415/authority-review-v1/review/pump-five-body-family-fit.png`

Rebuild with:

```bash
npm run paperdoll:dispenser-17-415-authority-review
```

## Release boundary

This approval earns geometry lock for the reusable exposed exterior plates. It
does not cut a Current Release, modify Sanity, publish a SKU, approve either
translucent overcap, or approve a complete tube-bearing assembly. Those remain
separate named gates so the approved exterior can progress without pretending
the unresolved assembly responsibilities are complete.
