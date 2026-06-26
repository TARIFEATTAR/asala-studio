# Best Bottles Family Workflow Sequence - Cylinder

Generated: 2026-06-20T00:59:06.187Z
Source audit: `tmp/best-bottles-cylinder-generation-audit.json`
Outputs: `tmp/best-bottles-family-workflow-sequence-cylinder.json`, `tmp/best-bottles-family-workflow-sequence-cylinder.csv`

## Operating Decision

Do not resume mass Cylinder generation from the mixed library state. The family should move through a sequenced cleanup queue first: fix references and naming, regenerate from clean references where needed, visually approve only final rigged masters, then push to Shopify by Grace SKU and reconcile Convex from the returned Shopify CDN URL.

## Current Readout

- Total Cylinder/Tall Cylinder rows: 385
- Complete live generated masters: 18
- Live Shopify/Convex rows with unknown image provenance requiring spot check: 114
- Approved generated masters push-eligible after visual approval: 0
- Approved keeper/reference imports that are not automatically push-eligible final masters: 65
- Ready to generate now: 0
- Ready to generate after Shopify preflight: 6
- Source cleanup blockers before clean family completion: 247
- SKU key correction blockers: 4
- Rows where the `graceSku` key is not in canonical Convex/Grace SKU format: 4

## Lane Sequence

| Order |Lane |Rows |Gate |Next action |
| --- | --- | --- | --- | --- |
| 1 | Quarantine / exclude | 0 | blocked | Do not generate or push until the row is confirmed in Convex and Shopify truth. |
| 2 | Needs SKU key correction | 4 | blocked | Replace website-style or invented SKU keys with the canonical Convex/Grace SKU before generation or push. |
| 3 | Needs Shopify mapping | 0 | blocked | Resolve Shopify product and variant IDs before any push can be trusted. |
| 4 | Needs clean reference | 65 | blocked | Create or attach a clean background-removed reference named exactly by Grace SKU. |
| 5 | Needs canonical reference choice | 113 | blocked | Pick the exact source image, rename it to the Grace SKU, and store it in the cap-on or cap-off path. |
| 6 | Approved reference needs regeneration | 65 | blocked_for_push | Treat the approved keeper/reference import as source material only; regenerate and post-process a final rigged master before push. |
| 7 | Approved unknown provenance | 0 | manual_review | Identify whether the approved asset is a generated master or a reference import before using it for Shopify. |
| 8 | Ready after Shopify preflight | 6 | preflight | Backfill or verify Shopify product and variant mapping, then generate with the Madison rig. |
| 9 | Ready to generate | 0 | generation_eligible | Generate with GPT Image 2 using the clean reference and deterministic Madison rig. |
| 10 | Generated needs visual QA | 0 | visual_qa | Approve only if identity, cap state, material, baseline, canvas, and brand style all pass. |
| 11 | Approved generated push-eligible | 0 | push_eligible_after_visual_approval | Push to Shopify by Grace SKU only after the visual approval gate confirms PDP alignment, brand fit, canvas, and product identity. |
| 12 | Live needs Convex sync | 0 | sync_required | Shopify has media; mirror the Shopify CDN URL and media IDs back into Convex. |
| 13 | Live unknown provenance | 114 | spot_check | Spot-check the live Shopify image; replace it if it is off-brand, a reference import, or not a final Madison master. |
| 14 | Complete generated master | 18 | complete | No generation needed; keep in spot-check pool for launch QA. |

## Visual Approval Gate

Push eligibility is not a purely mechanical judgment. A generated or already-live image can move forward only after a reviewer confirms:

- PDP alignment: product centered on the vertical centerline, stable baseline, no drift, no crop, cap-off compositions show the cap beside the bottle.
- Brand fit: high-end editorial product photography, clean bone background, soft drop shadow, believable glass backlight, no clutter or props.
- Canvas contract: final master is `2080 x 2288`, uses the Madison rig, and is ready for downstream Shopify/staging display.
- Product truth: the image does not change the intended object, dimensions, glass color, finish, applicator, cap, reducer, tassel, collar, hose, ring, or other SKU-specific characteristics.
- Output quality: no warped geometry, hallucinated labels, damaged transparency, jagged edges, muddy reflections, incorrect shadow, or low-resolution artifacts.

## Naming Contract

