# 15-415 sprayer authority review candidates

Status: dimension-calibrated review candidates created; geometry, compatibility, and family-fit approval not claimed.

## Result

The 15-415 fine-mist sprayer kit now has two independent five-appearance review families:

- exposed sprayer head: black, matte gold, matte silver, shiny gold, and shiny silver;
- protective overcap: black, matte gold, matte silver, shiny gold, and shiny silver.

The dip tube remains a third, body-contextual responsibility. It is not a reusable global overlay and is not included in either exterior authority mask.

The candidates use the locked CYL-9ML canvas and pixel scale as a visual scale context only:

- canonical canvas: 2080 × 2288;
- verified width scale: 18.15 px/mm;
- catalog outside diameter: 20 ±0.5 mm;
- shared target width: 363 px;
- center axis: x = 1041;
- mount seat: y = 1002.

Important: these components have a 15-415 neck finish, while the five CYL-9ML context bodies have a 17-415 neck finish. The five-body sheets do **not** prove compatibility or physical fit. They exist only to expose scale, centering, and material-transfer problems in a familiar locked catalog context. Family-fit approval requires a verified compatible 15-415 body cohort.

The protective overcap uses the catalog 41 ±0.5 mm physical envelope and a Blender geometry mask. The exposed head preserves the cleaned shiny-silver source silhouette at the verified 20 mm width. Its source-aspect height is 40.1 ±0.25 mm; that is a recorded review calibration, not a replacement for catalog physical truth.

## Real-file topology calibration

The shiny-silver Photoshop head source initially measured ten alpha components. The actual measurements were:

- one retained closure region: 77,022 pixels;
- nine detached artifacts: 13, 10, 9, 9, 8, 8, 6, 4, and 4 pixels;
- total discarded pixels: 71.

The build accepts this cleanup only through the source-specific contract recorded in the script and output manifest. It rejects the source if the component count changes, if any discarded component exceeds 13 pixels, or if discarded pixels exceed 71 total. There is no global “small island” threshold.

The Blender mask is resized with Lanczos2 because Lanczos3 introduced 29 detached 1–20 pixel ringing artifacts on the real high-contrast alpha edge. Topology is inspected after resizing.

## QA result

- Five head appearances have byte-exact alpha identity to the head authority candidate.
- Five overcap appearances have byte-exact alpha identity to the overcap authority candidate.
- Every candidate reports zero mismatched alpha pixels.
- Five-body scale-context sheets preserve the clear, frosted, swirl, amber, and cobalt body plates unchanged.
- The context lineup uses one shared center axis and visual seat; no per-body production nudge or compatibility mapping was written.
- Current Release and Sanity state remain unchanged.

Local review artifacts:

- `outputs/paper-doll-sprayer-15-415/authority-review-v1/manifest.json`
- `outputs/paper-doll-sprayer-15-415/authority-review-v1/review/sprayer-head-materials.png`
- `outputs/paper-doll-sprayer-15-415/authority-review-v1/review/sprayer-head-five-body-scale-context.png`
- `outputs/paper-doll-sprayer-15-415/authority-review-v1/review/protective-overcap-materials.png`
- `outputs/paper-doll-sprayer-15-415/authority-review-v1/review/protective-overcap-five-body-scale-context.png`

Rebuild with:

```bash
npm run paperdoll:sprayer-15-415-authority-review
```

## Approval boundary

These are authority candidates, not approved authorities. Exact alpha proves that every appearance was clamped to its proposed mask; it does not approve the underlying mask. Geometry lock requires named review of the physical profile. Compatibility and family fit require a verified 15-415 body cohort; the 17-415 CYL-9ML context sheets cannot satisfy that gate. Production registration, Current Release changes, and Sanity sync remain separate actions.

## Reusable compound-component rule

Apply the same responsibility-first gate to other multipart catalog components:

| Component source | Reusable exterior responsibilities | Body-contextual responsibilities |
|---|---|---|
| Fine-mist sprayer | head/collar; independently selectable protective overcap | dip tube, inserted plug, interior occlusion/refraction |
| Lotion pump | actuator/collar; independently selectable protective overcap | dip tube, inserted stem, bottle-contact effects |
| Dropper | bulb/collar or decorative shell | pipette length, liquid pickup, interior refraction |
| Bulb atomizer | collar/nozzle; bulb and tassel only when selectable as a stable kit | hose/tube length and body-specific routing |
| Roller assembly | visible housing and ball when sold as one fitment; separate roll-on overcap | hidden insertion plug and neck-interior occlusion |

Do not split by Photoshop layer count. Split by physical responsibility, SKU selectability, compatibility, and whether the pixels can remain deterministic across every compatible body.
