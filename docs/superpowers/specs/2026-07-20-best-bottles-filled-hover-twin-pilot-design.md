# Best Bottles Filled Hover Twin Pilot

Date: 2026-07-20
Status: Proposed for Jordan review

## Objective

Prove one catalog-hover pair in which an approved Best Bottles marketing scene appears empty by default and reveals the same bottle filled with perfume oil on hover. The two assets must share the same bottle exterior, cap, platform, camera, crop, lighting, background, and model-owned shadow. Only the transparent bottle interior may change.

Pilot identity: `GB-CYL-CLR-9ML-ROL-BKDT-02`.

Pilot scene: pale limestone/travertine low plinth, straight-on camera, shared hero-grid baseline, restrained upper-front-left light, warm translucent amber oil at 70% fill.

## Safety Boundary

This is a marketing-only experiment and must not enter the PDP publication chain.

- Never write the empty or filled pilot asset to Shopify media.
- Never write either asset to Convex `products.imageUrl` or `products.imageUrlCapOff`.
- Never update `best_bottles_pipeline_sku_jobs`, product-reference approval, or PDP reconciliation assignments.
- Never classify either asset as `pdp-primary` or `pdp-secondary`.
- Never auto-promote, auto-approve, or auto-publish an asset.
- Never replace the approved empty PDP master.
- Sanity publishing remains dry-run by default and requires an explicit `--apply` or later explicit UI confirmation.
- The storefront hover remains behind a default-off feature gate until Jordan approves the pair.

The pilot reuses source images by reference and never moves, renames, deletes, or overwrites source files.

## Current Capabilities and Gaps

Madison already provides:

- Scene-Flexible marketing generation with selectable GPT Image 2 or Nano Banana.
- Liquid color and fill-percentage controls through `LiquidSpec`.
- Parent/child refinement lineage in `generated_images`.
- GPT Image 2 reference editing through `/v1/images/edits`.
- Sanity-only marketing-asset schema and a dry-run-first publisher.

The pilot must close these gaps:

- Best Bottles precompiled prompts currently omit the assembled `LiquidSpec` block; the pilot avoids changing that PDP path by carrying structured liquid fields through its dedicated request.
- The generic Image Editor does not expose structured liquid controls or an explicit provider.
- The generic refinement caller sends the parent explicitly while the edge function also auto-includes it, producing a duplicate parent reference.
- The OpenAI provider wrapper does not currently accept an edit mask.
- Sanity has no atomic empty/filled pair document.
- Catalog cards render one active image and have no paired hover layer.

## Recommended Architecture

### 1. Empty marketing-scene parent

Generate the base scene through `Master · Scene-Flexible` with the hero-grid baseline enabled. The operator may use Nano Banana Pro or GPT Image 2 for this aesthetic base. The result stays in Madison's marketing/scene lane.

Jordan must explicitly approve the base image before the filled-twin action is enabled. Approval here means approval for the pilot marketing pair only, not PDP approval or product-image publication.

### 2. Dedicated `Create Filled Twin` action

Add a focused action on an approved marketing/scene library image. Do not overload the normal Generate or PDP Approve controls.

The action collects:

- Parent generated-image ID
- Exact Grace SKU and website SKU from inherited tags
- Liquid color
- Fill percentage
- Filled-twin provider
- Reviewed interior edit mask

The pilot defaults to warm translucent amber and 70% fill. GPT Image 2 is the required filled-twin provider for the first pilot because the existing reference-edit endpoint is the strongest fidelity path. The empty base may still originate from either provider. Nano Banana filled-twin support remains a later comparison lane and cannot be called pixel-identical until it passes the same exterior-preservation gate.

### 3. Dedicated marketing refinement request

Create a separate `generate-bestbottles-filled-twin` edge function and a separate client request builder. Do not add a filled-twin mode or branch to `generate-madison-image`, and do not modify the authoritative PDP prompt assembly path. The dedicated function accepts only the marketing-hover contract and categorically refuses PDP roles and destination-write instructions.

The function may reuse narrowly scoped, side-effect-free authentication, storage, and provider helpers, but it must not call PDP reconciliation, product-image persistence, SKU-job, Shopify, or Convex product mutation code. Its only allowed persistence is a Madison library child record carrying filled-twin lineage and QA status.

The request uses the approved empty scene exactly once as Image 1. It must not automatically add the same parent a second time. It includes a compact liquid-only instruction rather than the entire PDP generation prompt.

Required instruction:

- Add perfume oil only inside the permitted transparent cavity.
- Preserve the bottle exterior, cap, roller assembly, platform, background, lighting, highlights outside the cavity, and shadow.
- Render a physically plausible meniscus at 70%, slightly deeper color near the base, and realistic absorption/refraction through the glass.
- Do not add labels, text, bubbles, suspended particles, a dip tube, a second bottle, or any scene change.

### 4. Reviewed interior edit mask

Extend the OpenAI edit wrapper with an optional `mask` part for the filled-twin request only. The existing PDP mask/control prohibition remains unchanged.

The mask permits model changes only inside the bottle's transparent internal cavity. It excludes:

- Outer glass silhouette and edge highlights
- Neck threads, roller ball, plug, and cap
- Bottle base exterior
- Plinth, background, and shadow

