# Best Bottles Ecommerce Image Pipeline Synthesis

## Purpose

This document synthesizes the attached Best Bottles ecommerce image pipeline PRD with Madison Studio's current Best Bottles image system. It is the implementation contract for making the pipeline more precise, stable, and safer for the Best Bottles launch.

Core rule: GPT Image 2 owns appearance and realism; Madison owns product truth, deterministic framing, QA state, Shopify assignment, and Convex/staging visibility.

## Product Truth Precedence

When there is doubt, use the current `bestbottles.com` commercial page as live selling evidence, then reconcile it against Convex product truth and Shopify/Grace SKU mappings. The Grace SKU is a variant key for pushes; it is not a reliable family classifier by itself.

Current example: the live Roll on Glass Bottles page shows clear and cobalt 5 ml Cylinder roll-ons, but the amber 5 ml roll-on is sold as Tulip (`GBTulipAmb5...`). Those amber rows may still carry `GB-CYL-AMB...` Grace SKUs, so any resolver that places them in the Cylinder workflow based only on `GB-CYL` is wrong. Use `websiteSku`, live Best Bottles page context, Convex `family`, and `productGroupSlug` before deciding the workflow lane.

## Current Madison Reality

Madison already has the main production pieces:

- Best Bottles Studio launches SKU-specific master generations through `useAssembledPromptGeneration` and `generate-madison-image`.
- The Edge function rebuilds Best Bottles prompts server-side from `productContext` and the Best Bottles family rig.
- `BestBottlesGenerationIdentity` blocks unresolved generic/gray SKU identities before generation.
- `familyRig` defines the canonical rig for Cylinder/Circle families: `2080 x 2288`, 13% baseline, uniform fit-to-box framing, no capacity-based size changes in the master.
- The browser-side Studio path now performs a lightweight post-generation baseline stabilization and patches `generated_images.image_url` before the Library treats the image as the usable master.
- Image Library can push approved Best Bottles images to Shopify and reconcile Shopify/Convex state.
- Pipeline SKU jobs already track per-SKU states from `ready-to-generate` through `shopify-pushed` and `synced`.

The PRD should not create a parallel pipeline. It should harden these existing lanes.

## Reconciled Pixel Contract

Use Madison's current canonical master, not the PRD's `2028 x 2288` value.

| Stage | Contract |
| --- | --- |
| Studio/GPT raw master | `2080 x 2288`, 10:11 |
| Deterministic PDP master | `2080 x 2288`, bone background `#F5F3EF` |
| Paper-doll/component canvas | `2080 x 2288`, 10:11 |
| Website/staging delivery | Downstream derivative from Shopify CDN/Next.js image layer |
| Square marketplace derivative | Later export only, not source of truth |

The PRD's trim/scale/center idea is correct, but its dimensions must be updated to `2080 x 2288`.

## End-to-End Target Flow

1. Source truth and reference intake
   - Ingest local PSD/reference assets into a standardized SKU + cap-state structure.
   - Normalize product cap state to a locked enum: `cap-on`, `cap-off`.
   - Treat legacy/descriptive terms such as `detached`, `exploded`, `uncapped`, or `cap-side` as ingestion aliases for `cap-off`; they are not stored as canonical product states.
   - Map each source reference to Grace SKU, website SKU, Shopify SKU, product group, family, capacity, body color/material, applicator, cap/trim/accessory details, and source path.
   - Do not infer family from Grace SKU prefix. If `graceSku` prefix conflicts with website SKU/live page/Convex family, keep the product in the live/Convex family lane and record a resolver-risk note.
   - Reject unresolved generic gray SKUs before generation.

2. Best Bottles Studio generation
   - Use GPT Image 2 only for Best Bottles Studio masters.
   - Send a reference-image edit request with opaque PNG output.
   - Preserve product identity from Image 1.
   - Apply the high-end Madison look: bone background, editorial photorealism, controlled drop shadow, backlight through glass, premium catalog polish.
   - Server prompt must separate identity truth, appearance direction, and rig authority.

3. Deterministic post-processing
   - Immediate path: keep the browser-side post-generation baseline pass because Supabase Edge has hit worker limits on 2080 x 2288 re-encode work.
   - Target path: move full deterministic framing into a dedicated Node/local worker or non-Edge service using Sharp/Pillow.
   - Required operations: background/alpha cleanup, trim foreground, fit to family rig, place on 13% baseline, enforce centerline, apply background, apply contact shadow after placement, export final PNG/WebP.
   - Two-object compositions must be framed as one assembly, with the detached cap sitting on the same baseline.

4. QA and approval gate
   - Images are not pushable until QA passes.
   - Pixel QA: exact canvas, baseline tolerance, centerline tolerance, full assembly visible, background color locked.
   - Identity QA: body color/material, applicator, cap/trim finish, tassel/bulb/hose/ring/reducer details match product truth.
   - Provenance QA: source reference, prompt version, rig version, identity hash, generation model, cap state, and postprocess version are stored.

5. Shopify and Convex sync
   - Shopify remains the published media source of truth.
   - Madison pushes only approved QA-passing images to the exact Shopify product/variant.
   - Push logs must record input SKU, matched Shopify SKU, actual Shopify SKU, product id, variant id, media id, Shopify CDN URL, image id, mode, and Convex update result.
   - Convex is a cache/serving layer. After Shopify push, Madison backfills Convex image URLs by Grace/website SKU and marks pipeline jobs `synced`.

