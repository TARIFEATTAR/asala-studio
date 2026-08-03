# 20-400 Short Fluted Cap — Profile Review Candidate

**State:** local dimension-calibrated candidate; not geometry locked; material not approved

**Recipe:** `docs/paper-doll-rig/short-fluted-cap-20-400-family-recipe.json`

**Candidate manifest:** `outputs/paper-doll-parametric-overcaps/20-400-short-fluted-cap/candidate-v1/candidate-manifest.json`

## One output, two preserved identities

- `20-400Cp2ozShortBlk`
- `20-400cp1ozShortBlk`

Both canonical component rows independently record **23 ±0.5 mm** outside diameter and **12 ±0.5 mm** height. Both source URLs resolve to the same SHA-256 (`d643fb5534c248667e4332cc4ac46497134af45023c92721256d542fd8edf7ef`), their normalized silhouette IoU is `1.0000`, and both rows map to Grace SKU `CMP-CAP-BLK-20-400`.

The recipe therefore renders one `BLK` plate and preserves the 1 oz identity as an explicit source alias. This is catalog deduplication, not a discarded mapping.

## Geometry versus review parameters

- The 23 × 12 mm shell, rounded top shoulder, and lower flange form one physical profile candidate.
- The source visibly contains recessed vertical grip geometry; a smooth cap would erase a real structural responsibility.
- The 32-flute count, depth, and fade zones are source-derived review parameters, not verified tooling dimensions.
- Glossy-black material pixels remain separate from the geometry claim and may be reconstructed later within the exact authority mask.

The local candidate has exact authority alpha and no detached regions. It does not earn geometry authority, compatibility, family placement, production eligibility, Current Release membership, or Sanity publication. No remote state changed.
