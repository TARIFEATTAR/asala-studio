# CYL-9ML Roller Pair Authority Replacement

**Status:** Approved for candidate staging
**Date:** 2026-08-02
**Scope:** The five locked CYL-9ML body plates and the PLASTIC/METAL roller fitments only

## Outcome

Replace the polluted legacy roller candidate in the active review surface with a clean natural-plastic roller and a matching metal-ball roller. Both variants use one deterministic silhouette and one binary authority mask. They enter the Production Candidate Bench for named review; they do not change the active release and cannot publish to Sanity.

## Decisions

1. The clean plastic render is the geometry master.
2. The metal roller is a material-only child: only the exposed ball receives the stainless-steel treatment. Its housing, collar, placement, and alpha are inherited from the plastic master.
3. The final pair is normalized to the existing CYL-9ML canonical canvas (`2080×2288`), mount axis (`1041`), pre-calibration contact line (`918`), and source width (`269`). The existing visible family calibration narrows this to `262 px` while preserving center and mouth contact.
4. The authority mask is derived from the measured non-transparent bounds of the real plastic file, reduced to the single 8-connected component, normalized with the pair, and made binary. No material-color or frame threshold is used.
5. Geometry lock is earned only after both beauty alphas equal the same authority mask byte-for-byte. Reference anchoring or a matching bounding box is insufficient.
6. The polluted legacy mask/version remains in immutable history as revoked audit evidence, but it is ineligible for preview selection or approval. It must not be deleted from the ledger.
7. The new pair is staged in private content-addressed Storage as candidates. The candidate job, QA, and original filenames remain immutable.
8. Plastic and metal must be inspected on all five locked body plates. A named user approves each candidate; approval creates an approved child but still does not mutate release membership.
9. Sanity publication remains locked. A separate, reviewed release cut is required after both roller candidates pass visual assembly review.

## Required gates

- Exact shared authority-mask alpha identity: pass for both variants.
- Single 8-connected authority silhouette: pass.
- Same canvas, bounds, axis, contact line, and uniform scale: pass.
- Opaque-white-fraction v1: pass (`≤5%`) for the repaired metal roller, calibrated against the measured legacy plastic (`0%`) and defective metal (`72.9467%`) files.
- Five-body assembly inspection: pending named visual approval in Studio.

## Studio behavior

- The inspector selects the newest reviewable candidate, not merely the newest completed attempt.
- A candidate whose own authority-mask SHA is revoked or whose blocking QA failed is audit-only and cannot displace a clean candidate.
- Parent-mask revocation continues to block new ordinary generations from the polluted release asset.
- Candidate approval is evaluated against the candidate's mask, not the revoked parent mask, allowing this explicit replacement path to repair the authority safely.
- The history row remains visible as `revoked · audit only`; its defective pixels are never mounted in the working canvas.

## Non-goals

- No overcaps, pumps, sprayers, or other cylinder sizes.
- No release membership changes.
- No live Sanity write.
- No silent deletion or overwrite of legacy bytes.
- No claim that the AI generation itself is geometry locked.
