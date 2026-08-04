# Cylinder requested-family source registration

**State:** four source assemblies registered for review; two incorrect requested-family matches quarantined; no geometry authority, production release, or Sanity mutation

This tranche currently covers four confirmed Cylinder positions requested after the 9 mL 17-415 pilot. It does not stretch the 9 mL pilot assets into larger products. Each active family is derived from its own SHA-pinned layered Photoshop source and registered to its reviewed catalog presentation position.

Runtime recipe:

- `docs/paper-doll-rig/cylinder-requested-family-source-recipes.json`
- builder: `scripts/paper-doll/build-cylinder-requested-family-review.ts`
- current corrected output: `outputs/paper-doll-cylinder-requested-family-reviews/source-registered-v2-corrected/`
- historical rejected output: `outputs/paper-doll-cylinder-requested-family-reviews/source-registered-v1/`

## Registered review families

| Family | Physical truth | Display position | Source identity | Responsibilities |
|---|---|---|---|---|
| 9 mL tall slim spray | 106 × 18 mm, 13-415 | `spray\|9\|tall`, 71% | source-backed | body + body-contextual dip tube + sprayer head; overcap detached |
| 25 mL spray | 83 × 32 mm, 18-415 | `spray\|25`, 73.210526% | **manual review required** | body + body-contextual dip tube + sprayer head; overcap detached |
| 50 mL spray | 117 × 32 mm, 18-415 | `spray\|50`, 78% | source-backed | body + body-contextual dip tube + sprayer head; overcap detached |
| 100 mL spray | 154 × 35 mm, 18-415 | `spray\|100`, 79% | source-backed | body + body-contextual dip tube + sprayer head; overcap detached |

The 25 mL source archive and filename call the product “30 mL,” while current catalog truth identifies the family as 25 mL / 83 × 32 mm. The source remains reviewable but cannot become body authority until a named identity decision resolves that conflict.

## Quarantined roll-on mappings

The original v1 review included the catalog's existing 28 mL and 50 mL Cylinder roll-ons. A read-only product-truth audit verified that those Photoshop sources match the current Best Bottles products and their catalog records. The user then confirmed that these are **not** the larger roll-on bottles intended by the request.

They are therefore not defective products and are not deleted from the full catalog. They are rejected only as matches for the unresolved requested pair:

| Requested position | Rejected registration | Catalog evidence | State |
|---|---|---|---|
| 28 mL big roll-on | `CYL-28ML-16MM-ROLLON` / `GBCyl28RollWht.psd` | four current 28 mL Cylinder roll-on SKUs | quarantined; promotion prohibited |
| 50 mL big roll-on | `CYL-50ML-16MM-ROLLON` / `GBCyl50RollWht.psd` | four current 50 mL Cylinder roll-on SKUs | quarantined; promotion prohibited |

The intended pair remains `missing-exact-identity`. One exact SKU, product URL, photograph, Photoshop filename, or measured dimension set is required for each intended bottle before source registration. The builder preserves this blocker in the generated manifest and never guesses a replacement from capacity or filename alone.

## Transform contract

The builder finds the union of all assembly members in the registered source coordinate system, then maps that complete union into the family’s reviewed presentation zone. It applies the same uniform transform to:

- bottle body;
- exterior sprayer head or roller fitment;
- body-contextual dip tube;
- any future approved family-specific integration layer.

No member can receive an independent catalog scale. Detached overcaps and integration references receive no production placement from this source-registration step.

This family registration replaces the unsafe assumption that a pixels-per-millimeter value calibrated on the 9 mL bottle can be applied to 25–100 mL source files. For example, the 100 mL source assembly is much taller than the canonical canvas; the complete source union is uniformly mapped to its reviewed 79% hero position instead.

## Real-file calibration result

The first contact sheet exposed a detached white fragment beneath the 50 mL spray. The source dip-tube layer is 1,898 px tall and extends below its 2,100 px Photoshop document. The visible document intersection is only 1,423 px tall. The builder now clips every decoded Photoshop layer to the document canvas before planning placement and records:

- original layer bounds as `sourceBoundsPx`;
- visible document intersection as `editBoundsPx`;
- future approved alpha authority as `authorityBoundsPx` (currently `null`);
- registered review placement as `placementBoundsPx`.

This is a calibrated source rule, not a fixed material or shape threshold.

## GPT Image enhancement boundary

These source assemblies are already strong visual references. They should be preserved when they pass visual review. GPT Image may be used selectively to improve material fidelity, lighting, reflections, or surface finish, but it may not change geometry.

The permitted path is:

`registered source pixels → approved exact-alpha authority → GPT material edit → mask-and-clamp → silhouette verification → named approval`

A bounding box alone never earns geometry lock. These outputs intentionally report:

- `geometryLocked: false`
- `productionEligible: false`
- `remoteWritesPerformed: false`
- `currentReleaseChanged: false`
- `sanityChanged: false`

## Promotion gates

Before any family becomes production eligible:

1. approve the source identity and physical geometry;
2. approve the exact alpha authority for each independently reusable exterior component;
3. approve each body-contextual tube against its own bottle assembly;
4. resolve the 25 mL versus 30 mL source identity conflict;
5. perform family-fit review for each detached overcap;
6. run mask-and-clamp verification on any GPT-enhanced pixels;
7. record named material, geometry, placement, and assembly-context approvals;
8. cut an append-only release separately.

The source-registration builder does not perform any of those promotion actions automatically.
