# Best Bottles Image-Generation Pipeline: Technical Audit

**Audit date:** 2026-07-14
**Repository:** `madison-app`
**Scope:** Madison Studio image generation, the active Best Bottles reference-locked master lane, the local bulk-generation lane, current Supabase migrations, and repository-local generation/QA artifacts.

## Audit boundary and evidence standard

This report describes what the implementation does today. Evidence is labeled implicitly by source:

- **Code:** current TypeScript, Edge Function, provider wrappers, React generation hook, and migrations.
- **Artifact:** checked-in manifests, QA reports, output images, and review files.
- **Documentation:** design notes and pipeline briefs, used only when they do not contradict code.
- **Not verified:** production Supabase rows, provider billing, provider retention policy, or live API behavior, because no production database/log export was available in the local workspace for this audit.

The worktree already contained extensive user changes. This audit added only this report and the audit plan; it did not change application behavior.

## 1. Executive summary

The current Best Bottles master pipeline is a **reference-locked image-to-image edit**, not a 3D reconstruction, segmentation pipeline, or deterministic product compositor.

The user/operator selects a catalog SKU and a source product image. Madison resolves product metadata and reference-role metadata, runs a preflight, and sends the image plus a compiled prompt to the `generate-madison-image` Supabase Edge Function. For a Best Bottles studio master, the server requires a product reference and a structured `productContext`; Cylinder masters accept exactly one flattened product-truth reference and optionally one style-only reference. Background, mask, paper-doll, transparent-control, and additional product references are rejected on this path.

The prompt is assembled from the vendored Best Bottles catalog canon, a family framing profile, shadow policy, geometry/material inference, and a visual-calibration block. The actual catalog prompt comes from `src/config/bestBottlesCatalogCanon.ts` plus `src/lib/bestBottlesPromptPreflight.ts`; `config/product_families.json` and the older prompt compiler are validation/QA inputs, not the final prompt source for this lane.

The active reference-locked provider is forced to **OpenAI `gpt-image-2`**, using `POST /v1/images/edits`, with the product reference sent as `image[]`. The active master request uses `2080x2288`, high quality, PNG, and an opaque background. There is no mask, denoise/strength control, ControlNet, IP-Adapter, LoRA, 3D asset, depth map, normal map, or seed in the OpenAI request. The model must therefore recreate glass, refraction, occlusion, pumps, dip tubes, highlights, and shadows from the flattened reference plus language instructions.

The Edge Function uploads the returned bytes to the public Supabase `generated-images` bucket and writes a `generated_images` row. The browser then optionally runs the Best Bottles rig postprocess: foreground/bounds analysis, canvas/background normalization, baseline/center/scale QA, and a second upload that patches the library row. This postprocess is primarily geometry/framing control; it does not recover missing hardware or reliably correct glass occlusion. The active client invocation explicitly passes `maskReferenceUrl: null` and `requireMaskControl: false`.

Approval is a separate control-plane step. Reconciliation records capture source hash, prompt hash/version, catalog truth, provider/model string, bounds, fill, baseline, centerline, shadow evidence, and lifecycle state. Human checks for identity, applicator state, and surface/crop are required. The database approval RPC additionally requires passing framing, identity/truth, and shadow evidence before an image can receive `approved-keep` and advance toward Shopify/Sanity.

There is also a separate **local CLI lane** in `scripts/local-generate.ts`. It reads a local Best Bottles catalog/reference tree, calls OpenAI directly, uses a different legacy prompt assembler, then uses Sharp to recanvas, place on a family rig, flatten, and write PNG/CSV output. It has no Supabase Edge Function round trip and does not automatically persist the full request provenance. A third class of repository artifacts consists of review-only creative-production outputs; those are useful visual evidence but are not proof of the active Madison/Supabase execution path.

The central architectural limitation is simple: product identity is strongly described and gated, but product geometry and transparent internal structure are not enforced by a pixel-level product layer. The model still owns most of the product pixels.

## 2. Architecture diagram

### Active Madison / Best Bottles master lane

```text
Operator / Dark Room UI
  src/components/darkroom/MastersTabPanel.tsx
        |
        | selected SKU, catalog metadata, reference role, prompt preflight,
        | productContext, tags, optional style reference
        v
React generation hook
  src/hooks/useAssembledPromptGeneration.ts
        |
        | supabase.functions.invoke("generate-madison-image")
        | HTTP body; no queue message
        v
Supabase Edge Function
  supabase/functions/generate-madison-image/index.ts
        |
        |-- Supabase service-role client
        |     |-- brand_knowledge / brand_products lookup
        |     |-- parent generated_images lookup for refinements
        |     |-- generated-images storage upload
        |     |-- generated_images insert
        |
        |-- reference categorizer + byte loader
        |     Product -> Background -> Style ordering
        |     5 MB/reference, 12 MB/combined limits
        |
        |-- Best Bottles rendering contract
        |     identity gate, reference-role gate, canvas and provider policy
        |
        |-- prompt builder
        |     precompiled prompt from client
        |     or catalog canon + family framing + shadow/material rules
        |
        |-- provider router
        |     Best Bottles master: OpenAI only
        |     generic/override lanes: OpenAI, Gemini, Freepik
        v
Model API
  OpenAI Images API: POST /v1/images/edits
  gpt-image-2, image[] references, prompt, size, quality, output format
        |
        v
Returned image bytes
  base64 from OpenAI
        |
        | exact-size OpenAI master: Edge skips decode/re-encode conformance
        v
Supabase Storage
  public bucket: generated-images
  pipeline/<family>/<shape>/... for pipeline-originated files
  org/timestamp-uuid... for ordinary generations
        |
        v
Supabase database
  generated_images row
  library_tags, final_prompt, reference_images, provider, chain fields
        |
        v
Browser-side acceptance pass
  normalizeBestBottlesRigBaseline()
  foreground/bounds analysis, background snap, baseline/center/fill QA
  optional deterministic rig upload; patches generated_images.image_url
        |
        v
Best Bottles reconciliation control plane
  best_bottles_image_reconciliations
  best_bottles_pipeline_sku_images
  best_bottles_pipeline_sku_jobs
  human review + approval RPC
        |
        v
Library approval -> Shopify/Sanity/Convex verification and publish
```

### Other implemented lanes and services

```text
Local CLI: scripts/local-generate.ts
  local catalog / local flattened PNG
    -> legacy promptAssembler
    -> direct OpenAI /v1/images/edits OR direct Gemini generateContent
    -> Sharp recanvas + family rig placement + flatten + fixed-frame QA
    -> local PNG + _generation-report.csv

Background-removal tool (not active in the Best Bottles master lane)
  remove-background Edge Function
    -> fal.ai BiRefNet (primary)
    -> Replicate rembg (fallback)
    -> URL/result for component/reference workflows

Review-only creative artifacts
  outputs/imagegen/... built-in/native imagegen and staged review files
    -> manifests/contact sheets/QA reports
    -> not automatically linked to generated_images
```

There is no durable queue or worker table in the active Edge Function path. UI batches are sequential at the React layer. The local CLI uses an in-process concurrency pool, default four workers. The Freepik provider has its own task-create/poll loop, but that is not used for the locked Best Bottles master path.

## 3. Exact end-to-end workflow

The representative example below is a 9 ml clear Cylinder with a fine-mist sprayer, gold collar, and detached over-cap. The identifiers and metadata shape match the current Cylinder preflight; the final prompt example in section 5 is generated from the current compiler with representative values.

### 3.1 Input and product resolution

The UI starts with a selected catalog product/SKU. `MastersTabPanel.tsx` builds a `productContext` containing, when available:

```text
SKU / website SKU / product name / description
family / category / collection / capacity
height with cap / height without cap / diameter / neck thread
body material / color / cap color / trim color
applicator / cap state / mode / component topology
source reference / source page / measurement source
website truth status / identity status / identity blockers / identity hash
prompt version / rig version / shadow owner / shadow contract
```

The source image is selected through reviewed reference-role data. The current Best Bottles master contract treats the flattened product reference as the product identity source of truth. A Cylinder request may have one product reference and one style-only reference; it may not have multiple product references or a background reference.

The SKU-level database workflow is represented by `best_bottles_pipeline_sku_jobs`. The job carries family, capacity, applicator, canonical color, source/reference information, generation state, approval state, and Shopify/Convex linkage. The implementation does not resolve every physical subcomponent from a normalized component graph; it passes the resolved fields into the prompt and reconciliation JSON.

### 3.2 Frontend preflight and request assembly

`useAssembledPromptGeneration.ts`:

1. Validates the reference URL and rejects unsupported/retired Best Bottles reference types.
2. Rejects a mask/control reference for the current Best Bottles lane.
3. Adds the product reference as `Product Reference`.
4. Adds an optional style-only reference, usually the glass or metal visual target.
5. Adds `brand:best-bottles`, `studio-master`, family, SKU, material, closure, prompt, rig, identity, QA, and visual-target tags.
6. Applies the visual-calibration prompt block to the precompiled prompt.
7. Invokes `generate-madison-image` with PNG output, product context, prompt record, aspect/canvas constraints, and `resolution: "standard"` by default. The operator can opt into high resolution, but the code comments record previous 2080×2288 gateway timeouts and therefore default back to standard.

