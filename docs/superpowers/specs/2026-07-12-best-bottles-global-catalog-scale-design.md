# Best Bottles Global Catalog-Relative Scale Design

**Date:** 2026-07-12  
**Status:** Approved direction; ready for implementation planning  
**Applies to:** Every Best Bottles catalog family and every generated cap state

## Objective

Create one durable, perceptually compressed scale system for the entire Best Bottles catalog. Products must preserve a truthful size hierarchy without mapping real-world millimeters directly to pixels. A 454 ml product must read as larger than a 5 ml product, while the 5 ml product remains commercially visible and useful on a product-detail canvas.

The system uses one global curve plus tightly bounded family corrections. It preserves the bottle-body scale between cap-on and cap-off variants and requires approved PSD evidence before generating any cap-off or multi-component state.

## Authority and evidence

The system separates measurement truth from visual-state truth.

1. Convex is the operational catalog source only after its measurements have been reconciled against published BestBottles.com evidence.
2. BestBottles.com is historical and packaging evidence. It is not automatically authoritative when it conflicts with a stronger source.
3. Approved Photoshop files are the authority for visual identity, cap state, exposed neck geometry, component count, component arrangement, and multi-piece topology.
4. A website field such as `heightWithoutCap` is packaging metadata. It does not prove that a cap-off merchandising image exists or should be generated.
5. Conflicting, missing, or implausible measurements are flagged for review and cannot silently change a product's scale.

## Global compressed curve

The initial calibration knots define the target height of the complete cap-on assembly on the standard 2080 × 2288 canvas. They are starting targets for the measurement-verified visual calibration board, not literal real-world ratios.

| Capacity | Target assembled height | Approximate pixels on 2288 px canvas |
|---:|---:|---:|
| 1 ml | 54% | 1,236 px |
| 3 ml | 56% | 1,281 px |
| 4 ml | 58% | 1,327 px |
| 5 ml | 61% | 1,396 px |
| 9 ml | 69% | 1,579 px |
| 28 ml | 74% | 1,693 px |
| 30 ml | 75% | 1,716 px |
| 50 ml | 78% | 1,785 px |
| 100 ml | 79% | 1,808 px |
| 118 ml | 80% | 1,830 px |
| 227 ml | 82% | 1,876 px |
| 454 ml | 84% | 1,922 px |

Catalog capacities between knots use monotonic interpolation. Values below or above the calibrated range use explicit endpoint policies rather than unconstrained extrapolation. The final numeric knots may change only through a new versioned calibration approval.

## Cap-on and cap-off scale

The assembled target and the persistent body scale are related but distinct.

For a cap-on product with verified measurements:

```text
assembledTargetPx = canvasHeightPx × targetAssembledHeightPct
bodyTargetPx = assembledTargetPx × (verifiedBodyHeightMm / verifiedAssembledHeightMm)
```

The cap-off variant reuses `bodyTargetPx`, the same bottle width, centerline, and shelf baseline. Removing a closure must never enlarge the bottle body to refill the cap-on envelope.

For products where a closure or applicator would exceed the safe top margin, one shared pair-scale correction is applied to both cap-on and cap-off variants. The correction preserves their body-size match. It is never applied only to the cap-on image.

Detached components use reserved sidecar space. The fit algorithm must not shrink the primary bottle merely because a cap, dropper, bulb, tassel, wand, or other component makes the total foreground bounding box wider.

## Cap-state eligibility

Each product receives an explicit state:

- `cap-on-confirmed`: an approved reference confirms the complete assembled SKU.
- `cap-off-confirmed`: an approved PSD confirms the exposed bottle and detached closure state.
- `multi-component-confirmed`: an approved PSD confirms every visible component and their intended arrangement.
- `cap-off-unavailable`: cap-on may proceed, but no evidence authorizes cap-off generation.
- `needs-psd-review`: the available evidence is incomplete or contradictory.

