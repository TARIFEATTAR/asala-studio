# Best Bottles V6 Model-Owned Shadow Smoke Test

## Objective

Test whether GPT Image 2 can produce a more natural, slightly longer back-right grounding shadow for the black 3 ml fine-mist sprayer without changing the existing catalog-wide V6 prompt or allowing Madison's rig to add a second shadow.

The experiment targets exactly one Grace SKU:

- `GB-SPR-CLR-3ML-BLK`
- Website SKU `GBSpry3mlClBlk`
- Product group `cylinder-3ml-clear-12mm-finemist`

The existing `best-bottles-reference-locked-v6.0` behavior remains the default for every other SKU.

## Decision

Create the experimental prompt version `best-bottles-reference-locked-v6.1-shadow-smoke` with explicit shadow ownership set to `model`.

For this version:

- GPT Image 2 renders the complete contact shadow.
- Madison continues to enforce canvas, product identity, background, scale, fill height, baseline, centerline, bounds, and reconciliation evidence.
- Madison preserves and measures the model-rendered shadow but does not call its deterministic shadow painter.
- The generated image remains an unreviewed candidate until both machine QA and human review pass.
- The experiment never replaces or republishes an existing approved image automatically.

Model-owned and rig-owned shadow instructions must never appear together in one resolved server prompt or one post-processing run.

## Authoritative Prompt Block

The experimental prompt contains one and only one controlling shadow block:

```text
GROUNDING SHADOW — MODEL OWNED:
Render one soft, clearly visible contact shadow attached directly to the bottle base. It must be darkest and most concentrated at the physical contact line, approximately 32–42% opacity at its densest point, then feather softly behind and toward camera-right, fading within approximately 20–30% of the bottle's width. The contact core and extended feather must read as one continuous shadow. One soft key light creates one soft-edged shadow. No detached oval, gap beneath the bottle, hard outline, long dramatic cast, doubled shadow, reflection, floor plane, smear, or horizon.
```

The opacity percentage is a visual direction for the image model, not a literal alpha-channel requirement. Machine QA evaluates measurable density and continuity relative to the known Bone canvas instead of assuming that opaque PNG pixels expose a recoverable shadow alpha value.

## Prompt Authority and Assembly

The current V6 path contains several deterministic-shadow prohibitions. Appending the new block would create a contradiction, so the experiment must select a coherent shadow policy during prompt assembly.

For the one allowlisted SKU and experimental prompt version:

1. The clear-glass identity block continues to prohibit invented glass detail but no longer says that the contact shadow is a post-processing responsibility.
2. The framing profile continues to reserve background color for deterministic normalization but replaces the deterministic-shadow directive with the model-owned block.
3. The studio-direction block permits only the declared model-owned contact shadow while retaining all prohibitions on floor planes, reflections, horizons, smears, and background texture.
4. The final studio check remains last and explicitly recognizes the experimental shadow policy as part of the resolved Madison framing contract.
5. The server-side precompiled-prompt resolver preserves the experimental block instead of canonicalizing it back to the V6 deterministic-shadow direction.

The prompt QA checklist and Library lineage tags must include:

- `prompt-version:best-bottles-reference-locked-v6.1-shadow-smoke`
- `shadow-owner:model`
- `shadow-contract:contact-back-right-v1`
- `shadow-smoke-sku:GB-SPR-CLR-3ML-BLK`

The Edge Function must fail closed if `shadow-owner:model` is requested for any SKU outside the exact allowlist.

## Rig Data Flow

1. Generate one new raw image with the experimental precompiled prompt and the approved PSD-derived product reference.
2. Detect product bounds and baseline on a shadow-excluded analysis clone so the shadow cannot inflate fill height, move the centerline, or redefine the product baseline.
3. Identify a restricted shadow lane connected to the detected bottle base. The lane is limited to the local baseline region and the allowed back-right spread; it cannot include a floor plane, horizon, or unrelated background mark.
4. Normalize the source canvas to Best Bottles Bone while preserving eligible model-shadow pixels inside that lane.
5. Apply the normal product scale and translation to the product and preserved shadow together so their physical relationship remains unchanged.
6. Re-measure product geometry independently of the shadow.
7. Run shadow-specific QA against the final image.
8. Skip `addDeterministicContactShadow` because the active shadow owner is `model`.
9. Save the raw URL, final candidate URL, prompt version, shadow ownership, product geometry, shadow measurements, and QA decision in the reconciliation record.

