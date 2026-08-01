# Best Bottles Cylinder Generation and Shopify Audit

**Audit date:** 2026-07-23  
**Mode:** Read-only reconciliation  
**Madison source:** Supabase project `likkskifwsrvszxdvufw`  
**Catalog source:** Best Bottles Convex product export via `audit:product-truth -- --family Cylinder`

## Executive result

The current Madison Cylinder tracker contains **385 persisted SKU rows** across **54 product groups** from 3 ml through 454 ml.

| Evidence state | Persisted SKU rows | Meaning |
|---|---:|---|
| Linked generated/approved image evidence | 287 | A Madison generated or approved image ID/URL is linked to the SKU job |
| No linked generated/approved image evidence | 98 | Still needs generation or tracker/image-link reconciliation |
| Recorded Shopify destination evidence | 280 | Madison has a Shopify media ID, image URL, push timestamp, terminal Shopify status, or Convex-sync evidence |
| Generated but no recorded Shopify destination | 7 | Generated result exists but no Shopify destination is recorded |
| `approved-keep` quality verdict | 2 | The only rows that currently satisfy the strict final-quality gate |
| Shopify destination without `approved-keep` | 278 | Live/pushed evidence exists, but final Cylinder quality review is not recorded |
| Distinct linked `generated_images` rows | 97 | Multiple SKU jobs currently share linked image rows |

These numbers describe persisted tracker rows, not canonical publication identities. After collapsing duplicate website SKUs, Madison contains **378 unique website targets: 286 with image evidence, 92 without, and 279 with recorded Shopify evidence**.

## Canonical-count reconciliation

The three systems do not currently have the same Cylinder count:

| Source | Count |
|---|---:|
| Canonical Cylinder V6.1 publication contract | 377 |
| Convex products classified as Cylinder | 382 |
| Madison persisted Cylinder SKU rows | 385 |
| Madison distinct website SKUs | 378 |

The canonical contract expects 384 auditable source rows collapsing to 377 publication targets. Madison currently contains seven duplicated website-SKU pairs:

- `GBCyl100RdcrMtSl`
- `GBCyl100RdcrShnBlk`
- `GBCyl50RdcrMtSl`
- `GBCyl50RdcrShnBlk`
- `GBCyl5WhtSht`
- `GBCylSwrl9MtlRollWht`
- `GBCylSwrl9RollWht`

Those seven duplicate pairs explain 385 rows collapsing to 378 distinct website SKUs. The remaining one-target difference from the canonical 377 is consistent with the separately documented Tall Cylinder alias policy and must be resolved before treating a tracker percentage as canonical closeout completion.

## Smallest-to-largest capacity rollup

| Capacity | Tracker rows | Image evidence | Recorded in Shopify | Still to generate/link | Generated, pending Shopify | `approved-keep` |
|---:|---:|---:|---:|---:|---:|---:|
| 3 ml | 2 | 2 | 2 | 0 | 0 | 2 |
| 4 ml | 2 | 2 | 2 | 0 | 0 | 0 |
| 5 ml | 61 | 59 | 59 | 2 | 0 | 0 |
| 9 ml | 209 | 140 | 134 | 69 | 6 | 0 |
| 25 ml | 8 | 1 | 0 | 7 | 1 | 0 |
| 28 ml | 4 | 0 | 0 | 4 | 0 | 0 |
| 30 ml | 2 | 0 | 0 | 2 | 0 | 0 |
| 50 ml | 49 | 39 | 39 | 10 | 0 | 0 |
| 100 ml | 45 | 44 | 44 | 1 | 0 | 0 |
| 118 ml | 1 | 0 | 0 | 1 | 0 | 0 |
| 227 ml | 1 | 0 | 0 | 1 | 0 | 0 |
| 454 ml | 1 | 0 | 0 | 1 | 0 | 0 |
| **Total** | **385** | **287** | **280** | **98** | **7** | **2** |

The dominant generation backlog is 9 ml (69 rows), followed by 50 ml (10), 25 ml (7), 28 ml (4), 5 ml (2), 30 ml (2), and one each at 100, 118, 227, and 454 ml.

## Shopify truth: two different questions

“In Shopify” must be split into two non-equivalent facts:

1. **Recorded Madison push/destination evidence:** 280 persisted tracker rows (279 distinct website SKUs).
2. **Current Convex products carrying a Shopify CDN media source:** 372 of 382 Convex Cylinder products.

The second number includes existing catalog media and does not prove that Madison generated or pushed that media. The first number is the correct measure for Madison’s recorded publication workflow.

The Convex product-truth audit found **10 medium-severity missing-Shopify-media products**, all currently falling back to legacy media:

- 25 ml lotion-pump SKUs: `LB-CYL-CLR-25ML-LPM-MGLD`, `SGLD`, `SBLK`, `MSLV`, `SSLV`, and `CPR`
- 28 ml roll-on SKUs: `GB-CYL-CLR-28ML-MRL-01`, `GB-CYL-CLR-28ML-MRL-02`, `GB-CYL-CLR-28ML-RBL`, and `GB-CYL-CLR-28ML-RBL-WHT`

## Tracker correction

The Pipeline tracker now exposes separate counts for:

- generated image evidence;
- Shopify destination evidence;
- still to generate/link;
- final `approved-keep` quality approval.

This prevents the prior “PDP live”/quality gate from hiding the actual generation and publication progress, while still preserving the strict rule that a pushed or Convex-synced image is not final-quality-approved until it carries `status:approved-keep`.

## Remaining risks

- The 98-row generation figure is a persisted-row backlog. It becomes 92 after duplicate website-SKU collapse and should become a canonical-target number only after the Tall Cylinder alias is removed from competing publication scope.
- Only two rows have final `approved-keep` tags. Therefore **278 recorded Shopify destinations still require a durable quality verdict** even though they may already be visible downstream.
- Ninety-seven distinct linked image rows serve 287 SKU jobs. Shared-image relationships should be reviewed where SKU-specific applicator, finish, or color identity is expected.
- The tracker was not mutated during the audit; only its calculation and display code were updated.