The request uses an HTTP function call, not a queue. The Edge Function wraps long requests with a whitespace heartbeat every 20 seconds so a request can remain open through the Supabase gateway idle window. When the heartbeat path is active, the HTTP status may still be 200 while the JSON body contains `{ error: ... }`; the frontend explicitly checks for that.

### 3.3 Server-side contract and identity gates

The Edge Function:

1. Authenticates/resolves organization context and loads active brand knowledge/product data when a generic product ID is supplied.
2. Adds a parent generated image as the first reference for refinement requests.
3. Categorizes refs by label into product/background/style.
4. Detects the Best Bottles studio-master route from tags and product refs.
5. Resolves the Best Bottles rendering contract. A blocked contract returns a 400-level JSON error before a provider call.
6. Forces `2080×2288` for the contract.
7. Requires a precompiled prompt record for the bottle catalog lane.
8. For Cylinder, requires exactly one product ref, zero background refs, and at most one style ref. It rejects mask/control, paper-doll, transparent/background-removed, and additional-product references.
9. Checks identity blockers. Measurement incompleteness is logged as a warning; unresolved identity blocks generation.

### 3.4 Reference byte preparation

The Edge Function accepts either a `data:image/...;base64,...` URL or a fetchable URL. It does not resize, crop, sharpen, upscale, background-remove, alpha-composite, or normalize product geometry before sending the bytes to OpenAI. It enforces:

- 5 MB maximum per reference.
- 12 MB maximum across references.
- Product references first, then background refs, then style refs.
- Provider-facing payload is base64 plus MIME type.

The active Best Bottles policy expects an opaque flattened product reference, but the byte loader itself does not implement a general alpha-channel or transparent-glass decomposition pass. That distinction matters: “opaque flattened reference required” is a contract rule, not a pixel-layer pipeline.

### 3.5 Prompt compilation

For the active catalog lane, the server uses the client-supplied precompiled prompt record after validation. When compiled in Madison, the prompt is:

```text
catalog canon identity/material block
  + resolved family framing profile
  + resolved shadow topology/owner
  + optional clear-glass volume cue
  + final studio direction
```

The older module compiler may contribute QA checklist tags, but its own `final_prompt` is explicitly discarded for this route. The prompt is then modified by image-constraint rewrite/prohibited-term rules if the caller supplies them. The client visual-target block is also appended when the request is a Best Bottles studio master.

### 3.6 Provider call

The active master provider policy forces:

```text
provider: OpenAI
model: gpt-image-2
endpoint: https://api.openai.com/v1/images/edits
reference mode: image-to-image edit
references: product image first; optional style image second
size: 2080x2288
quality: high for the locked production contract
background: opaque
output_format: png
n: 1
seed: not sent
mask: not sent
```

The provider wrapper routes to `/images/edits` whenever a GPT Image model has one or more references. The returned image is base64. For an exact GPT Image 2 size request, the Edge Function intentionally skips a second decode/re-encode to avoid Edge worker CPU/memory failures.

### 3.7 Storage and database write

The returned PNG is uploaded to the public `generated-images` bucket. Pipeline-originated names include organization, family/shape path, variation slug, position, and a random short ID. The Edge Function then inserts a `generated_images` row containing:

- `final_prompt` — the server prompt before any provider-side rewriting.
- `image_url` — the raw generated storage URL.
- `generation_provider` — for example `openai-gpt-image-2`.
- `reference_images` — the original reference objects/URLs, not the provider base64 payload.
- `brand_context_used` — brand knowledge and rendering-contract metadata when applicable.
- session, goal, aspect, library category, parent/refinement fields, consistency fields, and library tags.

The Edge Function does not write a separate generation-attempt table or provider billing record. The database insert helper can retry around missing-column errors by removing the missing field; it is schema-compatibility handling, not image regeneration.

### 3.8 Browser rig postprocess and reconciliation

For a canonical Best Bottles master, the browser checks whether the family/canvas/tags allow rigging. If so, it downloads the generated URL and runs `normalizeBestBottlesRigBaseline()`.

The active call uses:

```text
targetBackgroundHex: #F6EFE8
maskReferenceUrl: null
requireMaskControl: false
```

The postprocess performs foreground/bounds analysis, background handling, optional translation/scale normalization, framing QA, and shadow QA according to the resolved policy. It uploads a `master_rigged_...png` derivative and patches the `generated_images.image_url` column. The raw URL and final URL are retained in reconciliation evidence. Global paint-after color correction is intentionally retired because it was shifting material and washing clear glass.

### 3.9 Approval and delivery

The candidate is not automatically publishable merely because generation succeeded. The reconciliation row must have passing lifecycle/QA evidence, matching catalog truth, usable measurements, and the required shadow evidence. The UI also requires human confirmation of identity, applicator state, and surface/crop. The database approval RPC then marks the SKU-image assignment `approved-keep` and updates the SKU job toward approval/publish states. Shopify/Sanity/Convex verification is downstream and is not performed by the image model call itself.

## 4. Technology and model inventory

| Component | Exact implementation | Current Best Bottles master use | Inputs / outputs | Important controls and limitations |
|---|---|---|---|---|
| Primary image model | OpenAI `gpt-image-2` | **Active and forced** for reference-locked masters | Prompt + one product image + optional style image -> base64 PNG | `/v1/images/edits`; `2080x2288`, high, opaque, PNG; no seed field, no mask field, no strength/denoise field in wrapper; exact geometry is not guaranteed |
| OpenAI generic image models | `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`, `dall-e-3` | Generic Dark Room compatibility, not the locked Best Bottles route | Text and/or refs depending on model | DALL-E path is text-generation and ignores edit refs; legacy models are available by routing but not active catalog policy |
| Gemini image models | `models/gemini-3-pro-image-preview`, `models/gemini-3.1-flash-image-preview`, `models/gemini-2.5-flash-image` | Generic fallback/override; not allowed on the locked master when the contract forces OpenAI | Prompt + inline refs -> inline base64 image | Native aspect/imageSize; optional random/fixed INT32 seed; refs supported; no masks or geometry guarantee; request timeout defaults to 60s; fallback only on missing/unsupported model errors |
| Freepik image models | `mystic`, `classic-fast`, `flux-dev`, `flux-pro-v1-1`, `hyperflux`, `seedream`, `seedream-4`, `seedream-4-edit` | Generic/override route; not active locked master | Task request + prompt, optional Seedream refs -> polled CDN image, then Supabase copy | Task polling up to 60 attempts × 2s; seed supported; reference images only for supported Seedream variants; Freepik failures can fall back to Gemini |
| Background removal | fal.ai `fal-ai/birefnet` (called “BiRefNet”) | Separate component/reference workflow, not active master input preparation | Image URL -> result image URL | `remove-background` tries fal.ai first and Replicate rembg second; the active Best Bottles master rejects transparent/background-removed control refs |
| Background removal fallback | Replicate rembg | Separate fallback | Image URL -> result image URL | Not called by the locked master route |
| Edge image processing | ImageScript/byte decode in `generate-madison-image` | Limited exact-canvas conformance for non-exact provider outputs | base64 image -> conformed base64 | OpenAI exact GPT Image 2 master path skips re-encode to avoid worker limits |
| Browser image processing | Canvas/OffscreenCanvas and `rigPostprocess.ts` | Active final framing/QA pass | Public generated image -> rigged PNG + QA evidence | Foreground/bounds/background/baseline/center/fill; does not reconstruct occluded hardware |
| Local image processing | Node `sharp` in `scripts/local-generate.ts` | Separate bulk CLI lane | Provider bytes + reference -> recanvas/rigged flattened PNG | Exact 2080×2288 output gate; local background flatten; CSV metrics |
| Text/brand context models | Claude/Gemini text wrappers exist in the generic app | Not part of the active Best Bottles image master path | Text prompts/brand knowledge | Do not confuse these with the image generation model; current catalog prompt is deterministic code, not an LLM rewrite step |

No active Best Bottles master code uses Stable Diffusion, a directly called FLUX endpoint, Replicate image generation, Adobe, Clipdrop, ControlNet, IP-Adapter, LoRA, a custom vision model, a depth/normal model, or a 3D renderer.

### Model parameter details

- **OpenAI:** `model`, `prompt`, `n=1`, `size`, `quality`, `background`, `output_format`, `user`, and ordered multipart `image[]`. The wrapper does not send `seed`, `input_fidelity`, mask, or a denoise/strength value.
- **Gemini:** `responseModalities: ["IMAGE"]`, native `aspectRatio`, `imageSize` (`1K`, `2K`, or `4K`), optional seed, and inline reference images. The active locked route does not reach this branch.
- **Freepik:** model, prompt, resolution, aspect ratio, optional seed, and optional weighted URL references. It is task-based and re-uploaded to Supabase because provider CDN URLs expire.

Provider-side prompt rewriting is not fully observable. The OpenAI wrapper returns `revisedPrompt` when the API supplies one, and logs only whether a revision occurred. The stored `generated_images.final_prompt` is the Madison prompt that was sent, not a guaranteed record of provider-internal rewriting.

## 5. Prompt system

### 5.1 Prompt sources and precedence

The active Best Bottles catalog prompt has this precedence:

