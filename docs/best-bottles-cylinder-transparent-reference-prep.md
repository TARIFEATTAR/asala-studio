# Best Bottles Cylinder Transparent Reference Prep

Generated: 2026-06-20T17:17:53.570Z
Mode: dry run
Workflow source: `tmp/best-bottles-family-workflow-sequence-cylinder.json`
Input root: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-flattened`
Output root: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-transparent/cylinder`
Outputs: `tmp/best-bottles-cylinder-transparent-reference-prep.json`, `tmp/best-bottles-cylinder-transparent-reference-prep.csv`

## Operating Decision

Use this as the gate between Photoshop/background-removal work and Madison import. The script is intentionally conservative: it does not remove backgrounds automatically, and it does not copy anything unless `--apply` is passed. When it does copy, it preserves the original PNG bytes and only renames/places files that already pass the transparent PNG checks.

## Summary

- Targeted Cylinder workflow rows: 249
- Ready for Madison import: 0
- Ready but needs crop review: 0
- Needs background removal / PNG-32 alpha export: 168
- Needs alpha edge review: 0
- Needs source match: 79
- Needs manual duplicate choice: 0
- Needs SKU key correction: 0
- Needs explicit cap state: 2
- Cap-on references: 50 (0 ready)
- Cap-off references: 118 (0 ready)
- Copied this run: 0

## Statuses

| Status | Rows |
| --- | --- |
| Ready for Madison import | 0 |
| Ready with crop review | 0 |
| Needs background removal | 168 |
| Needs alpha edge review | 0 |
| Needs source match | 79 |
| Needs duplicate choice | 0 |
| Needs SKU key correction | 0 |
| Needs cap state | 2 |

## Background Removal Guardrails

- Export transparent PNG-32 with alpha. Do not flatten to RGB.
- Do not use a hard white-threshold cutout on glass, frosted edges, sprayers, caps, shadows, tubes, or transparent reducers.
- Preserve semi-transparent pixels around the glass and component edges; if edge alpha is nearly all hard 0/255, review before import.
- Preserve the original file as the source of truth; the prepared folder is a named import staging area, not the only copy.
- Final import filename must be exactly `{graceSku}.png`.
- Cap state must be only `cap-on` or `cap-off`; `cap-off` means the cap is visible beside the bottle.

## First 25 Rows

| Status | Grace SKU | Website SKU | Product group | Cap state | Issues |
| --- | --- | --- | --- | --- | --- |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-BKDT | GBCylAmb9RollBlkDot | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-MCPR | GBCylAmb9RollMattCu | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-MGLD | GBCylAmb9RollMattGl | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-MSLV | GBCylAmb9RollMattSl | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-PKDT | GBCylAmb9RollPnkDot | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-SBLK | GBCylAmb9RollShBlk | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-SGLD | GBCylAmb9RollShnGl | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-SLDT | GBCylAmb9RollSlDot | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-SSLV | GBCylAmb9RollShnSl | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-AMB-9ML-ROL-WHT | GBCylAmb9RollWht | cylinder-9ml-amber-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLK-9ML-SPR-BLK | GBCylSwrl9SpryBlk | cylinder-9ml-swirl-17-415-finemist | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-BKDT | GBCylBlu9MtlRollBlkDot | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-MCPR | GBCylBlu9MtlRollMattCu | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-MGLD | GBCylBlu9MtlRollMattGl | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-MSLV | GBCylBlu9MtlRollMattSl | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-PKDT | GBCylBlu9MtlRollPnkDot | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-SBLK | GBCylBlu9MtlRollShBlk | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-SGLD | GBCylBlu9MtlRollShnGl | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-SLDT | GBCylBlu9MtlRollSlDot | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-SSLV | GBCylBlu9MtlRollShnSl | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-MRL-WHT | GBCylBlu9MtlRollWht | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-ROL-BKDT | GBCylBlu9RollBlkDot | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-ROL-MCPR | GBCylBlu9RollMattCu | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-ROL-MGLD | GBCylBlu9RollMattGl | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
| needs_background_removal | GB-CYL-BLU-9ML-ROL-MSLV | GBCylBlu9RollMattSl | cylinder-9ml-cobalt-blue-17-415-rollon | cap-off | PNG has no alpha channel.; Too little transparency; background was probably not removed.; Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.; Foreground touches image edge; verify product is not cropped. |
