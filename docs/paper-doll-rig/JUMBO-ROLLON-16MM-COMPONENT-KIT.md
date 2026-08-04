# 16 mm jumbo roll-on component kit

**State:** exact eight-product source matrix registered; the user-confirmed uncapped folders contain valid jumbo bodies and large-roller source assemblies; plastic fitments are separable candidates, metal fitments require deterministic neck removal; no geometry authority, production approval, release, or Sanity mutation

This family is the straight-sided 28 mL and 50 mL Cylinder massage roll-on sold by Best Bottles. It is not a Boston Round family and it inherits no Boston Round components.

## Locked product truth

| Capacity | Exact product | Body | Capped height | Neck | Applicator class |
|---|---|---:|---:|---|---|
| 28 mL | [`GBCyl1ozRollWht`](https://www.bestbottles.com/product/cylinder-style-28-ml-glass-bottle-plastic-roll-on-and-white-cap) | 81 × 31 mm | 100 ±1 mm | 16 mm | large roller ball |
| 50 mL | [`GBCyl50RollBlk`](https://www.bestbottles.com/product/cylinder-style-50-ml-glass-bottle-plastic-roll-on-and-black-cap) | 98 × 37 mm | 116 ±2 mm | 16 mm | large roller ball |

These contracts are user-confirmed and live-catalog verified. Neither body nor fitment may inherit the 9 mL 17-415 roller geometry or placement. Body identity and source-family identity are resolved. Roller-pixel geometry/material approval remains pending until the extracted component masks pass exact-alpha and assembly-context QA.

## Closed catalog scope

Each size has exactly four evidenced assemblies:

| Capacity | Plastic roller + white cap | Plastic roller + black cap | Metal roller + white cap | Metal roller + black cap |
|---|---|---|---|---|
| 28 mL | `GBCyl1ozRollWht` | `GBRoll28Blk` | `GBMtlRoll28Wht` | `GBMtlRoll28Blk` |
| 50 mL | `GBCyl50RollWht` | `GBCyl50RollBlk` | `GBCyl50MtlRollWht` | `GBCyl50MtlRollBlk` |

The Photoshop archive filenames retain older `GBCyl28...` source names. The runtime family registration stores the exact current catalog identities separately, so archive provenance is preserved without treating the filenames as compatibility truth.

Excluded by contract:

- droppers;
- Boston Round closures;
- decorative short or tall caps;
- reducers;
- lotion pumps;
- sprayers;
- any component inferred only from a shared diameter label.

## Source decomposition

Recipe:

- `docs/paper-doll-rig/jumbo-rollon-16mm-component-kit-decomposition.json`
- extraction command: `npm run paperdoll:jumbo-rollon-kit-review`
- current review output: `outputs/paper-doll-component-kit-reviews/16mm-jumbo-rollon/source-extraction-v2/`

All eight PSDs are SHA-pinned. The decomposition contains four responsibilities:

| Responsibility | Source result | Current disposition |
|---|---|---|
| plastic roller fitment | isolated large-roller PSD scenes in four assemblies | reusable-plate candidates; authority and placement not yet approved |
| metal roller fitment | ball and housing are welded to visible bottle-neck pixels in all four PSD scenes | valid material/assembly evidence; deterministic selection mask required before a reusable candidate exists |
| black/white overcap | detached PSD scenes in all eight assemblies | reusable-plate candidates; authority not approved |
| neck integration | plastic and metal source composites include body pixels | evidence only; never an independently selectable plate |

The metal source composite is intentionally separated from the directly extractable `jumbo-roller-fitment` lane. The system must not approve the duplicated glass neck and threads as closure pixels. The plastic source scenes are valid component candidates but remain detached from the body-scale review sheet because component approval and placement occur in the component-kit workflow.

## Real-file comparison

The review assets establish the following exact facts:

- the 28 mL plastic black and white fitments have identical 339 × 576 alpha masks;
- the 50 mL plastic sources are 399 × 697 and 396 × 698 and do not have identical alpha;
- the same white-cap pixels and alpha occur in all four white-cap PSDs at 496 × 515;
- the two 28 mL black-cap sources are byte-identical at 430 × 509;
- the two 50 mL black-cap sources are byte-identical at 438 × 509;
- the 28 and 50 mL black caps are not byte-identical to each other;
- all four metal-fitment scenes include glass neck and thread pixels.

These are diagnostics, not geometry approvals. A shared 16 mm product label does not prove that the 28 and 50 mL source pixels share one production authority. The safe current classification is:

- one physical component family candidate;
- separate 28 and 50 mL placement calibration;
- no shared cross-size authority until a clean measured component or calibrated rig render proves it;
- exact alpha clamp required before `geometryLocked=true`.

## Visible source defects and review gates

The white overcap source contains a repeated right-edge protrusion. Because the same pixels are duplicated across the white assemblies, duplication does not prove the silhouette is correct. It must be compared to a physical reference or clean measured render before authority approval.

Promotion requires:

1. create or approve one clean plastic roller authority per proven geometry group;
2. isolate the metal ball and plastic housing from the glass neck without inventing hidden insertion-plug pixels;
3. approve clean black and white cap silhouettes;
4. calibrate 28 mL and 50 mL placement separately on their registered bodies;
5. review all eight assemblies at the locked family scale;
6. run exact-alpha clamp verification for any enhanced material pixels;
7. record named pixel, geometry, placement, and assembly-context approvals;
8. cut a release only after those approvals.

Review extraction remains deliberately non-mutating:

- `productionEligible: false`
- `geometryLocked: false`
- `currentReleaseChanged: false`
- `sanityChanged: false`