1. `src/config/bestBottlesCatalogCanon.ts` — identity, clear-glass or material truth, studio direction, presentation, negative constraints, and final check.
2. `src/config/bestBottlesFamilyProfiles.ts` — family-specific canvas, fill-height zone, baseline, centerline, sidecar placement, and optional clear-glass volume cue.
3. `src/lib/bestBottlesPromptPreflight.ts` — product/family/material/closure inference, shadow ownership/topology, prompt record and QA tags.
4. `src/config/bestBottlesVisualTarget.ts` — style-only calibration reference and composition-safety block appended by the frontend.
5. Request-level rewrite/prohibited-term rules, if supplied.

`config/product_families.json`, `master_pdp_prompt.md`, and the older prompt compiler are still loaded for validation and QA checklist generation. Their generated prompt is explicitly discarded for the production catalog path. The separate local CLI still uses `src/lib/product-image/promptAssembler.ts`, so the two lanes do not have one identical prompt implementation.

### 5.2 Prompt behavior

The active prompt includes:

- Exact-reference identity lock.
- Clear-glass material instructions, including empty bottle, wall thickness, refraction, rear wall, dip tube visibility, rim/base glints, and optical volume.
- Family geometry and applicator language inferred from catalog fields.
- Flat Bone background, fixed canvas, baseline, centerline, fill-height band, and detached sidecar rules.
- Shadow ownership: either model-owned evidence or deterministic rig policy, depending on resolved family/SKU policy.
- Studio lighting/camera language: softbox, fill card, cross-polarized medium-format macro look.
- Negative constraints against liquid, haze, opaque white fill, stripes, extra components, labels, text, props, changed silhouette, changed applicator, and changed background.

There is no separate OpenAI negative-prompt field in the active wrapper. Negative instructions are ordinary prompt text. Gemini’s shared image helper supports a separate `negativePrompt`, but the active generation call does not supply one. There is no local prompt-length limit; reference bytes have the limits documented above. The provider may internally revise prompts, but that revised text is not persisted as the canonical prompt.

### 5.3 Representative complete final prompt

The following is a complete prompt compiled from the current code for a representative clear Cylinder request (`GB-CYL-CLR-9ML-SPR-GLD`, 9 ml, clear glass, fine-mist sprayer, detached sidecar). It is shown exactly as sent by Madison’s current prompt compiler for this representative metadata, with the client’s visual-calibration block included. No credentials or private URLs are present. A production SKU with different family/material/topology fields will receive the same canon structure with different inferred values/profile text.

```text
You are enhancing the attached product reference image into a premium photorealistic ecommerce product photograph.

The reference image is the source of truth for product identity and geometry. Preserve the exact bottle silhouette, proportions, neck, threads, roller ball, sprayer, pump, collar, cap, detached cap, tassel, applicator, and all hardware exactly as shown. Do not redesign, recolor, resize, reposition, duplicate, remove, or add any product component.

This is not a new product design. It is a photographic material-and-lighting enhancement of the existing product.

PRIMARY GOAL:
Make the clear glass look like real luxury product-photography glass: transparent, colorless, optically clean, premium, dimensional, and specular.

The bottle is empty clear glass. There is no liquid, tint, frosting, haze, cloudy white fill, residue, bubbles, dust, speckles, noisy sidewalls, or insert inside the bottle. The background should be visible through the glass with natural refraction and slight optical displacement.

GLASS APPEARANCE:
Render the glass using believable real-studio optical behavior:

- Crisp transparent outer edges.
- Visible wall thickness at the sidewalls, shoulder, neck, and base.
- Clean rim glints on the lip, shoulder, threads, and base rings.
- Subtle edge density where the glass overlaps itself.
- Natural refraction through the front and back walls.
- The rear wall of the bottle should be faintly visible through the front wall.
- The internal dip tube, if present in the reference, should remain faintly visible through the glass and slightly refracted.
- The base should show clear curved glass geometry, transparent thickness, and crisp circular base rings.

The glass should be defined by clean studio-card reflections and natural specular behavior, not by drawn lines, artificial parallel rails, painted texture, cloudy fill, or sidewall noise. Keep the mid-body mostly transparent and quiet while preserving crisp rim, shoulder, thread, edge, and base definition.

CYLINDER V6.1 BONE CANVAS CONTRACT: Render the output on the Best Bottles Bone canvas #F6EFE8 at 2080 × 2288. Keep this canvas color flat, seamless, and texture-free; this contract applies to reviewed Cylinder-family generation context.

CYLINDER STANDARD FRAMING PROFILE (CANVAS COMPOSITION AUTHORITY):
- Canvas is fixed at 2080 × 2288. Do not change aspect ratio, crop, or canvas size.
- The reference image is product truth, not framing truth. Preserve the product identity and proportions, but do not inherit the reference image's tiny source scale, source crop, source padding, or off-center placement.
- Relative scale zone: Small Cylinder bottles (small-cylinder). The versioned global catalog curve owns assembled height; this zone classifies composition only.
- Approved fill-height range: 67-71% of the canvas height for this family profile.
- Render the full assembled product so it fills approximately 69% of the canvas height and no more than 60% of the canvas width.
- Seat the visible bottle base on the shared studio baseline at 8-10% up from the canvas bottom.
- Keep the primary bottle centered on the canvas vertical centerline at 50% width.
- If a detached cap or applicator is present, keep it as a right-sidecar component on the same baseline; it must not shift the primary bottle off center.
GROUNDING SHADOW — MODEL OWNED:
Render separate but visually coherent soft contact shadows at the bottle base and detached cap; each must attach directly to its own physical contact line.
Each contact core must be darkest and most concentrated at the physical contact line, approximately 32–42% opacity at its densest point, then feather softly behind and toward camera-right, fading within approximately 20–30% of the primary bottle's width.
Every contact core and its feather must read as one continuous grounded shadow. Use one soft key-light direction across all contacts.
No missing expected contact, unexpected disconnected shadow, detached oval, gap beneath a grounded component, hard outline, long dramatic cast, doubled shadow, reflection, floor plane, smear, or horizon.
- Round-glass volume cue: the body is a curved cylinder, not a flat pane. It must remain visibly dimensional at ecommerce thumbnail size while staying empty, transparent, and colorless. The backdrop seen THROUGH the glass reads about a half-tone deeper than the bare canvas beside the bottle, and that interior tone deepens gradually toward the left and right walls where the glass is optically thickest. Sidewall density must emerge as a soft graduated optical transition from refraction and real wall thickness; it must never resolve into a discrete dark rail, drawn outline, black stripe, or continuous line on either side. The interior must never become a uniform Bone-colored rectangle or empty cutout window inside the bottle silhouette. Add narrow asymmetric studio-card reflections that softly feather with the curved sidewalls, plus faint rear-wall refraction and an elliptical internal base ring, so the circular cross-section is unmistakable without changing the silhouette. This interior tone change is purely optical and PERFECTLY SMOOTH — an even, continuous gradient with zero grain, speckle, mottling, smudges, brushy streaks, haze patches, or painted texture inside the glass; the interior stays optically clean. The mid-body stays quiet but must not match the background exactly. Do not add a broad central highlight stripe.
- Keep all physical proportions locked to the reference; this framing profile controls only placement, scale on canvas, baseline, centering, and grounding shadow.

STUDIO DIRECTION:
Strict studio-direction refinement for restrained premium ecommerce photography:
Use the restrained studio product-photography sensibility associated with Kinfolk and Aesop only as a mood reference: quiet premium lighting, clean restraint, and a subtle dimensional contact shadow.
This is not lifestyle photography. Do not add props, labels, packaging, typography, scenes, brand marks, retail environments, Aesop-style product design, or any brand-specific asset.
The catalog contract remains absolute: preserve the exact 2080x2288 canvas, product fill-height target, shared baseline, centerline, crop, product scale, detached-cap sidecar position, geometry, color, material, and component placement.
The declared model-owned contact shadow is the sole grounding shadow; do not add or alter any second shadow, floor plane, reflection, hard cast shadow, smear, horizon, vignette, or background texture.
Preserve the photographed surface texture, translucency, edge density, tonal variation, highlights, and imperfections of every cap, actuator, collar, fitment, and detached sidecar exactly as shown in the Product Reference. Studio direction may change only the illumination falling on those components, never their material finish or surface character.
The attached Product Reference remains the source of truth. Changes are limited to scene lighting, the specified glass treatment, the flat Bone background, and contact shadow realism.

FINAL V2 STUDIO CHECK:
This v2 studio direction is the final controlling instruction for visual style and finish. Do not apply any older Best Bottles parchment, darkroom, paper-doll, visual-squad, generic ecommerce, or post-generation prompt language after this point.
Only the reference identity lock, essential material truth, and resolved Madison framing contract are allowed to constrain it.
Respect the resolved family framing measurements while making the photograph feel like the approved v2 studio direction.
The resolved Cylinder V6.1 model-owned contact-shadow contract does not weaken product identity, geometry, material, canvas, or framing authority.

VISUAL CALIBRATION TARGET — best-bottles-pdp-v1.
Secondary reference image 54f5c6c1-7cb3-4137-9cb8-0208028f696a is STYLE-ONLY.
Match the approved target's clear-glass wall definition, edge density, refraction, specular rhythm, material separation, and premium glass finish.
Render the final canvas in the approved warm tone #F6EFE8 and match the reference's refined natural contact/drop shadow: local grounding, soft feathered falloff, restrained spread, and no pasted-on or floating appearance.
Do not copy the secondary reference's silhouette, bottle family, closure, applicator, color, scale, crop, geometry, composition, or components.
The primary Product Reference is the sole authority for product identity, geometry, component count, closure state, scale relationships, centerline, and baseline.
SIDECAR COMPOSITION SAFETY: render exactly one finished SKU product as shown in the primary Product Reference: the bottle upright with its exact fitment or applicator attached, plus exactly one matching cap or overcap detached on camera-right on the same shared baseline. Preserve the reference component count, component identities, fitment seating, sidecar position, spacing, and relative scale. Do not assemble the sidecar onto the bottle, omit it, duplicate it, substitute it, invent hidden hardware, or add any other bottle, accessory, packaging, prop, ghost object, or second product.
```