6. Staging verification
   - The new Best Bottles staging site must surface the Shopify CDN image for the intended SKU/product group.
   - Verification should compare Madison approved image URL, Shopify CDN URL, Convex URL, and rendered staging URL.

## Data Model Additions

Madison should formalize image artifacts as lifecycle records, even if the first implementation stores them in `generated_images` metadata.

Required fields:

- `graceSku`
- `websiteSku`
- `shopifySku`
- `productGroupSlug`
- `family`
- `capacityMl`
- `bodyColor`
- `bodyMaterial`
- `applicator`
- `capState`
- `imageRole`: `reference`, `studio-master`, `final-pdp`, `final-hero`, `shopify-published`
- `sourceReference`
- `sourceReferenceKind`: `psd-extract`, `canonical-render`, `local-legacy`, `bestbottles-live`, `manual`
- `generationProvider`: `openai`
- `generationModel`: `gpt-image-2`
- `promptVersion`
- `rigVersion`
- `postprocessVersion`
- `identityHash`
- `qaStatus`: `pending`, `pixel-pass`, `identity-pass`, `approved`, `rejected`, `blocked`
- `qaMetrics`: canvas, baseline delta, centerline delta, foreground bounds, background color, halo score
- `approvedBy`
- `approvedAt`
- `shopifyProductId`
- `shopifyVariantId`
- `shopifyMediaId`
- `shopifyImageUrl`
- `convexSyncedAt`

For Supabase, this can start as `brand_context_used` / `library_tags` / existing pipeline job columns, then graduate into a dedicated `best_bottles_image_artifacts` table when we need richer auditing.

## PRD Adjustments

Adopt these from the PRD:

- Decouple AI enhancement from deterministic framing.
- Use SKU/cap-state folder structure for source assets.
- Keep only two canonical cap states: `cap-on` and `cap-off`.
- Treat PSD extraction and background cleanup as a first-class upstream lane.
- Require one-variant-at-a-time generation.
- Require human approval before Shopify push.
- Use Shopify push as the trigger for Convex/staging truth.
- Prefer fixed hero templates for launch over unique AI lifestyle scenes.

Modify these:

- Replace `2028 x 2288` with `2080 x 2288`.
- Do not use `1024 x 1024` for canonical Best Bottles masters. Masters stay `2080 x 2288`; derivatives can be generated later.
- Do not put heavy trim/scale/background-removal work in Supabase Edge until worker limits are resolved. Use browser/local/Node worker first.
- Treat current bestbottles.com selling pages as commercial evidence and legacy/cached pages as evidence, not automatic truth. Reconcile both against Convex/Shopify before generation or push.
- Treat Convex as the storefront cache and product truth mirror; Shopify media is the published image source.

## Implementation Plan

### P0: Stabilize Studio Masters

- Keep GPT Image 2 only for Best Bottles.
- Keep `BestBottlesGenerationIdentity` as a fail-closed gate.
- Extend rig support beyond Cylinder/Circle as families become active.
- Store postprocess metadata from the browser baseline pass in `generated_images`.
- Add visible QA badges for baseline/frame pass vs prompt-only output.

### P1: Source Asset Intake

- Build/import a source reference manifest with fields for SKU, cap state, source path, source type, dimensions, and alpha/background status.
- Add a folder naming validator for PRD-style assets.
- Add halo/white-rim audit for transparent PNGs.
- Link each source reference to `best_bottles_pipeline_sku_jobs.reference_source_*`.

### P2: Deterministic Framing Worker

- Build `standardizeBestBottlesImageFraming` outside Supabase Edge.
- Use Sharp/Pillow for alpha-aware trim, scale, center, baseline, and export.
- Make the worker idempotent by `identityHash + sourceReference + promptVersion + rigVersion + postprocessVersion`.
- Output canonical final paths:
  - `best-bottles/final/pdp/[cap-state]/[graceSku].png`
  - `best-bottles/final/hero/[template]/[graceSku].png`

### P3: Approval and Push Gate

- Prevent Shopify push unless `qaStatus` is approved and identity checks pass.
- Preserve manual override, but require reason/reviewer/date.
- Ensure push functions validate expected visual identity against SKU truth before upload.

### P4: Convex/Staging Verification

- After push, reconcile pipeline jobs from Shopify publish logs.
- Backfill Convex with Shopify CDN URLs.
- Add staging audit rows: Madison image, Shopify image, Convex image, rendered staging image, status.

## Launch Policy

For the immediate Best Bottles launch:

- PDP first, hero second.
- Fixed hero templates, not freeform unique scenes.
- Do not push unresolved generic gray SKUs.
- Do not push prompt-only images with visible baseline drift.
- Do not trust Shopify admin screenshots alone; verify Madison -> Shopify -> Convex -> staging.

## Open Decisions

- Exact sandstone hero background hex.
- Whether final Shopify upload should use PNG or generated WebP derivative.
- Whether artifact metadata should remain in `generated_images` JSON fields or move into a dedicated `best_bottles_image_artifacts` table before broad generation.
- Which families get rig configs next after Cylinder and Circle.
