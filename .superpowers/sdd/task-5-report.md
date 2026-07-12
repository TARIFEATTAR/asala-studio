# Task 5 report: rig honors shadow ownership

## Scope

Integrated the Task 4 model-owned shadow analyzer into rig post-processing and the Best Bottles generation workflow. Only the four Task 5 files were changed for this implementation; no provider calls, migrations, deployments, or paid-image generation were performed.

## Contract implemented

- Added `RigBaselineNormalizeOptions.shadowOwner` with a safe `rig` default and returned `RigBaselineNormalizeResult.shadowOwner` plus `shadowQa` on every return path.
- Added `prepareUnmaskedRigRecanvasPixels(..., { preserveMask })` support and `preservedShadowPixels`, preserving model-owned source pixels through Bone recanvas and the same scale/translation as the product.
- Added exported `finalizeRigShadow(input)`: model ownership runs `analyzeModelOwnedShadow` and paints zero deterministic pixels; rig ownership keeps the existing deterministic contact-shadow pass and returns `shadowQa: null`.
- Kept model shadow pixels out of final geometry bounds/baseline measurements by removing the preservation mask from geometry analysis and constraining final baseline/bounds to the transformed product control envelope.
- Passed owner/contract policy through `productContext`, added policy tags to Library tags, passed owner into normalization, and persisted uploaded model candidates as `qa-passed`, `qa-failed`, or `review-pending` according to shadow QA. Geometry QA failures still throw unchanged; model shadow review/failure does not trigger deterministic fallback or discard the uploaded candidate.

## Verification

TDD RED was verified with `npx tsx --test --test-name-pattern='shadow owner|model-owned shadow mask' src/lib/product-image/rigPostprocess.test.ts` (missing `finalizeRigShadow` export). GREEN and focused verification passed:

- `npx tsx --test src/lib/product-image/shadowQa.test.ts src/lib/product-image/rigPostprocess.test.ts src/lib/product-image/familyRig.test.ts src/lib/bestBottlesImageReconciliation.test.ts` — 54 passed, 0 failed.
- `npx tsc --noEmit` — passed.
- Targeted ESLint — 0 errors; existing warnings remain in the dirty Task 1–4/UI files.

## Review / concerns

Model-owned shadow lifecycle state is persisted through the existing reconciliation API's lifecycle and QA issue fields; the schema has no dedicated shadow columns. The existing `RigReviewPanel` therefore receives a review/failure issue through `rigReview.qaIssues`, allowing Task 6's approval gate to block it. No known correctness concerns remain for the Task 5 scope.

## Task 5 review fixes (a722492 follow-up)

- Enforced the exact SKU policy in `useAssembledPromptGeneration`: only `GB-SPR-CLR-3ML-BLK` resolves to model/V6.1/contact-back-right-v1. Caller-supplied `productContext.shadowOwner`/`shadowContract` are canonicalized to the resolver output for payload tags and rig normalization, so non-smoke SKUs cannot opt into model ownership and the smoke SKU cannot silently fall back to rig.
- Added an all-candidate `candidateMask` to the model shadow analysis contract and a rig-side geometry-only mask helper. Mask-controlled QA/bounds now run after model shadow removal, while output preservation still uses only the retained component mask. Unmasked geometry removes disconnected candidates and continuation/overlong tails, and derives a conservative baseline before frame transforms so shadow pixels cannot inflate fill, baseline, centerline, or bounds metrics.
- Fixed the no-baseline fallback to skip `applyRigForegroundMatte` for model ownership and route both ownership branches through `finalizeRigShadow`; model fallback returns deterministicShadowPixels=0 with shadow QA review, while rig fallback retains its existing behavior. Geometry QA throw behavior remains unchanged.
- Added regressions for model fallback review/no-paint and for disconnected plus overlong shadow components being excluded from geometry bounds. The candidate-mask field is an intentionally small extension to the Task 4 analyzer result, required to distinguish the retained preservation component from invalid shadow candidates.

## Review-fix verification

- `npx tsx --test src/lib/product-image/shadowQa.test.ts src/lib/product-image/rigPostprocess.test.ts src/lib/product-image/familyRig.test.ts src/lib/bestBottlesImageReconciliation.test.ts` — 56 passed, 0 failed.
- `npx tsc --noEmit` — passed.
- `npx eslint src/lib/product-image/rigPostprocess.ts src/lib/product-image/rigPostprocess.test.ts src/lib/product-image/shadowQa.ts src/hooks/useAssembledPromptGeneration.ts` — 0 errors; 5 pre-existing warnings (one unused variable in the hook and four hardcoded-color warnings in rig postprocess).

## Review-fix concerns

The unmasked baseline guard intentionally targets only contiguous, low-density, low-contrast tails; it leaves dense product rows intact and falls back to the original baseline when the signal is ambiguous. No provider calls, migrations, deployments, or paid generation were performed.

## Final review closure

- Reconciliation persistence and the calibrated precompiled prompt record now canonicalize `prompt_version`, `shadow_owner`, `shadow_contract`, and policy QA tags from the exact SKU policy. Conflicting caller metadata is removed only for Best Bottles studio masters; unrelated Dark Room requests retain their own tags.
- Candidate masking now scans continuation pixels even when the primary analyzer lane has no connected component, so detached/overlong dark tails cannot leak into geometry metrics. A dark-shadow baseline regression covers the high-contrast case.
- Final review verification: exact Task 5 covering suite — 57 passed, 0 failed; policy/reconciliation regression suite including `bestBottlesShadowPolicy.test.ts` — 60 passed, 0 failed; `npx tsc --noEmit` — passed; targeted ESLint — 0 errors and 5 existing warnings.
- The final geometry pass also clamps every row below the model baseline to the product control envelope, covering dark pixels outside the analyzer's local lane without touching source/output pixels.
- Mask-controlled recanvas now disables matte shadow painting before `finalizeRigShadow` for both ownership branches, preventing model paint and rig double-paint. Direct normalization resolves ownership from the exact SKU policy (including smoke defaulting to model), and stale `prompt:<version>` tags are filtered with the other shadow-policy metadata.
- Final gate verification after these fixes: Task 5 covering files — 59 passed, 0 failed; including policy lineage regressions — 62 passed, 0 failed.