Important implementation detail: the prompt names internal dip tubes and clear-glass optical behavior, but those are not separately enforced by a mask or compositing operation. They remain model obligations unless a later human rejects the result.

## 6. Reference-image handling

### Active master rules

| Question | Current behavior |
|---|---|
| Maximum references | Cylinder master: exactly one product reference plus zero or one style-only reference. Generic route allows more categories, subject to byte limits. |
| Reference order | Product first, then background, then style. For the active master, there is no background reference. |
| First-image importance | Yes. Prompt language and labels designate Image 1/product reference as the sole product identity and placement authority. |
| Full resolution | The Edge Function fetches the original bytes; it does not resize or sharpen them. Provider/API limits still apply. |
| Accepted source forms | Fetchable URL or base64 data URL; MIME is forwarded. |
| PNG transparency | The byte loader can carry PNG bytes, but active Best Bottles policy requires an opaque flattened product reference and rejects transparent/background-removed/control references by metadata/path/workflow rules. It does not create a transparency-aware product layer. |
| Original background | The flattened product reference is sent with its original pixels. No active master background-removal pass strips it before OpenAI. The prompt tells the model to replace the background with Bone. |
| Alpha preservation | No explicit alpha-preserving pipeline exists for the locked master. OpenAI is requested with `background=opaque`; the final image is a flat PNG. |
| Normalization | No pre-provider scale/alignment normalization of the reference. Framing is controlled by the prompt/profile and a post-generation rig. |
| Masks | No mask reference is accepted by the active master path; active client rig call uses no mask. |
| Component separation | No label/cap/body/hardware segmentation occurs before the provider call. |
| Duplicate/conflicting refs | Additional product/background refs are rejected for Cylinder. Style ref is explicitly non-identity. There is no learned conflict resolver. |
| Poor source quality | The model receives the poor/ambiguous reference subject to byte limits; identity gates can block metadata problems, but there is no general image-quality scoring gate before OpenAI. |

The frontend’s `referenceImages` objects include descriptive labels and text such as “canonical bottle reference,” “exact product-identity lock,” and “secondary style-only reference.” The provider receives only ordered image bytes plus the final prompt; those descriptions are not a structured multimodal schema understood independently by the model.

### When references disagree

- **Bottle proportions, cap height, pump style, label placement, component count:** conflicting product refs are blocked on the active Cylinder route rather than reconciled.
- **Glass color/liquid level/material:** the primary product ref and product metadata are authoritative; a style ref is prohibited from changing identity/material. There is no pixel-level enforcement if the model disregards that instruction.
- **Product angle:** the reference and prompt lock the camera angle, but no camera/depth control preserves it deterministically.
- **Background/scene:** background refs are rejected for Cylinder; generic Director mode can use them.
- **Cap-off topology:** the client requires a cap-off/topology reference ID for applicable multi-component products, but the actual model input remains a flattened reference image.

## 7. Product identity and SKU logic

### Structured identity exists, but component modeling is mostly denormalized

The pipeline has a real SKU-level product identity layer. `best_bottles_pipeline_sku_jobs` stores:

```text
grace_sku, website_sku, shopify_sku
product_group_slug, family, category, capacity_ml
applicator, canonical_color, product_id, source_id
reference source/path/url/issue
generated and approved image IDs/URLs
workflow status and errors
Shopify product/variant/media linkage
Convex sync timestamps
```

The generation request additionally carries height, diameter, neck thread, cap state, cap/trim colors, material, identity status, truth issues, component topology, reference roles, prompt version, rig version, and shadow policy. Reconciliation persists a JSON `catalog_truth` snapshot and hash with the image.

The fields actively influence generation through:

- Family/profile inference.
- Body material inference.
- Closure/applicator inference.
- Cap color/finish overrides.
- Geometry notes and topology gates.
- Canvas/fill-height/baseline/centerline profile.
- Prompt QA tags and approval checks.
- Storage tags and reconciliation linkage.

### Family and sibling logic

The implementation recognizes shared families (`cylinder`, `roll_on`, `boston_round`, `atomizer`, `lotion`, `cream jar`, etc.) and applies family framing profiles. The scale profile uses measured catalog fields and capacity/height zones to keep siblings visually consistent.

However, there is not yet a normalized product-component graph that says “these five SKUs share the same bottle body asset but use these three pumps/caps.” Shared identity is conveyed by family metadata, prompt text, references, and review gates. Cap/pump/dip-tube parts are not represented as separately compositable production layers in the active master path.

### Product fields requested in the brief

| Field | Exists today? | Active influence |
|---|---:|---|
| SKU / website SKU | Yes | Identity, tags, job/linkage, prompt, approval |
| Bottle family / category / capacity | Yes | Family profile, scale, prompt, job |
| Height / diameter / neck thread | Yes where available | Geometry hints, scale contract, truth gate |
| Bottle geometry / shape | Derived from family/catalog text | Prompt and QA; not a 3D mesh |
| Glass color/material | Yes/derived | Prompt, visual target, truth QA |
| Closure type/color | Yes/derived | Prompt, topology, human approval |
| Collar/pump/sprayer/roller/dip tube | Mostly in applicator/material text and productContext | Prompt and manual review; no segmentation/composite layer |
| Cap state | Yes | Reference selection, topology, prompt, QA |
| Label asset/position | Not part of active catalog master identity contract | Labels are explicitly prohibited in catalog master prompts; no label overlay in active path |
| Liquid state | Prompt says empty for clear catalog masters | No liquid mask or liquid-layer validator |
| Product angle | Reference/prompt metadata | No deterministic camera/depth control |

## 8. Glass and transparency handling

This is the most important technical finding: the active system does not model glass as separate optical layers.

### What the pipeline distinguishes

The prompt distinguishes these concepts linguistically:

- Outer silhouette and crisp transparent edges.
- Front/back wall thickness.
- Refraction and rear-wall visibility.
- Background visible through the body.
- Internal dip tube visibility.
- Rim, shoulder, thread, and base highlights.
- Liquid absence.
- Contact shadow.

The code does not create separate pixel representations for them. In the active master request, all of those effects are generated as part of one flattened image-edit output.

| Optical/product layer | Current implementation |
|---|---|
| Outside silhouette | Model-generated, then measured as a foreground envelope by rig QA; no exact source silhouette mask controls the provider. |
| Front/rear glass surface | Prompt only; model-generated. |
| Refraction/transmission | Prompt only; model-generated. |
| Background through bottle | Prompt only plus flat-background instruction; no transmission mask. |
| Dip tube/pump behind glass | Prompt only; no depth ordering or hardware mask. |
| Label | Not composited in catalog master; prompt prohibits new labels. |
| Liquid | Canon says empty; no liquid mask/validator. |
| Cast/contact shadow | Model-owned or deterministic rig policy; model shadow receives explicit QA in the current Cylinder V6.1 contract. |
| Reflections/highlights | Prompt/model-generated; no specular mask or normal map. |
| 3D geometry/depth | None in active master. |

The repository does contain mask-aware and background-removal code for other workflows. The active Best Bottles master explicitly refuses mask/control refs, and the client call sets `maskReferenceUrl: null`/`requireMaskControl: false`. This is why the existence of `bestBottlesReferenceMaskQc.ts` or `remove-background` should not be interpreted as evidence that the locked master is mask-controlled.

### Why white pumps and dip tubes fail

A white actuator or dip tube can be visually close to the flattened white/background pixels in the source. The model must infer that it is a separate opaque or translucent object behind/inside transparent glass while also replacing the background. No hardware mask, depth map, alpha layer, or compositing pass tells it which pixels belong in front of or behind the glass. The prompt says to preserve the component, but the provider can:

- Merge it into the background or erase it.
- Make it an opaque white patch on the front surface.
- Place it in front of the glass rather than behind it.
- Convert the dip tube into a stripe/reflection.
- Drop it entirely.

The failure can begin in the flattened source/reference, be amplified by background replacement and model interpretation, or be exposed by low-contrast output. The postprocess sees an image envelope and background, not semantic hardware; it cannot reliably repair an omitted or mis-occluded pump.

The same architecture explains liquid appearing in an empty bottle, clear glass becoming plastic/cloudy, glass tint shifts, and reflections turning into object-like rails. These are model/material interpretation failures, not failures of a missing post-generation layer compositor.

## 9. Consistency mechanisms

### Implemented controls

