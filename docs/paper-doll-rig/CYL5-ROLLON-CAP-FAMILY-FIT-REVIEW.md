# CYL-5ML 13-415 roll-on cap family-fit review

**Status:** family-fit review required

**Body:** `body__cylinder__5ml__53x17x17.0__f94a16652c`

**Cap geometry:** `closure__13-415__rollon-overcap__physical-v1`

## Result

The nine dimension-calibrated 13-415 roll-on cap candidates now render on the 53×17 mm clear CYL-5ML body candidate at one shared physical placement.

```bash
npm run paperdoll:cyl5-rollon-family-fit
```

Output:

`outputs/paper-doll-body-authority-reviews/CYL-5ML-13-415/rollon-cap-family-fit-v1/`

## Placement truth

- Body: 53×17 mm
- Cap: 24×17 mm
- Verified assembled roll-on height: 65 mm
- Visible cap addition above the body: 12 mm
- Physical cap/body overlap: 12 mm
- Workbench scale: 19.121143 px/mm
- Body bounds: x=871–1208
- Shared cap bounds: x=879–1200, y=841–1299
- Cap inset relative to the current body candidate: approximately 8 px per side

Every variant has byte-identical alpha. One resolved placement is applied to all nine finishes. No per-material offset or scale adjustment is permitted.

## Catalog presentation

The workbench assembly occupies 1242 px from cap top to bottle baseline. The complete assembly then receives one uniform `1.12399356×` transform from `best-bottles-catalog-scale-v1`, producing the 5 mL target:

- target assembled height: 61%
- target assembled pixels: 1396 px
- target bounds: x=850–1229, y=687–2082

This transform applies to the complete assembled product. It never independently rescales the body, cap, fitment, tube, shadow, or integration layers.

## Review truth

The lineup is useful for physical-profile and material review, but it is not production-approved:

- The body remains a review candidate because no clean physical authority is registered.
- The cap family remains a dimension-calibrated profile candidate pending named authority review.
- Exact alpha across finishes proves internal silhouette consistency only; it does not prove that the Blender profile matches the manufactured cap.
- Several Blender finishes remain material placeholders. Mirror gold, mirror silver, matte gold, matte silver, matte copper, and rhinestone appearance require source-backed GPT material treatment followed by exact-alpha clamping.
- White and translucent cap behavior is not part of this nine-variant roll-on cap family.

No approval, placement lock, remote database, Current Release, Sanity draft, or public catalog state is written by this command.
