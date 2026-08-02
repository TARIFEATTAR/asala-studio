# Madison Studio pipeline — one-page executive summary

**Status:** Evidence reviewed 2026-07-15. No generation, upload, database mutation, or production-code change was performed for this report.

## What was going wrong

The current production master asks one AI model to rebuild an entire product from a flattened image: bottle shape, glass, cap, fitment, internal tube, lighting and shadow. The prompt is detailed, but there is no component mask, depth order, seed, 3D model or deterministic cap compositor. A result can look beautiful while still containing the wrong closure, incorrect proportions, missing internal hardware or an inconsistent scale.

The browser then measures the visible product envelope and can rescale, translate and normalize the whole raster. This improves baseline, center and canvas consistency, but it cannot repair a semantically wrong product. Acting on the whole raster can also affect glass edges, shadows and transparency.

## What Madison already has

- Canonical SKU and body measurements.
- Separate cap-on and sidecar role concepts.
- Approved product-reference and style-reference roles.
- A fixed 2080×2288 catalog canvas.
- Family scale, baseline and centerline contracts.
- Framing and shadow evidence.
- Human identity/applicator/surface review.
- Reconciliation and controlled Shopify/Sanity publishing.
- A new non-publishable material-pilot attempt ledger with renderer, prompt, references, hashes, time, failures and cost fields.

## What the material-master system adds

The exact SKU product reference remains the sole authority for geometry, closure, component count and role. A separate approved material master may influence only glass quality, color/depth, wall/base appearance, refraction, highlights, lighting, Bone tone and restrained shadow style. That separation is already explicit in prompts and reference ordering, but it is not yet mechanically isolated by component layers or semantic vision.

## What the bounding-box system does

Madison detects the visible product and a primary-bottle lane, centers the bottle at X=1040, and seats it near Y=2082 on the 2080×2288 canvas. It evaluates a product-specific fill-height band, baseline (warning beyond ±4 px, failure beyond ±8 px), centerline (±2.5 percentage points), width and crop. In detached-sidecar images it keeps the bottle as the center authority. A durable semantic detached-cap box is not consistently stored today.

## Confirmed production blockers

1. Two active Bone values exist: canonical/pilot `#F5F3EF` and visual-target/browser-rig `#F6EFE8`.
2. Not every SKU × role has one signed immutable reference manifest.
3. Pilot body-scale QA remains `measurement-required`; rendered body-only and sidecar bounds are not yet extracted automatically.
4. Role-semantic QA is a human checklist, not an automated product check.
5. Pilot price cards are not populated with real usage/cost; one recorded OpenAI attempt took about 131 seconds but has no actual cost or human approval.
6. The normal production path can still normalize/resample the complete raster after generation.

## Recommended production gate

Do not start the catalog-wide Cylinder batch yet. First:

1. Select one Bone token.
2. Sign the role-specific cap-on and sidecar source manifests.
3. Route every paid attempt through the attempt ledger.
4. Extract and persist bottle-body and sidecar bounds.
5. Activate role/material/closure/component semantic QA.
6. Run a blinded Cylinder cohort covering clear, cobalt, amber, frosted, cap-on, sidecar, roller and visible internal hardware.
7. Report first-pass approval, final approval, failure reasons, time and actual/estimated cost per approved image.

The target is not a single excellent image. It is a lane that proves the same product truth, scale and material standard repeatedly, with failures blocked before publishing.

## Evidence artifacts

- [Full technical report](./MADISON_STUDIO_PIPELINE_EVIDENCE_REPORT_2026-07-15.md)
- [Annotated Cylinder bounding-box diagnostic](./madison-studio-pipeline-evidence-2026-07-15/annotated-cylinder-bounds.png)
- [Current-versus-target pipeline diagram](./madison-studio-pipeline-evidence-2026-07-15/current-vs-target-pipeline.svg)