- Reference-locked primary image.
- Optional style-only calibration image.
- Canonical prompt version and family profile.
- SKU/product metadata and identity hash.
- Fixed product canvas for the catalog lane: `2080×2288`.
- Fixed target background in active Cylinder context: prompt contract uses `#F6EFE8`; the vendored canon also contains `#F5F3EF`, creating a real implementation split documented below.
- Family-specific fill-height ranges, baseline percentage, centerline, and sidecar placement.
- Browser-side deterministic baseline/center/fill measurement and optional normalization.
- Reconciliation hashes and versioned approval evidence.
- Generic consistency mode supports `fixedSeed`, `consistencySetId`, variation label, and set position.
- Gemini path sends a random seed by default or a fixed INT32 seed when requested.
- Local CLI uses a deterministic family rig and exact output-canvas gate.

### Not implemented for the active OpenAI master

- OpenAI seed or deterministic sampler control.
- Mask/inpainting mask control.
- Image-to-image strength/denoise control.
- ControlNet, edge maps, depth maps, normal maps, IP-Adapter, LoRA, fine-tuned identity model, 3D geometry, or a digital twin.
- Deterministic product-layer compositing for bottle, glass, hardware, liquid, labels, or reflections.
- Exact provider-revision persistence.

### Repeated-generation variability

The same OpenAI reference/prompt can materially vary in:

- Bottle shoulder and sidewall proportions.
- Glass thickness and transparency strength.
- Pump/dip-tube visibility and depth ordering.
- Cap/closure shape and material highlights.
- Label or text content if a label exists in an input despite the catalog prohibition.
- Liquid/tint artifacts.
- Shadow shape and reflection placement.

The rig can make canvas placement repeatable and can reject candidates outside measured framing bounds. It does not make the underlying product reconstruction deterministic.

## 10. Quality-control system

### Active Best Bottles automated checks

| Check | Implementation / threshold | Rejects automatically? | Active status |
|---|---|---:|---|
| Input identity | `getBestBottlesIdentityIssue`, reference-role and truth gates | Yes, before generation | Active |
| Input reference type | Product/style role, no background/mask/additional product on Cylinder | Yes, before generation | Active |
| Canvas | Exact 2080×2288 contract for catalog master | Yes in downstream rig/approval; OpenAI exact-size request is trusted on the Edge path | Active |
| Foreground bounds | Pixel/background analysis in rig postprocess | Yes if unavailable or outside bounds | Active |
| Fill height | Family range; default framing helper uses 0.5 percentage-point tolerance | Yes or normalize, depending on distance | Active |
| Baseline | Default ±8 px hard / ±4 px warning in framing QA; production artifacts also use explicit baseline contracts such as Y=1990 ±4 px | Yes/normalize | Active |
| Centerline | ±2.5 percentage points in rig review; legacy paper-doll QC uses ±15 px | Yes | Active |
| Background samples | Legacy QC samples nine points and uses sRGB distance tolerance 18 | Yes in paper-doll QC | Active in that lane; not the primary semantic glass check |
| Alpha/checkerboard | Legacy QC checks for transparent pixels inside bounds | Yes in paper-doll QC | Active in that lane; not an active master semantic layer |
| Clear tint | Legacy QC mid-body saturation threshold `< 0.12` | Yes in that lane | Active in that lane |
| Variant silhouette | Legacy variant QC IoU default `0.95`, position drift ≤6 px | Yes in variant QC | Active in paper-doll lane |
| Model-owned shadow | Current Cylinder approval requires versioned shadow report, correct topology, `contact-back-right-v1`, and every expected contact passing | Yes at approval | Active for the V6.1 contract |
| Human identity/applicator/surface | UI manual checks | Yes at approval | Active |

The code does **not** implement formal OCR, logo accuracy, label text comparison, CLIP/product embedding similarity, pump/cap/dip-tube component counting, duplicate-object detection, liquid-level measurement, glass-wall/refraction classification, or marketplace-image policy checking for this master lane. Several heuristic QC entries are explicit soft-warning stubs that pass by default and say “manual review.”

### Approval gate

`isRigApprovalReady()` requires all machine review requirements to pass and all three manual checks (`identity`, `applicatorState`, `surfaceAndCrop`) to be true. The database approval RPC adds additional controls: current generated image linkage, passing framing decision, no QA issues, catalog truth ready, measurement fields present, SKU match, and shadow evidence. This is a strong release gate even though it is not a semantic model of glass/hardware correctness.

### Human review evidence

The repository contains a current Cylinder review report with eight outputs explicitly marked “FAIL / publish blocked.” This is evidence that the project is using human/measurement review to catch errors that the image model and basic framing checks do not prevent.

## 11. Failure analysis

The table below separates measured failures in the checked-in eight-item Cylinder review artifact from code-level failure modes that are not fleet-quantified. Frequencies are not production rates; they are counts in the named local sample or “not quantified” where no log population was available.

| Failure type | Frequency in evidence | Likely cause | Stage where it begins | Detected? | Do retries help? | Current workaround |
|---|---:|---|---|---|---|---|
| Wrong canvas size | 8/8 in best-bottles-cylinder-grid-production-20260712 review sample; files ~1196×1315 instead of 2080×2288 | Review artifact came from a separate/downscaled generation path or export stage; provider/output lane mismatch | Generation/export lane | Yes, QA report | Only if the run is repeated through the correct canvas path; retrying the same lane is not a fix | Exact-canvas gate; use native 2080×2288 or deterministic recanvas |
| Baseline drift | 8/8 in the same sample; none within Y=1990 ±4 px | Model output scale/crop not registered to the shared baseline | Model output / composition | Yes, framing QA and report | A new sample may land differently; no guaranteed improvement | Browser/local rig translate/scale normalization; reject if outside tolerance |
| Body height/width mismatch | 7/8 fail at least one body tolerance in sample | Model redraws proportions or family scale profile is not sufficiently enforced at pixel level | Model edit | Yes in measured review artifact; not semantic QA in Edge | Sometimes, but no deterministic improvement | Family curve, reference lock, rig measurement, human rejection |
| 9 ml Cylinder too slender/faceted | 1/8 explicit (GBTallCyl9Gl: ~5.2% short, ~12.4% narrow; ratio 6.37 vs canonical 5.89) | Model geometry reconstruction; reference is a flattened blueprint rather than exact mask/mesh | Model edit | Yes in artifact review | Uncertain; retry can vary geometry | Treat output as blocked; use geometry-locked deterministic source/composite |
| White sprayer rendered instead of black | 1/8 explicit (GBSpry4mlClBlk) | Conflicting low-level material/closure interpretation; prompt cannot enforce color pixels | Model edit | Yes by human/SKU truth review | May improve by chance; not reliable | Resolve reference/catalog truth; add component-aware asset or reject |
| Metadata/source color conflict | 1/8 explicit (GBVGreen2o4BlackCapSht) | Live item/source says green while canonical fields say clear | Catalog/reference intake | Yes by truth audit | No; retrying cannot resolve input truth | Block publishing and reconcile catalog truth before generation |
| Mixed taxonomy in a family set | 3/8 explicit Vial items in a nominal Cylinder set | Scope/selection issue, not model rendering | Batch selection/manifest | Yes in report | No | Explicit scope override or taxonomy-pure batch |
| White pump/dip tube disappears, becomes front-facing, or merges into glass | Not quantified in available logs; directly anticipated by active prompt/code comments | Flattened reference, no hardware/depth mask, low contrast against Bone, model occlusion failure | Reference preparation + model edit | Human review only; no semantic automated check | May vary, not reliable | Component-aware source layers, masks/depth, or deterministic overlay |
| Glass becomes cloudy/plastic or clear glass gains tint/liquid | Not quantified | Model material interpretation; no transmission/liquid mask | Model edit | Prompt/legacy tint check can warn; no active semantic glass classifier | Uncertain | Stronger reference assets plus compositing/optical pass; reject |
| Reflections become stripes/objects | Not quantified | Prompt/model conflict between quiet mid-body and visible dimensional cues | Model edit | Legacy heuristic is a stub; human review | Uncertain | Improve reference/style target, add optical QA, reject |
| Extra caps/pumps or missing components | Not quantified | Multi-object hallucination or flattened topology ambiguity | Model edit | Manual identity/applicator review; no component count model | Uncertain | Single-source reference policy, topology asset, component count QA |
| Cropped product/inconsistent scale | Not quantified in fleet; local CLI has exact-canvas/frame QA | Provider honors prompt imperfectly; source padding and model framing drift | Model output | Bounds/canvas/framing checks | Sometimes | Rig normalization or rejection |

### Root-cause pattern

The common root is not a missing adjective in the prompt. The model is being asked to perform two hard tasks simultaneously: preserve a physically specific product from a flattened raster and synthesize physically correct transparent-material optics/occlusion. The current postprocess measures the visible result’s envelope but does not possess enough semantic structure to repair internal errors.

## 12. Data assessment

### Source data and generation history

The repository contains several source/reference families:

- Convex/catalog exports and product-truth snapshots used to populate SKU metadata.
- Local flattened PSD/reference PNGs from the Best Bottles source pipeline.
- Reviewed reference-role assets imported into Supabase storage.
- Older legacy/generated images tagged through migration history.
- Local output batches and review manifests under outputs/imagegen and tmp.