- Canonical source and generated master filename: `{graceSku}.png`.
- Do not use the Grace SKU prefix as the family classifier. Some non-Cylinder products legitimately carry `GB-CYL...` Grace SKUs.
- Family lane selection must come from `websiteSku`, current bestbottles.com selling evidence, Convex `family`, and `productGroupSlug`.
- Example: the live Roll on Glass Bottles page shows clear/cobalt 5 ml Cylinder roll-ons, while amber 5 ml roll-ons are Tulip (`GBTulipAmb5...`) even when their Grace SKUs begin `GB-CYL-AMB...`.
- Cap state is a folder/state, not a third product state: only `cap-on` or `cap-off`.
- `cap-off` means the cap is off the bottle and visible beside it.
- Shopify writes must use the Convex/Grace SKU mapping plus Shopify product and variant IDs; generated ad hoc names are not write keys.
- Reference imports are allowed as source truth, but they are not final Madison masters until regenerated or explicitly approved as an exception.

## First 20 Queue Rows

| Order |Lane |Grace SKU |Website SKU |Product group |Risk flags |
| --- | --- | --- | --- | --- | --- |
| 2 | Needs SKU key correction | GBCyl5WhtSht | GBCyl5WhtSht | cylinder-5ml-clear-13-415-capclosure | missing_shopify_product_id; missing_shopify_variant_id; non_canonical_grace_sku_format |
| 2 | Needs SKU key correction | GBCylSwrl9MtlRollWht | GBCylSwrl9MtlRollWht | cylinder-9ml-clear | missing_shopify_product_id; missing_shopify_variant_id; non_canonical_grace_sku_format |
| 2 | Needs SKU key correction | GBCylSwrl9RollWht | GBCylSwrl9RollWht | cylinder-9ml-clear | missing_shopify_product_id; missing_shopify_variant_id; non_canonical_grace_sku_format |
| 2 | Needs SKU key correction | GBTallCyl9WhtSht | GBTallCyl9WhtSht | tall-cylinder-9ml-clear-13-415-capclosure | missing_shopify_product_id; missing_shopify_variant_id; non_canonical_grace_sku_format |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-GLD-T | GBTallCyl9Gl | cylinder-9ml-clear-13-415 | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-SLV-T | GBTallCyl9Sl | cylinder-9ml-clear-13-415 | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-SPR-MBLK | GBTallCyl9SpryBlkMatt | cylinder-9ml-clear-13-415-finemist | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-SPR-MBLU | GBTallCyl9SpryBluMatt | cylinder-9ml-clear-13-415-finemist | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-SPR-MCPR | GBTallCyl9SpryCuMatt | cylinder-9ml-clear-13-415-finemist | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-SPR-MGLD | GBTallCyl9SpryGlMatt | cylinder-9ml-clear-13-415-finemist | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-SPR-MSLV-02 | GBTallCyl9SprySlMatt | cylinder-9ml-clear-13-415-finemist | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-MRL-BKDT-02 | GBTallCyl9MtlRollBlkDot | cylinder-9ml-clear-13-415-rollon | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-MRL-MCPR-02 | GBTallCyl9MtlRollCuMatt | cylinder-9ml-clear-13-415-rollon | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-MRL-MGLD-02 | GBTallCyl9MtlRollGlMatt | cylinder-9ml-clear-13-415-rollon | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-MRL-MSLV-03 | GBTallCyl9MtlRollSlMatt | cylinder-9ml-clear-13-415-rollon | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-MRL-PKDT-02 | GBTallCyl9MtlRollPinkDot | cylinder-9ml-clear-13-415-rollon | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-MRL-SBLK-02 | GBTallCyl9MtlRollBlkSh | cylinder-9ml-clear-13-415-rollon | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-MRL-SGLD-02 | GBTallCyl9MtlRollGlSh | cylinder-9ml-clear-13-415-rollon | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-MRL-SLDT-02 | GBTallCyl9MtlRollSlDot | cylinder-9ml-clear-13-415-rollon | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
| 4 | Needs clean reference | GB-CYL-CLR-9ML-MRL-SSLV-02 | GBTallCyl9MtlRollSlSh | cylinder-9ml-clear-13-415-rollon | missing_shopify_product_id; missing_shopify_variant_id; no_source_filename |
