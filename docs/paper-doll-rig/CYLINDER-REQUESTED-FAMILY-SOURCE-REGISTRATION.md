# Cylinder requested-family source registration

**State:** seven source families registered for review; the disputed 74 × 21 mm roll-on is body-only identity evidence and cannot compete with the five locked 70 × 20 mm masters; the 28/50 mL large-roller bodies are pinned to exact live product dimensions; no geometry authority, production release, or Sanity mutation

This tranche covers seven confirmed Cylinder positions around and beyond the 9 mL 17-415 pilot. It does not stretch the pilot assets into another physical shell. Each active family is derived from its own SHA-pinned layered Photoshop source and registered to its reviewed catalog presentation position.

Runtime recipe:

- `docs/paper-doll-rig/cylinder-requested-family-source-recipes.json`
- builder: `scripts/paper-doll/build-cylinder-requested-family-review.ts`
- current exact-identity output: `outputs/paper-doll-cylinder-requested-family-reviews/source-registered-v3-exact-jumbo-rollons/`
- jumbo component decomposition: `docs/paper-doll-rig/jumbo-rollon-16mm-component-kit-decomposition.json`
- jumbo component review: `outputs/paper-doll-component-kit-reviews/16mm-jumbo-rollon/source-extraction-v2/`
- historical pre-resolution output: `outputs/paper-doll-cylinder-requested-family-reviews/source-registered-v1/`
- historical mistaken-quarantine output: `outputs/paper-doll-cylinder-requested-family-reviews/source-registered-v2-corrected/`

## Registered review families

| Family | Physical truth | Display position | Source identity | Responsibilities |
|---|---|---|---|---|
| 9 mL tall slim spray | 106 × 18 mm, 13-415 | `spray\|9\|tall`, 71% | source-backed | body + body-contextual dip tube + sprayer head; overcap detached |
| 9 mL regular roll-on | reported 74 × 21 mm, 17-415 | `roll-on\|9\|regular`, reference-only | **identity decision required** | clean body scene only; contaminated component scenes detached; five locked 70 × 20 mm plates remain active authority |
| 28 mL large-roller bottle | 81 × 31 mm body; 100 mm capped; 16 mm | `roll-on\|28`, body-only at 74% | exact user/live-catalog identity | valid uncapped body; valid separable plastic large-roller candidate; metal composite requires neck removal; black/white overcaps detached |
| 50 mL large-roller bottle | 98 × 37 mm body; 116 mm capped; 16 mm | `roll-on\|50`, body-only at 78% | exact user/live-catalog identity | valid uncapped body; valid separable plastic large-roller candidate; metal composite requires neck removal; black/white overcaps detached |
| 25 mL spray | 83 × 32 mm, 18-415 | `spray\|25`, 73.210526% | **manual review required** | body + body-contextual dip tube + sprayer head; overcap detached |
| 50 mL spray | 117 × 32 mm, 18-415 | `spray\|50`, 78% | source-backed | body + body-contextual dip tube + sprayer head; overcap detached |
| 100 mL spray | 154 × 35 mm, 18-415 | `spray\|100`, 79% | source-backed | body + body-contextual dip tube + sprayer head; overcap detached |

The 25 mL source archive and filename call the product “30 mL,” while current catalog truth identifies the family as 25 mL / 83 × 32 mm. The source remains reviewable but cannot become body authority until a named identity decision resolves that conflict.

## Jumbo roll-on identity resolution

The original source registration found the correct straight-sided physical families but did not yet have an exact product identity. A later correction quarantined them after an ambiguous visual exchange. The user then supplied BestBottles.com screenshots for `GBCyl1ozRollWht` and `GBCyl50RollBlk` and explicitly confirmed that these are the intended jumbo massage-therapy roll-ons.

The quarantine is superseded, not erased. The runtime manifest preserves the correction history while reporting zero active rejected or unresolved families.

Their component scope is deliberately closed:

| Capacity | Plastic + white | Plastic + black | Metal + white | Metal + black |
|---|---|---|---|---|
| 28 mL | `GBCyl1ozRollWht` | `GBRoll28Blk` | `GBMtlRoll28Wht` | `GBMtlRoll28Blk` |
| 50 mL | `GBCyl50RollWht` | `GBCyl50RollBlk` | `GBCyl50MtlRollWht` | `GBCyl50MtlRollBlk` |

No Boston Round droppers, short caps, decorative caps, pumps, or sprays are compatible by inheritance. The jumbo family contains only the two roller fitments and the black/white overcaps evidenced by these eight exact catalog identities.

The live body contracts are now pinned directly in the recipe rather than inferred from Photoshop folder names:

- 28 mL `GBCyl1ozRollWht`: [exact product page](https://www.bestbottles.com/product/cylinder-style-28-ml-glass-bottle-plastic-roll-on-and-white-cap), 81 × 31 mm body, 100 mm capped, 16 mm neck, large roller ball.
- 50 mL `GBCyl50RollBlk`: [exact product page](https://www.bestbottles.com/product/cylinder-style-50-ml-glass-bottle-plastic-roll-on-and-black-cap), 98 × 37 mm body, 116 mm capped, 16 mm neck, large roller ball.

These measurements verify body identity and relative catalog scale. They do not approve the extracted roller pixels. The user subsequently confirmed the exact uncapped Photoshop folders as the intended source families; their plastic fitment layers are valid large-roller candidates. Current family-scale review assemblies still display bodies only so component pixels can be approved independently. The 28 and 50 mL families remain separate from the 9 mL roller family and require their own geometry/material review plus separate body placement calibration.

The eight PSDs have now been decomposed by responsibility. Plastic large-roller scenes are isolated reusable candidates. Metal roller scenes include duplicated glass neck and thread pixels and therefore remain source evidence until a deterministic mask removes only the neck pixels. Full findings and promotion gates are recorded in `docs/paper-doll-rig/JUMBO-ROLLON-16MM-COMPONENT-KIT.md`.

## Transform contract

For complete-assembly reviews, the builder finds the union of all assembly members in the registered source coordinate system, then maps that complete union into the family’s reviewed presentation zone. It applies the same uniform transform to:

- bottle body;
- exterior sprayer head or roller fitment;
- body-contextual dip tube;
- any future approved family-specific integration layer.

No member can receive an independent catalog scale. Detached overcaps and integration references receive no production placement from this source-registration step.

The 74 × 21 mm 9 mL record is an explicit body-only exception. It is scaled from its reported physical body contract for visual comparison, but it remains `manual-review-required` and is excluded from the production body-authority queue until a named identity decision proves it is a separate sold shell.

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