The Best Bottles brief reports 2,916 generated_images rows as of 2026-06-20, including legacy/generated and keeper-backfill categories. That is documentation evidence only; no live query was run during this audit, so it must not be treated as today’s count.

The current reference-preparation policy is stricter than the historical lane: the active catalog master expects a reviewed, flattened, opaque product reference; transparent/background-removed control references are retired for the Cylinder master. The repository also contains a separate transparent-reference preparation script and background-removal tools, which explains why the codebase has both concepts. They are not the same active generation contract.

### Data-quality findings

Evidence supports these real risks:

- Conflicting catalog/source color truth exists in at least one current review set.
- Family/taxonomy scope can be mixed in a batch labeled as one family.
- Source images can be flattened and visually ambiguous around white hardware/clear glass.
- Source padding/scale is inconsistent enough that the active prompt explicitly says source framing is not framing truth.
- Some review artifacts preserve reference paths, hashes, and geometry but not the exact prompt/model/parameters.
- Legacy and current reference lineages coexist in migrations, scripts, and tags.

This repository audit did not establish a complete duplicate-image count, mislabeled-SKU count, resolution distribution, or per-reference alpha/background audit across the full production corpus. Those require a live/exported inventory and image-level scan.

### Training and learned product identity

The Best Bottles image pipeline does not currently use a trained product-identity model, fine-tune, LoRA, embedding-conditioned generation, ControlNet, or 3D asset. Product identity is conveyed by:

1. Structured SKU/catalog metadata.
2. One primary reference image.
3. A compiled identity/material/topology prompt.
4. Family framing and scale rules.
5. Human and deterministic QA gates.

The repository has generic DAM embeddings and Madison text/training-document infrastructure, but those are not image-model product identity training for this pipeline. No training platform, dataset, captions, learning rate, trigger word, validation set, or runtime model selector exists for the active master lane.

## 13. Database and storage structure

### Core image record: public.generated_images

The table began as a generic Madison Image Studio library table and has accumulated image, session, refinement, provider, and pipeline fields. Relevant fields include:

~~~text
id, organization_id, user_id
goal_type, aspect_ratio, output_format
selected_template, user_refinements, final_prompt
image_url, description, reference_image_url, reference_images
brand_context_used, generation_provider, image_generator
media_type, video_url, source_image_id
session_id, session_name, image_order, is_hero_image
saved_to_library, library_category, is_archived, deleted_at, is_deleted
parent_image_id, chain_depth, is_chain_origin, refinement_instruction
consistency_set_id, variation_descriptor, set_position
library_tags
created_at, updated_at, archived_at
~~~

The exact migration history is not cleanly linear in the local checkout: some 2026 pipeline migrations were moved to supabase/migrations_archive/2026-07-10-orphaned-local-history, while later active migrations still refer to library_tags and consistency/reconciliation behavior. Therefore the table above is the implementation’s expected schema, not a claim that the local migration folder alone is a complete authoritative dump of the live database.

### SKU workflow: public.best_bottles_pipeline_sku_jobs

One row per SKU-level workflow job. Status values include:

~~~text
needs-reference -> ready-to-generate -> queued -> generating -> generated
-> qa-pending -> approved/rejected -> shopify-pushed -> synced
~~~

It stores catalog crosswalk data, reference intake metadata, current/generated/approved image links, approval fields, downstream Shopify/Convex fields, and last error. It is organization-scoped with RLS.

### Image reconciliation: public.best_bottles_image_reconciliations

One row per generated image, keyed by image_id, including:

~~~text
SKU/family/source URL and hash
prompt hash/version, rig version, provider_model
catalog_truth JSONB and catalog_truth_hash
asset role, raw/final image URLs
canvas dimensions
pre/post bounds, baseline, target baseline, fill, center, shifts, scale
mask_controlled, framing_qa, qa_issues, framing_decision
shadow_owner, shadow_qa, shadow_topology
lifecycle_state, error and timestamps
~~~

### SKU-image assignment: public.best_bottles_pipeline_sku_images

Many-to-many-style assignment between a SKU job and an image, with decision (unreviewed, approved-keep, needs-regen, superseded), review fields, and Shopify/Convex verification state. A partial unique index permits one active approved-keep per SKU job.

### Product/group surfaces

best_bottles_pipeline_groups remains the rollup/group surface. Generic product data can also be read from brand_products, while the UI passes the richer Best Bottles product context from catalog/Convex-backed product data. The active generation function is not itself the catalog import service.

### Storage buckets

| Bucket | Local migration evidence | Current image-pipeline role | Access behavior |
|---|---|---|---|
| reference-images | 20251020180129...sql | Uploaded/reference URLs | Public bucket, 5 MB limit in migration, public read policy |
| generated-images | 20251021023825...sql | Raw and rigged generated masters | Public bucket/public read policy; Edge uses getPublicUrl() |
| dam-assets / dam-thumbnails | DAM migrations | General DAM, not the active Best Bottles master storage contract | Policy-controlled by DAM migrations |

The active Edge path uses public URLs for provider fetches and final delivery. The code does not use signed URLs for generated master delivery. Storage RLS still governs some write/delete operations, but public read URLs are intentionally part of the current design.

### Relationship diagram

~~~text
organization
  |
  +-- best_bottles_pipeline_groups
  |       |
  |       +-- best_bottles_pipeline_sku_jobs -- generated_image_id / approved_image_id
  |                 |
  |                 +-- best_bottles_pipeline_sku_images -- image_id
  |
  +-- generated_images
          |
          +-- best_bottles_image_reconciliations (one per image)
          +-- parent_image_id -> generated_images (refinement chain)
          +-- image_url -> public generated-images object
~~~

## 14. Reproducibility assessment

### What is stored

For a current Edge-generated master, the system generally stores or can derive:

- Madison prompt (final_prompt).
- Prompt version in reconciliation/catalog tags.
- Reference image URLs and source/reference hash in reconciliation.
- Product truth JSON and hash.
- Provider string such as openai-gpt-image-2.
- Canvas dimensions and output format.
- Parent image/refinement chain fields when applicable.
- Rig version, framing measurements, shadow owner/topology/QA, and final image URL.
- Library tags, family, SKU, and pipeline-group metadata.

### What is missing or incomplete

- OpenAI seed is not available in the provider wrapper and is not stored.
- Exact OpenAI multipart request, reference byte hashes/order as actually sent, and all request headers are not stored as a generation-attempt record.
- Provider-revised prompt is not persisted; only a boolean-like log signal is exposed.
- Code commit/version is not stored with the image.
- The exact pre-provider source byte set is not always copied into a durable versioned manifest by the Edge route.
- Postprocess code version and every pixel transform are not serialized as a reproducible recipe; reconciliation stores results and rig version, not a complete executable transform manifest.
- Local CLI CSV stores prompt length and timing but not the complete prompt, reference hash, model response metadata, seed, or source-byte manifest.

Therefore:

- Exact recreation: not currently possible for OpenAI masters.
- Approximate recreation: possible if the original reference URL still resolves, the prompt/catalog truth is retained, the same model behavior remains available, and the same framing/postprocess code is used.
- Deterministic placement recreation: substantially better; the rig stores target dimensions/baseline and can repeat translation/scale decisions if the same input bounds are found.

## 15. Cost and performance

No production billing export or generation telemetry table was available locally. The following is the maximum supported conclusion from code and artifacts.

| Stage | Current evidence |
|---|---|
| OpenAI image cost | Not persisted or queried. The local CLI prints a hard-coded estimate of $0.04 × successful jobs; this is an estimate in code, not verified provider billing. |
| Gemini cost | Not persisted. Generic fallback path only. |
| Freepik cost | Not persisted. Generic task path only. |
| Background removal | No per-job cost ledger. fal.ai/Replicate are separate tools. |
| Storage | No per-asset storage-cost telemetry. Public Supabase URLs are used. |
| Attempts per approval | Not available as a reliable live metric. Reconciliation can show candidate/approval history when populated. |
| Generation time | Local CLI records genTimeSec in _generation-report.csv and prints an average; no complete report was found for the production fleet. |
| Edge timeout behavior | Heartbeat every 20 seconds addresses idle timeout behavior. Shared Gemini request timeout defaults to 60 seconds. Freepik polling can run up to 120 seconds. |
| OpenAI high-resolution latency | UI code comments document previous 2080×2288 high-resolution 504 gateway timeouts and default resolution reverted to standard; this is implementation history, not a current measured average. |
| Retry rate/failure rate | Not available from local evidence. |
| Human review time | Not recorded in the active schema as a duration. |

The operational implication is that the cost/performance model is not yet measurable end-to-end. Provider, retry, human-review, storage, and publish-verification costs are spread across code paths and logs rather than one generation-attempt ledger.

### Security and data handling

- Provider/API keys are intended to remain server-side in Supabase Edge secrets or local environment files: OPENAI_API_KEY, GEMINI_API_KEY, FREEPIK_API_KEY, FAL_API_KEY, SUPABASE_SERVICE_ROLE_KEY, and related variables. No credentials are included in this report.
- The browser uses Supabase publishable/anon configuration; the Edge Function uses the service-role key for server-side database/storage operations.
- reference-images and generated-images are public buckets in the local migration history, and the generation path uses getPublicUrl(). Product assets are therefore URL-addressable if the URL is known.
- Source/reference URLs and generated URLs are stored in database JSON/columns and are also logged in some Edge/browser messages. Logs can therefore contain confidential asset locations.
- Supabase organization/RLS policies exist for database records and some storage writes, but public-read buckets reduce confidentiality for any asset placed there.
- The repository does not document a complete deletion cascade for every storage object associated with a deleted product/image. Database rows have delete/archive fields and foreign-key behavior; orphaned storage-file cleanup is not established by this audit.
- Provider retention, provider training use, and contractual handling of submitted product images were not verifiable from local code. The implementation does not set a provider-specific do-not-train/retain control in the image request.