Missing cap-off evidence blocks only cap-off production. It does not block an evidence-backed cap-on image. The generator must never infer cap-off eligibility from measurement fields, product copy, closure type, or another SKU.

Vintage bulb sprayers, tassels, droppers, wands, pumps, and other multi-piece assemblies require topology-specific PSD confirmation. Component count and arrangement come from the approved PSD, not from generic family assumptions.

## Bounded family corrections

The global curve remains the primary authority. A family profile may apply a correction of no more than ±2 percentage points to accommodate an unusual silhouette, subject to all of these constraints:

- the correction is documented and versioned;
- it applies consistently to equivalent cap states in the family;
- it cannot reverse capacity order within the family;
- it cannot make a materially smaller product appear larger than a materially larger neighboring catalog anchor;
- width and breathing-room changes are preferred for wide jars and broad assemblies;
- tall closures use the shared pair-scale rule rather than an independent cap-on shrink;
- detached sidecars do not participate in primary-bottle scale measurement.

If ±2 percentage points cannot produce a safe and truthful composition, the product becomes a named exception requiring review. The system must not silently widen the correction rail.

## Calibration registry

The registry contains one row for every meaningful combination of family, capacity, aspect class, and assembly topology. It does not require a separate row for every colorway or minor neck variation.

Each row records:

- family and capacity;
- canonical Grace SKU and website SKU;
- product-group identity;
- body material and shape class;
- verified body height, assembled height, and diameter;
- measurement source and reconciliation status;
- approved cap-on PSD/reference identifier;
- approved cap-off PSD/reference identifier when available;
- topology state;
- global curve target;
- family correction and rationale;
- final assembled target and derived body target;
- v6.1 baseline, canvas, and shadow contract version;
- review and approval state.

Colorways and equivalent closures inherit from a registry row only when product identity, physical geometry, and topology match.

## Calibration board

Cylinder is the pilot family. Its board includes measurement-verified canonical anchors at 1, 3, 4, 5, 9, 28, 30, 50, 100, 118, 227, and 454 ml.

Every tile uses:

- the same 2080 × 2288 canvas;
- the approved v6.1 canvas, shelf baseline, and shadow contract;
- the resolved global target and bounded family correction;
- the approved canonical Photoshop reference;
- visible labels for capacity, source SKU, measurements, global target, correction, and final target.

After the Cylinder pilot passes, the board expands to one representative for every registry row across all catalog families. Mass generation remains gated until the applicable registry row and visual calibration evidence are approved.

## Validation rules

Automated tests must prove:

1. global targets are monotonic across all calibrated capacity knots;
2. interpolation never leaves the endpoint range;
3. family corrections remain within ±2 percentage points;
4. corrections cannot reverse within-family size order;
5. cap-on and cap-off variants resolve to the same body pixel height within rounding tolerance;
6. detached sidecars cannot reduce the primary bottle's target height;
7. cap-off generation is rejected without an approved cap-off PSD;
8. multi-component generation is rejected without confirmed topology;
9. disputed measurements cannot become approved calibration anchors;
10. every generated product carries the scale-contract and v6.1 lineage versions.

Pixel QA must measure the primary bottle independently from detached components. It verifies baseline, body height, width, safe margins, shadow grounding, and cap-state pair consistency.

## Rollout

1. Implement the versioned curve resolver and registry schema.
2. Add reconciliation and cap-state eligibility gates.
3. Build the Cylinder pilot registry and calibration board.
4. Review and freeze the Cylinder curve evidence.
5. Populate remaining family registry rows from reconciled catalog data and PSD inventory.
6. Generate the catalog-wide calibration board.
7. Approve the versioned global contract.
8. Resume family generation, QA, approval, and publishing under that contract.

No Shopify or Convex media publication is part of calibration. Publishing remains a separate operator-approved step after generated assets pass the applicable scale, identity, topology, and v6.1 visual gates.
