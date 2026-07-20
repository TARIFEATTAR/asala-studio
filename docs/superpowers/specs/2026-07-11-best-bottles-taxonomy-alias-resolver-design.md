# Best Bottles Taxonomy Alias Resolver

## Objective

Prevent legitimate Best Bottles products from being blocked when the website's commercial family name differs from Madison's geometric rig family, without weakening exact SKU, PDP, catalog, or approval safeguards.

## Decision

Introduce a single runtime resolver that converts an audited website-truth row into an effective status. It may normalize only these explicit aliases:

- `Spray Bottle` to `Cylinder`
- `Tall Cylinder` to `Cylinder`

An alias is eligible only when the row is in the PDP lane, Grace and Convex Grace SKUs match exactly, both website and Grace SKUs are present, the product-group slug belongs to the expected geometric family, and no duplicate-SKU or missing-Convex issue is present.

`Vial` is not a general alias because glass-wand vials and roll-on/cylinder products can share misleading naming. Those rows remain fail-closed unless individually reconciled.

## Data Flow

1. Studio loads the static website-truth audit row.
2. The resolver returns the effective row and effective status.
3. Generation gating uses the effective row.
4. Live-recovery UI uses the effective row so a valid alias is not presented as a red conflict.
5. The generation catalog-truth snapshot stores `alias_exception`, allowing the existing approval RPC to accept the same evidence.

The original audit fields remain available for traceability. No Convex, Shopify, Sanity, SKU, slug, image, or product record is modified.

## Failure Handling

The resolver remains blocked when any of these conditions applies:

- component lane;
- missing audit row;
- duplicate Convex website SKU;
- missing Convex row;
- blank or mismatched Grace identity;
- unrelated family pair;
- product-group slug outside the normalized geometric family;
- any future conflict not explicitly covered by the allowlist.

## Verification

Regression tests must prove:

- the white 3 ml sprayer resolves to `alias_exception`;
- its black sibling remains accepted;
- exact Spray Bottle/Cylinder and Tall Cylinder/Cylinder cohorts normalize;
- duplicates, missing rows, components, bad Grace identity, unrelated families, and ambiguous Vial/Cylinder rows remain blocked;
- the effective status is the value passed into the generation catalog-truth snapshot;
- targeted tests and the production build pass.

## Rollout

This patch changes the localhost Studio runtime only. After verification, run the white 3 ml Generate-to-Approve smoke test. Static website-truth regeneration and frontend deployment are separate follow-up operations and must not be implied by the local patch.
