# Best Bottles Family Scale Specification

## Purpose

This document defines how Madison Studio should translate Best Bottles real-world product measurements into catalog-friendly image framing.

Madison does not render products at literal real-world scale. Convex measurements are used to choose a catalog-friendly visual scale band, and the rig enforces that band's target on the fixed 2080x2288 studio canvas.

## Fixed Studio

All catalog masters use:

```text
Canvas: 2080 x 2288 px
Background: Best Bottles Bone #F5F3EF
Primary alignment: centered on vertical canvas centerline
Baseline: approximately 8-10% above bottom edge
```

The image generator is responsible for photographic enhancement. Final scale, baseline, and centerline are rig responsibilities.

## Visual Scale Bands

| Band ID | Product type | Target fill-height | Notes |
| --- | --- | ---: | --- |
| `sample-vial` | 1-4ml sample vials, tiny sprayers | 55-60% | Minimum catalog-friendly size; not literal physical scale. |
| `small-bottle` | 5-15ml small upright bottles, regular 9ml roll-ons | 64-70% | Small products remain readable in catalog grids. |
| `standard-bottle` | 16-60ml upright bottles | 72-80% | Middle catalog zone. |
| `large-bottle` | 100ml+ upright bottles | 80-86% | Large products keep top and bottom breathing room. |
| `premium-tall` | tall decorative perfume, tall aluminum, treatment-style bottles | 84-92% | Used only when measured height and family justify it. |
| `low-wide` | jars, squat bottles | width-first, 45-68% height | Height alone is not valid for low/wide products. |
| `sidecar` | cap-off / applicator-off configurations | inherited primary band | Primary bottle stays centered; detached component sits on the same baseline. |

## Rendering Lanes And Statuses

The Day 1 inventory separates generation eligibility from bottle scale eligibility.

Rendering lanes:

- `bottle_catalog`: true bottle or jar family that participates in catalog framing and relative scale.
- `component_enhancement`: fitments, caps, sprayers, droppers, pumps, tools, and other components. These are not bottle scale targets, but remain eligible for material and geometry enhancement.
- `packaging_enhancement`: gift bags, gift boxes, and packaging supplies. These are not bottle scale targets, but remain eligible for packaging enhancement.
- `blocked_unknown`: unknown product truth. Do not generate until reconciled.

Bottle scale statuses:

- `mapped`: already covered by the current Madison family profile resolver or current mapped profile group.
- `needs_review`: true bottle family with enough product coverage to map next, but not bulk-safe until resolver tests and smoke QA exist.
- `not_bottle`: excluded from bottle scale logic because it belongs to component or packaging enhancement.
- `blocked`: unknown or unresolved product truth.

Enhancement statuses:

- `needs_review`: eligible lane exists, but prompt/rig QA still needs family-specific verification before bulk.
- `blocked`: unknown or unresolved product truth.

Current inventory source:

```text
docs/product-image-system/best-bottles-family-scale-inventory.md
public/data/bb-family-scale-inventory.json
```

## Classification Rule

Convex measurements classify the SKU into a scale band. The band then defines the rig target.

Do not use capacity alone for framing. Use capacity with:

- `heightWithCap`
- `heightWithoutCap`
- `diameter`
- `family`
- `bottleCollection`
- `applicator`
- cap/applicator configuration

Examples:

- 9ml regular roll-on at approximately 83mm with cap maps smaller than a 9ml slim 13-415 sprayer at approximately 118mm with cap.
- 3ml, 4ml, and similar sample vials remain catalog-friendly at 55-60% instead of shrinking to literal physical scale.
- Jars and squat products use a width-first profile rather than a tall-bottle height-first profile.

## Bulk Generation Gate

A bottle family is bulk-safe only when all of the following are true:

1. Rendering lane is `bottle_catalog`.
2. Bottle scale status is `mapped`.
3. Resolver has tests for representative products.
4. Smoke QA passes or normalizes the family archetype.
5. Reference images are clean enough for the Canon prompt.
6. Component/packaging families are not included in bottle generation batches.

Component and packaging families require separate enhancement-lane gates. They should not use glass-specific bottle framing rules, but they still need baseline, material preservation, geometry preservation, and reference-quality QA before bulk enhancement.