The existing rig-owned path remains unchanged for V6.0 and every non-allowlisted SKU.

## Shadow QA Contract

Machine QA must validate these properties without treating the shadow as product geometry:

- **Contact:** visible shadow density begins at the bottle base with a contact gap of no more than 2 pixels.
- **Core:** the darkest local density occurs in the contact band at the base rather than in a detached lower oval.
- **Continuity:** the contact core and back-right feather form one connected shadow region.
- **Direction:** the dominant extension is toward camera-right; a small left feather is allowed only as part of the contact core.
- **Spread:** the visible back-right feather ends within 20–30% of the measured bottle width, with a small antialias tolerance.
- **Depth:** vertical depth remains locally restrained and cannot resemble a floating oval or a second object.
- **Singularity:** only one shadow region is present; no doubled shadow, reflection, smear, floor seam, or horizon is allowed.
- **Geometry isolation:** product fill height, baseline, centerline, and object bounds pass independently of shadow pixels.

If shadow pixels cannot be distinguished reliably from product or background, the image is `review-pending`, never machine-approved.

## Human Review

The smoke candidate must be reviewed with geometry overlays enabled. Approval requires confirmation that:

- the product is the exact black 3 ml sprayer SKU;
- the clear overcap, black fine-mist pump, glass body, spring, and dip tube remain correct;
- the bottle is visibly seated on the baseline;
- the shadow reads as attached, natural, slightly longer behind/camera-right, and more photographic than the deterministic V6.0 comparison;
- no product deformation, floor plane, two-tone seam, reflection, or duplicate shadow was introduced.

The V6.0 comparison and V6.1 smoke candidate should be viewed side by side at identical canvas scale.

## Failure Handling and Rollback

- Prompt-policy mismatch: block generation before provider invocation.
- Non-allowlisted SKU: reject the experimental version before provider invocation.
- Missing shadow evidence: retain the candidate as QA-failed or review-pending; do not add a fallback deterministic shadow to the same image.
- Geometry failure: reject through the existing rig QA path.
- Visual failure: mark the candidate `needs-regen`; preserve it as history without changing the approved image.
- Experiment rollback: remove the exact-SKU version assignment. V6.0 rig-owned shadow behavior resumes without a catalog migration.

No Shopify push, Convex synchronization, approved-image replacement, or catalog-wide prompt promotion occurs as part of the smoke test.

## Verification

Before a paid smoke generation:

- prompt tests prove the experimental server prompt contains the single model-owned block;
- prompt tests prove the experimental prompt contains no deterministic-shadow prohibition;
- prompt tests prove V6.0 remains byte-for-byte unchanged for non-allowlisted SKUs;
- Edge Function tests reject `shadow-owner:model` for every other SKU;
- rig tests prove model-owned mode preserves an attached back-right shadow lane and skips deterministic shadow painting;
- rig tests prove shadow pixels do not affect fill height, baseline, centerline, or product bounds;
- QA tests reject a detached oval, gap, double shadow, excessive spread, floor seam, and horizon;
- reconciliation tests persist prompt and shadow ownership lineage;
- focused tests, TypeScript, and the production build pass.

After those checks, run exactly one paid generation for `GB-SPR-CLR-3ML-BLK`. The output remains unreviewed until the side-by-side human review is completed.

## Success Criteria

The experiment succeeds only if the new candidate:

- passes product truth and all existing rig geometry gates;
- passes the shadow QA contract;
- has a continuous contact-attached shadow with a visibly improved back-right feather;
- is preferred over the current deterministic-shadow comparison during human review;
- introduces no product, background, or provenance regression.

Only a successful smoke review can justify a separate proposal for expanding model-owned shadow rendering beyond this one SKU.