## 16. What the pipeline currently does well

The strongest parts are implementation-specific:

1. **It has a real catalog identity and release gate.** SKU jobs, truth snapshots, reconciliation rows, approval assignments, and terminal-state guards prevent a successful API response from being treated as an approved product image automatically.
2. **The Best Bottles master path is explicit and fail-closed on several bad inputs.** It rejects missing references, unresolved identity, extra Cylinder product refs, background refs, mask/control refs, and retired transparent-reference workflows.
3. **Prompt ownership is more disciplined than the legacy codebase suggests.** The active catalog prompt is vendored and versioned; the old family module is validation-only, which reduces accidental prompt drift.
4. **Framing is measured rather than assumed.** Family profiles define fill zones, baseline, centerline, sidecar behavior, and the rig writes actual bounds and decisions to reconciliation.
5. **The provider route is explicit.** Best Bottles masters force gpt-image-2 and do not silently switch to Gemini/Freepik when that contract is active.
6. **The pipeline records raw and final image URLs.** This preserves a useful distinction between model output and browser-rigged output.
7. **The approval control plane is materially stronger than generic library storage.** Approval RPCs validate SKU linkage, identity/truth, framing, QA issues, and shadow evidence.
8. **The local CLI is operationally useful for batch work.** It has local reference lookup, cap-on/cap-off modes, concurrency, skip-existing behavior, exact-canvas checks, family rig placement, and a CSV report.
9. **The repository contains visual QA artifacts, not just code.** The Cylinder validation report explicitly blocks bad outputs and records concrete measurements and truth conflicts.

These strengths are strongest around provenance, framing, and release control. They should not be interpreted as proof that the generated transparent-glass product pixels are geometrically exact.

## 17. Current limitations

### Prompt limitations

- The prompt can describe glass, refraction, dip tubes, pump visibility, and component count, but cannot directly enforce pixel ownership or depth ordering.
- Negative rules are ordinary prose in an OpenAI edit request; there is no independent negative-image constraint.
- The canon has multiple background/color references in active code/docs: #F5F3EF in the vendored canon and #F6EFE8 in the current visual target/Cylinder contract. This can create subtle visual inconsistency.
- The client visual-target block and server precompiled prompt are separate assembly stages, increasing the need for exact prompt/version capture.

### Model limitations

- gpt-image-2 does not expose a seed, mask, strength/denoise, or exact geometry-preservation guarantee through this wrapper.
- Transparent glass, rear-wall refraction, internal hardware, and reflections are model-generated.
- Provider output can change geometry, material, component visibility, and shadow even when the prompt and reference are unchanged.
- Provider-side prompt rewriting is not fully captured.

### Data limitations

- Flattened references conflate product, glass, background, and hardware evidence.
- Some source/catalog records disagree on color/material/taxonomy.
- There is no complete normalized component library for shared bottle bodies, caps, pumps, collars, dip tubes, labels, and liquids.
- Source quality, crop, padding, and lineage are not uniformly captured in one authoritative dataset.

### Architecture limitations

- No product-layer compositor is in the active master path.
- No semantic masks for silhouette, glass transmission, hardware, liquid, label, reflection, or shadow.
- No 3D or 2.5D geometry/depth representation.
- No durable generation-attempt/queue record with raw request settings, byte hashes, provider response metadata, and code SHA.
- Public storage URLs are used for source and output assets.
- Edge and browser/local lanes have materially different prompt, provider, and postprocess behavior.

### Validation limitations

- No OCR/label/logo validation in the active catalog master.
- No automated semantic component count or pump/dip-tube presence check.
- No automated silhouette embedding or geometry similarity model for the master route.
- Several legacy optical checks are heuristic stubs that pass by default.
- Fleet-level failure, cost, retry, and approval metrics are not available from a single live source.

## 18. Ranked recommendations by impact

The recommendations below are deliberately not implemented by this audit.

### Immediate improvements

| Rank | Recommendation | Problem solved / benefit | Effort | Estimated cost | Risk / dependencies | Impact |
|---:|---|---|---|---|---|---|
| 1 | Add a durable generation-attempt record before provider invocation: request ID, code SHA, prompt hash/full prompt, reference byte hashes/order, model, endpoint, size, quality, background, seed if any, timestamps, response metadata, retry/fallback, raw/final URLs | Makes history, cost, retries, and approximate reproduction measurable | 2–4 days | Low engineering; storage/DB growth | Must avoid storing credentials; migration and Edge/client coordination | Fidelity evidence, consistency, operations |
| 2 | Make one versioned color/canvas contract authoritative and reject conflicting target/background values | Removes #F5F3EF vs #F6EFE8 drift and stale 2000×2200 references | 1–2 days | Low | Requires updating prompts, QA fixtures, and old CLI lane intentionally | Visual consistency |
| 3 | Make the UI show the exact compiled prompt, reference-role list, model, endpoint, canvas, and postprocess decision immediately before generation | Prevents hidden prompt/reference/provider differences between lanes | 1–2 days | Low | Must redact URLs/credentials where appropriate | Consistency and debuggability |
| 4 | Add pre-generation source QA: image dimensions, alpha/background classification, source padding, component-contrast warning, duplicate/hash check, and truth-conflict block | Prevents ambiguous or mismatched references from reaching the model | 3–5 days | Low–medium | Requires reference scanner and catalog policy | Fidelity and data quality |
| 5 | Treat generated output as candidate until automated release checks and explicit human state are present; keep raw and final URLs immutable | Prevents accidental use of raw/downscaled/review-only artifacts | 1–3 days | Low | Requires aligning library/UI and publish functions | Release safety |

### Near-term improvements

| Rank | Recommendation | Problem solved / benefit | Effort | Estimated cost | Risk / dependencies | Impact |
|---:|---|---|---|---|---|---|
| 6 | Introduce a component-aware 2D asset package per SKU/family: body silhouette, opaque hardware, cap, collar, pump, dip tube, label, and shadow/grounding layers with source hashes | Removes the model from exact geometry/occlusion decisions; preserves product fidelity | 2–6 weeks | Medium–high asset-prep cost | Requires reviewed source layers/PSD export and component taxonomy | Fidelity and consistency |
| 7 | Split scene generation from product preservation: generate/retouch background and lighting while compositing an identity-locked product layer or using an inpaint mask that protects the product | Stops geometry/material drift from being coupled to scene creation | 2–4 weeks | Medium provider/API and engineering cost | Requires masks/layers and a clear shadow/reflection owner | Visual quality and fidelity |
| 8 | Add semantic QA using a vision model or CV pipeline for component count, closure class, cap color, body color, liquid presence, label/OCR, and source/output similarity | Detects failures current framing QA cannot see | 2–5 weeks | Medium recurring inference cost | Needs labeled evaluation set and conservative thresholds | Fidelity and release safety |
| 9 | Add a real queue/worker execution record for long generations and batch runs; separate provider retries from semantic retries | Makes 504s, quota errors, and visual rejects operationally distinguishable | 1–3 weeks | Medium | Requires job status UI and idempotency keys | Operations and cost control |
| 10 | Unify local CLI and Edge prompt/provider contracts or mark the local lane explicitly as legacy | Prevents one lane from requesting 2080×2288 while reporting 2048×2048 and from using different Gemini prompt semantics | 1–3 weeks | Medium | Must preserve useful local batch workflows | Consistency and maintainability |

### Long-term improvements

| Rank | Recommendation | Problem solved / benefit | Effort | Estimated cost | Risk / dependencies | Impact |
|---:|---|---|---|---|---|---|
| 11 | Maintain layered, measurement-anchored product masters with calibrated transparent-glass, hardware, label, liquid, and shadow layers | Turns product identity into deterministic assets rather than prompt-only instructions | 1–3 months for a meaningful family set | High asset-production cost | Requires source PSD/photography cleanup and asset governance | Fidelity and consistency |
| 12 | Build a 2.5D reconstruction path with silhouette/depth/occlusion maps and a controlled lighting stage | Gives the system explicit front/back hardware and glass-depth relationships without a full 3D program | 2–4 months | High | Requires calibration, renderer/compositor, and reference measurements | Fidelity, consistency, visual quality |
| 13 | Build 3D digital twins for shared bottle families and closures, with SKU material/label/liquid parameters | Makes closely related SKUs deterministic and reusable across angles/scenes | 4–12 months | Very high | Requires modeling, measurement, material calibration, and rendering pipeline | All three: quality, fidelity, consistency |
| 14 | Train a product-specific adapter/fine-tune only after the structured asset/QA baseline exists | Can reduce prompt burden and improve family/style distribution, but should not replace exact layers | 1–3 months after dataset readiness | Medium–high recurring training/inference cost | Needs clean dataset, rights, evaluation set, and provider support | Visual quality/consistency; limited exact-fidelity benefit alone |

