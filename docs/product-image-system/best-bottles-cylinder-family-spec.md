# Best Bottles Cylinder Family Specification

## Scope

This document defines the Madison Studio v1 imaging rules for the Best Bottles Cylinder family.

Cylinder products use one permanent production canvas:

```text
2080 x 2288 px
10:11 portrait
Best Bottles Bone #F5F3EF
```

The canvas does not change for compact, standard, or tall Cylinder SKUs. Framing changes through the family profile only.

## Bulk Lock Status

Status: locked for Cylinder catalog framing v1.

Lock date: 2026-06-29.

Evidence:

- Deployed Edge Function: `generate-madison-image`, Supabase project `likkskifwsrvszxdvufw`, version `185`.
- Contract gate: `brand_context_used.bestBottlesRenderingContract.status = ready` for every smoke SKU.
- Rendering lane: `bottle_catalog` for every smoke SKU.
- Production provider: `openai-gpt-image-2`.
- Canvas: `2080x2288` for every smoke SKU.
- Read-only framing QA: no failures across the seven representative Cylinder smoke outputs.

Representative smoke coverage:

| Case | SKU | Profile | Target fill-height | QA result | Notes |
| --- | --- | --- | ---: | --- | --- |
| 3ml | `GB-SPR-CLR-3ML-BLK` | `sample-vial` | 55-60% | pass | centered, baseline locked |
| 4ml cap-off | `GB-SPR-CLR-4ML-BLK` | `sample-vial` | 55-60% | warn | expected detached-cap centerline warning; no failures |
| 5ml cap-off | `GB-CYL-CLR-5ML-SPR-SBLK` | `cylinder-standard` / `small-cylinder` | 60-64% | warn | expected detached-cap centerline warning; no failures |
| 9ml regular roll-on | `GB-CYL-CLR-9ML-T-11` | `roller-bottle` | 65-70% | pass | regular 17-415 9ml stays smaller than slim 9ml |
| 9ml slim sprayer | `GB-CYL-CLR-9ML-SPR-SBLK` | `cylinder-standard` | 72-78% | pass | measured slim height drives taller band |
| 28ml metal roll-on | `GB-CYL-CLR-28ML-MRL-01` | `roller-bottle` | 65-70% | pass | uses compressed/reframed reference under Edge Function size limit |
| 100ml antique sprayer | `GB-CYL-CLR-100ML-ASP-BLK` | `cylinder-tall` | 80-84% | pass | large/tall band |

Smoke run IDs:

- `2026-06-29T05-47-55-743Z`: 3ml, 4ml, 5ml cap-off, 9ml regular, 9ml slim.
- `2026-06-29T05-53-57-213Z`: 28ml and 100ml.

Operational note: `GB-CYL-CLR-28ML-MRL-01` must use the smaller reframed reference at `pipeline/madison-hero-sync/renders/_reframed-refs-cylinder/GB-CYL-CLR-28ML-MRL-01.png`; the larger `cylinder-reframed-2026-06-13` PNG exceeds the current Edge Function reference-size gate.

## Profiles

| Profile | Product examples | Target product height | Width envelope | Baseline |
| --- | --- | ---: | ---: | ---: |
| `sample-vial` | 4ml and below, vial-scale cylinders | 55-60% | 58% | 9% up from bottom |
| `small-cylinder` | 5-15ml small cylinders and regular 9ml roll-ons | 64-70% | 58% | 9% up from bottom |
| `cylinder-standard` | measured 10-30ml cylinder bottles | 72-78% | 60% | 9% up from bottom |
| `cylinder-tall` | measured large/tall cylinders above the standard band | 80-84% | 56% | 9% up from bottom |

Classification is measurement-driven:

- Sample vial: capacity <= 4ml, height with cap <= 60mm, or height without cap <= 40mm.
- Small cylinder: catalog-friendly small upright cylinders and regular 9ml roll-ons after sample-vial classification.
- Tall: capacity > 30ml, height with cap >= 142mm, or height without cap >= 120mm.
- Standard: Cylinder products between the small-cylinder and tall bands, including measured slim 9ml products that are much taller than regular 9ml roll-ons.

Within each range, Madison resolves the exact fill-height target from the product's measured height, using `heightWithCap` first and `heightWithoutCap` as fallback.

Madison does not render Cylinder products at literal real-world scale. Convex measurements are used to choose a catalog-friendly visual scale band, and the rig enforces that band's target on the fixed 2080x2288 studio canvas.

## Alignment

The primary bottle body is always the catalog anchor.

Single-product Cylinder images:

- Primary bottle centerline aligns to canvas x-center.
- Bottle base sits on the profile baseline.
- Product is front-facing and upright.

Cap-off or applicator-off Cylinder images:

- Primary bottle body still aligns to canvas x-center.
- Detached cap/applicator is placed in the right-sidecar zone.
- Detached components sit on the same baseline as the bottle.
- Detached components do not shift the primary bottle left or right.

## Prompt And QA Tags

Cylinder preflight records must include:

```text
canvas_recommendation:fixed_studio_2080x2288
cylinder_family_profile:<profile-id>
primary_object_centerline:canvas_center
detached_component_sidecar:right_does_not_shift_primary
```

Any Cylinder generation request not using `2080x2288` should warn before batch generation.

## Non-Goals

This specification does not convert all Best Bottles families to fixed-canvas profiles. It covers Cylinder only.