For the pilot, Madison presents the proposed cavity region as an overlay and requires an operator confirmation before the paid edit. Code defines and validates the allowed edit region; the model owns all liquid beautification inside it. Code never paints, composites, recolors, or manufactures the liquid.

### 5. Pair QA

The filled result is rejected unless all gates pass:

- Same pixel dimensions and aspect ratio as the empty parent
- Same SKU and parent-image lineage
- No material pixel change outside the allowed edit mask, except a minimal codec tolerance if the provider does not return byte-identical PNG pixels
- Bottle silhouette, cap, roller assembly, platform edge, baseline, and shadow remain unchanged
- Liquid remains inside the glass cavity
- Fill level is within 70% ± 3%
- A coherent meniscus is visible
- No liquid tint leaks into the background, cap, platform, or empty space above the meniscus

Failure creates a library-only rejected child and never publishes or replaces either image.

### 6. Madison library representation

Save the child with parent lineage and explicit marketing tags:

- `asset-role:marketing-hover-filled`
- `filled-twin`
- `filled-twin-parent:<generated-image-id>`
- `sku:GB-CYL-CLR-9ML-ROL-BKDT-02`
- `liquid-color:warm-amber`
- `liquid-fill:70`
- `platform-theme:pale-limestone-low-plinth`

The empty parent receives no mutation beyond an optional reversible pair-link record. Neither image enters PDP lifecycle or reconciliation.

### 7. Sanity pair document

Create a dedicated `marketingHoverPair` document rather than overloading product truth or Shopify media.

Required fields:

- Product-group slug
- Representative Grace SKU and website SKU
- Empty image asset
- Filled image asset
- Empty and filled Madison source URLs/IDs
- Base provider and filled provider
- Liquid color and fill percentage
- Platform-theme ID
- Pair-QA status and timestamp
- Human approval status

Use a deterministic ID based on group slug and representative Grace SKU. Publishing is manual and atomic: Sanity receives both assets and the pair document together, or nothing is changed.

### 8. Storefront hover

Behind a default-off feature flag, fetch the approved Sanity pair for the product group's active representative SKU.

- Render the empty and filled images in the same absolute frame.
- Preload the filled asset.
- Crossfade opacity over approximately 300 ms; never swap layout dimensions.
- Keep the empty image visible when JavaScript, Sanity, or the filled image is unavailable.
- Disable the filled hover when a visitor selects a variant without an exact pair. Never show a black-cap filled twin over a different cap-color selection.
- Touch devices keep the empty image during the pilot. A deliberate tap affordance can be designed after desktop validation.

## Alternatives Rejected

### Two independent generations

Fastest, but bottle, platform, lighting, or shadow drift will make the hover jump. This does not satisfy the identical-twin requirement.

### Generic text-only refinement

Uses the parent image but permits the model to redraw the full scene. It is acceptable for ordinary marketing revisions, not for an aligned hover pair.

### CSS liquid overlay or code compositing

Could preserve exterior pixels but would create artificial liquid and violate the rule that the model owns beautification while code only measures, gates, and places.

## Test Strategy

- Unit tests for marketing-only role classification and destination refusal
- Contract tests proving PDP, Shopify, Convex-product, and SKU-job writes are unreachable
- Parent-reference test proving the empty image is submitted exactly once
- Provider test proving an optional mask is sent only for filled-twin GPT edits
- Dedicated-request test proving structured liquid state reaches the filled-twin prompt without changing Best Bottles PDP prompt normalization
- QA tests for outside-mask changes, fill-level tolerance, tint leakage, and dimension mismatch
- Sanity publisher dry-run, validation, deterministic-ID, and atomic-failure tests
- Catalog-card tests for preload, crossfade, missing-pair fallback, variant mismatch, and default-off flag
- Existing `npm run test:bestbottles:image-coverage` must remain 383/383 or higher
- Real app typecheck remains `tsc -p tsconfig.app.json`

## Pilot Budget and Stop Conditions

No paid generation occurs automatically. Jordan initiates each paid attempt.

Pilot budget:

- One empty plinth scene, if an approved one does not already exist
- Up to two filled-twin edit attempts
- Maximum three paid images before a review stop

Stop immediately if:

- The exterior-preservation gate cannot pass
- The mask changes the cap, plinth, background, or shadow
- Liquid rendering reads as opaque paint rather than oil inside glass
- Any request attempts to enter PDP reconciliation or a commerce destination

## Pilot Success Criteria

The pilot succeeds only when Jordan approves the visual pair and all of the following are true:

- Hover appears as the same scene gaining liquid, not as an image replacement
- Exterior and platform remain visually stationary during crossfade
- Liquid is attractive, plausible, and subordinate to product identity
- Empty image remains the default and fallback
- No Shopify, Convex product-image, PDP reconciliation, or SKU-job record changes occurred
- Sanity contains one explicitly approved marketing hover pair
- Storefront behavior remains gated until Jordan separately authorizes rollout

## Rollout After Pilot

After approval, extend one exact pair per representative SKU. A product-group card may use a pair only while that paired SKU is active. Other variants continue showing their empty product image until their own pair exists. Scale family by family with explicit theme and liquid palettes; never infer or blind-assign a filled twin across variants.