## 19. Evidence package

### Relevant source code

- supabase/functions/generate-madison-image/index.ts — Edge orchestration, contracts, refs, provider selection, storage, DB write, heartbeat.
- supabase/functions/_shared/openaiProvider.ts — exact OpenAI model types, endpoints, multipart edit request, size/quality mapping, no seed/mask interface.
- supabase/functions/_shared/aiProviders.ts — Gemini endpoint, model fallback chain, imageConfig, timeout, seed handling.
- supabase/functions/_shared/freepikProvider.ts — Freepik task/poll path and reference support.
- src/hooks/useAssembledPromptGeneration.ts — active UI request assembly, reference roles, visual-target block, rig invocation, reconciliation.
- src/components/darkroom/MastersTabPanel.tsx — Best Bottles product context, preflight, batch selection, approval UI.
- src/lib/bestBottlesPromptPreflight.ts — family/material/closure inference, prompt compilation, QA record.
- src/config/bestBottlesCatalogCanon.ts — vendored catalog canon and API defaults.
- src/config/bestBottlesFamilyProfiles.ts — family framing, scale zones, glass volume cue.
- src/config/bestBottlesVisualTarget.ts — style-only target and composition-safety block.
- src/lib/product-image/rigPostprocess.ts — browser-side bounds/translation/scale/background/QA pass.
- src/lib/product-image/framingQa.ts and src/lib/product-image/rigReview.ts — thresholds and approval evidence.
- src/lib/product-image/qc.ts — older paper-doll/component QC and explicit heuristic stubs.
- scripts/local-generate.ts — separate local OpenAI/Gemini batch lane, Sharp postprocess, CSV metrics.

### Configuration and contract files

- src/config/productImageDimensions.ts
- src/config/productImageCanvasTiers.ts
- src/config/imagePresets.ts
- docs/product-image-system/pixel-contracts.md
- docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md
- docs/BEST_BOTTLES_VISUAL_CALIBRATION_TARGET_V1.md
- .env.example (variable names only; no secrets included)

### Database migrations

- supabase/migrations/20251020071356_3208ae53-db6d-4013-9196-12e8552bdeea.sql — base generated_images table.
- supabase/migrations/20251020180129_fa6b3c6f-93b9-43b9-babf-877d3c219bc8.sql — reference-images bucket and reference metadata.
- supabase/migrations/20251021023825_8d66538d-6b7d-412c-bb94-81167b072dff.sql — generated-images bucket and public read policy.
- supabase/migrations/20260520010000_best_bottles_pipeline_sku_jobs.sql — SKU jobs.
- supabase/migrations/20260614120000_best_bottles_reference_intake_metadata.sql — reference source fields.
- supabase/migrations/20260710090000_best_bottles_image_reconciliation.sql — reconciliation and assignment tables/functions.
- supabase/migrations/20260712001000_best_bottles_model_shadow_evidence.sql — shadow evidence and approval controls.
- supabase/migrations/20260712003000_restore_best_bottles_approval_guard.sql — approval-field protection.
- supabase/migrations_archive/2026-07-10-orphaned-local-history/ — archived consistency/library/paper-doll migrations; relevant to schema drift assessment.

### Representative artifacts and comparisons

The following images are local review artifacts. They are not all proven to have been produced by the active Supabase master route; the manifests identify some as review-only or built-in-imagegen. They are included to make the visual evidence inspectable.

![Eight-item Cylinder pre-QA comparison](../outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/review/cylinder-preqa-comparison-row.png)

![Four 9 ml stone-studio review examples](../outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/review/best-bottles-9ml-stone-studio-pilot-contact-sheet.png)

#### Five representative completed/review outputs

1. [Clear metal roller, 2080×2288](../outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/final/01-clear-metal-roller-2080x2288.png) — review-only, generated_for_review, 9 ml Cylinder, 70 mm body, 20 mm diameter, 17-415, source baseline 1983, vertical shift +7 px.
2. [Clear plastic roller, 2080×2288](../outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/final/02-clear-plastic-roller-2080x2288.png) — review-only, source baseline 1997, vertical shift −7 px.
3. [Cobalt plastic roller, 2080×2288](../outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/final/03-cobalt-plastic-roller-2080x2288.png) — review-only, source baseline 2096, vertical shift −106 px; manifest notes cobalt reconstruction.
4. [Frosted metal roller, 2080×2288](../outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/final/04-frosted-metal-roller-2080x2288.png) — review-only, source baseline 2089, vertical shift −99 px.
5. [Cylinder family catalog-locked GPT Image 2 hero artifact](../outputs/imagegen/generative-polish/best-bottles-cylinder-family-hero-20260712/generated/best-bottles-cylinder-family-catalog-locked-gpt-image-2.png) — completed creative artifact; its reference manifest names GPT Image 2, but it is a wide family hero rather than a per-SKU approved master.

The first four examples contain exact-canvas and geometry metadata but the pilot manifest does not persist a complete prompt/model-parameter record. They are therefore visual examples, not reproducibility fixtures.

#### Five representative failed/blocked outputs

1. [1 ml vial, blocked](../outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/review/generated/02-gb1mlvblk.png) — 1197×1314; body −5.8% height, −7.0% width, baseline 1874 vs target 1990.
2. [3 ml sprayer, blocked](../outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/review/generated/03-gbspry3mlclblk.png) — 1196×1315; body −35.9% height, −22.0% width.
3. [Green 2.4 ml vial, truth conflict](../outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/review/generated/04-gbvgreen2o4blackcapsht.png) — 1197×1315; body −16.4% height, −22.0% width; source says green while canonical metadata says clear.
4. [4 ml sprayer, wrong actuator color](../outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/review/generated/05-gbspry4mlclblk.png) — 1196×1315; body −28.7% height, −26.0% width; rendered sprayer white instead of SKU black.
5. [9 ml tall Cylinder, too narrow/faceted](../outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/review/generated/09-gbtallcyl9gl.png) — 1195×1316; body −5.2% height, −12.4% width; optical read is square/prismatic rather than circular.

The source report for these five and the other three sample images is [VALIDATION-REPORT.md](../outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/qa/VALIDATION-REPORT.md). It marks the entire eight-item set FAIL / publish blocked.

### Sample manifests and logs

- outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/data/cylinder-grid-production-manifest.json — 54-item scope, exact references, measurements, target display scale, and review paths.
- outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/data/library-staging-manifest.json — explicitly separate from the pipeline and publish-blocked until approval.
- outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/qa/VALIDATION-REPORT.md — measured eight-item failure evidence.
- outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/data/manifest.json — four review examples and deterministic baseline shifts.
- tmp/best-bottles-sample-prompts.jsonl — sample prompts from the older compiler; useful history, not the authoritative current prompt source.
- docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md — current lane/lineage documentation; counts in that document are not live-verified here.

No production Supabase job record, raw Edge log export, or provider billing record was present in the local evidence package. That absence is itself a reproducibility/observability finding.

## 20. Unanswered questions and areas not verified

1. What is the current live row count and approval/failure distribution in generated_images, best_bottles_pipeline_sku_jobs, and reconciliation tables?
2. Which exact Supabase migrations are deployed in production after the archived local-history cutover? The local checkout contains references to columns whose original migrations are archived.
3. What percentage of production references are opaque flattened PNGs, transparent PNGs, GIFs, low-resolution images, or legacy lineages?
4. What are the real OpenAI/Gemini/Freepik per-image charges, latency distributions, retry counts, and approval attempts? The repository does not contain a billing/attempt ledger.
5. What provider-side retention/training terms apply to the actual API accounts and plans? This cannot be inferred from the code.
6. Are public generated/reference URLs acceptable for the product-asset security model, or should private buckets/signed URLs be used?
7. Are deleted/archive database rows accompanied by guaranteed storage-object deletion, and is there an orphan sweep?
8. Which current artifacts were generated by the active Supabase master route versus native/built-in imagegen, direct local CLI, or other review scripts? Several manifests intentionally say they are separate from the pipeline.
9. Does the deployed gpt-image-2 endpoint currently guarantee acceptance of the custom 2080×2288 edit size in the production account, and what is the actual high-resolution latency/timeout distribution?
10. Is #F5F3EF or #F6EFE8 the final approved Bone target? The active prompt/configuration contains both values.
11. Which SKUs have authoritative component layers or PSD exports for pumps, dip tubes, collars, labels, liquid state, and caps? The current image-generation route does not discover that automatically.
12. What proportion of human review failures are identity/geometry failures versus material/optical failures versus background/framing failures?
13. Are labels intentionally excluded from all catalog master images, or is there a future label-overlay lane that must be audited separately?
14. Is the local CLI still a supported production lane, or should it be formally retired/converted to use the Edge prompt and provenance contract?

### Bottom line

The system already has meaningful catalog identity, prompt versioning, framing normalization, reconciliation, and approval controls. Its limiting factor for clear-glass ecommerce fidelity is architectural: the current master request asks a generative image model to preserve and optically reconstruct a flattened product without a deterministic product layer, semantic masks, depth ordering, or 3D/2.5D representation. The strongest next step is therefore to improve provenance and truth gates immediately, then introduce component-aware product assets and deterministic compositing before investing in more prompt complexity or model training.
