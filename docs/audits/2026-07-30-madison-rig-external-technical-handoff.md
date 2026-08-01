# Madison Studio — Best Bottles image rig: external technical handoff

**Prepared:** 2026-07-30
**Repository:** `madison-app`
**Branch / commit inspected:** `codex/best-bottles-product-hub-pipeline` @ `3426195` (2026-07-23)
**Method:** read-only source inspection. No provider call, deployment, database write, Shopify write, or Convex write was made to produce this document.
**Purpose:** answer an external reviewer's architecture questionnaire about whether this rig can produce ~3,000 photorealistic e-commerce images inside a $1,000 budget while holding 40+ fitment/closure variants per bottle shape visually identical.

**Evidence rule used throughout:** runtime code outranks prose documentation. Where a number is an unverified estimate rather than a measurement, it is labelled as such. Three claims that a reader might expect to find are explicitly *absent* from this system, and saying so is part of the answer.

---

## 0. One-paragraph summary

The active Best Bottles catalog-master path is a **reference-locked, image-to-image generative edit against a single closed-API model (`gpt-image-2`), followed by browser-side framing normalization and heuristic QA.** It is not a 3D renderer, not a layer compositor, not a masked-inpainting system, and not a fine-tuned or otherwise identity-conditioned model. There is no ControlNet, no IP-Adapter, no depth or normal map, no seed, and no denoise-strength control. Every fitment variant is an independent full-image regeneration from its own separate reference photograph. Consistency is not enforced at generation time; it is partially *repaired* afterwards by rescaling and re-centring the whole raster. The pipeline has strong identity, lineage, approval, and Shopify-publishing safeguards, and it produces publishable candidates today — but it structurally cannot guarantee that the glass body, liquid level, and contact shadow stay fixed while the closure changes, because the entire product is re-drawn each time.

---

## 1. Base AI engine & pipelines

### Foundation models

| Lane | Model | Endpoint | Status |
|---|---|---|---|
| **Best Bottles catalog master (the lane in question)** | **OpenAI `gpt-image-2`** | `POST /v1/images/edits` | **Forced. No fallback.** |
| Best Bottles filled-hover twin | `gpt-image-2` | same | Same contract |
| Material pilot (experimental) | `gpt-image-2` | same | Separate lane, has cost telemetry |
| Generic Madison Dark Room | `gpt-image-2` default; Gemini or Freepik selectable | generations/edits | Not used for catalog masters |
| Freepik (available, unused here) | `flux-dev`, `flux-pro-v1-1`, `hyperflux`, `seedream`, `seedream-4`, `mystic` | Freepik REST | Never reached on the locked path |

For a reference-locked Best Bottles master the router **overwrites** whatever provider/model the caller requested and pins `openai` + `gpt-image-2`. If `OPENAI_API_KEY` is absent the request returns HTTP 500 rather than degrading to another provider. The default model id is read from an `OPENAI_IMAGE_MODEL` secret so it can be rolled forward without a redeploy.

**Not present anywhere in the system:** Stable Diffusion 1.5, SDXL, self-hosted Flux, Midjourney, any fine-tune, any LoRA, any textual inversion, any custom checkpoint, any product-specific trained model. A repository-wide grep for `controlnet|ip-adapter|lora|finetune|depth_map|normal_map|canny` returns no runtime hits.

### Inference orchestration

```
React + Vite SPA  (Vercel)
        │  HTTPS invoke — no queue, no job table
        ▼
Supabase Edge Function  `generate-madison-image`  (Deno/TypeScript, 3,169 lines)
        │  auth → org resolution → contract/identity/reference gates
        │  reference URL fetch → base64 (5 MB per ref, 12 MB total cap)
        ▼
OpenAI Images API   /v1/images/edits
        │  model=gpt-image-2, n=1, size=2080x2288, quality=high,
        │  output_format=png, background=auto, ordered image[] parts
        ▼
Supabase Storage (public `generated-images` bucket) + Postgres row
        ▼
Browser Canvas / OffscreenCanvas — "family rig" postprocess + QA
        ▼
Human review → guarded approval RPC → single-use Shopify authorization → publish
```

- **No ComfyUI, no Automatic1111, no Python, no GPU node, no self-hosted inference of any kind.** The rig is API-only.
- **No durable generation queue or attempt table.** UI batching is sequential orchestration over HTTP.
- Batch runs use a `tsx` CLI, `scripts/best-bottles/generate-family-batch.ts`: bounded concurrency (default **2**, `BB_GEN_CONCURRENCY`), **2 attempts max** (`BB_GEN_MAX_ATTEMPTS`), 1.5s × attempt backoff, incrementally-written resumable manifest. Because the rig postprocess is browser code, the batch runner opens **one Playwright page per concurrency slot** to execute it.

---

## 2. Geometry control & spatial conditioning

### Conditioning layers: none

The complete set of parameters sent to the provider is:

```
model, prompt, n, size, quality, background, output_format, [user], image[]…
```

That is the whole request. There is **no mask, no seed, no ControlNet, no IP-Adapter, no depth/normal/Canny preprocessor, no denoise or strength value, no reference-weight**.

### What substitutes for spatial control

Three non-model mechanisms carry the entire burden:

1. **One flattened photographic reference PNG per SKU**, attached as an `image[]` part. Reference ordering is meaningful (product refs first, then background, then style), and the edge function enforces exactly one product reference plus at most one style reference.
2. **Canonical millimetres injected as prompt prose.** Physical truth comes from `docs/best-bottles-canonical-truth/best-bottles-master-truth.csv` (2,484 data rows) via the `canon_*` columns, plus a family × size body-geometry table. The model receives these as *text*, not as geometry.
3. **Post-hoc browser normalization** — the "family rig". It detects the foreground envelope, normalizes the background to Bone `#F5F3EF`, then **scales / translates / recanvases the entire raster** onto the 2080 × 2288 target, and QA-checks the result.

Active rig thresholds:

| Check | Threshold | Behaviour |
|---|---|---|
| Canvas | exactly 2080 × 2288 | Contract-enforced |
| Baseline | warn > 4 px, fail > 8 px | Normalize / review |
| Primary centreline | fail > 2.5% from target | Normalize / review |
| Fill height | family range, ±0.5 pp tolerance | Reject only if > 12 pp beyond range |
| Crop | primary bounds must stay in canvas | Fail / reject |
| Sidecar floor | shared baseline, 8 px default tolerance | Active |
| Model shadow contact | gap ≤ 2 px; right extension 0.20–0.30 (fail > 0.32); left extension fail > 0.12; depth fail > 3.5% of canvas | Pass / review / fail, with auditable exception mechanism |

### 3D / CAD reference usage: none

`three` and `@react-three/fiber` are dependencies, but the only 3D surface in the app is a packaging-box preview component. **No STEP, no OBJ, no CAD import, no depth map extracted from 2D imagery, no photogrammetry.** The lane is pure img2img plus text.

---

## 3. Masking & inpainting mechanics

### Fitment swapping: there is no isolation step

Every closure/fitment variant is a **complete full-image regeneration** from that variant's own separate reference photograph. There is no static pixel mask, no SAM/segmentation pass, no neck-coordinate bounding box, and no partial re-render.

This is a deliberate contract, not an oversight. The provider wrapper **does** implement mask support — it appends a PNG mask part to the multipart form when an `editMask` is supplied — but the Best Bottles master lane rejects mask/control references outright, with the error text:

> "Cylinder master generation no longer accepts a mask/control reference. Use one flattened product-truth reference only."

There is additionally a hard blocklist of reference tokens (`mask-control`, `mask_ref`, `best-bottles/mask-imports/`, and the retired transparent/background-removed types) evaluated before the provider is ever called.

**Consequence for the 40-variant question:** the system does not, and in its current contract cannot, hold one glass body constant and swap a closure onto it. It renders 40 whole bottles.

### Determinism: no

No seed is sent to OpenAI, and `gpt-image-2` exposes none on this endpoint. Repeated runs with byte-identical inputs can materially change proportions, cap shape, glass wall thickness, internal hardware (dip tubes), reflections, and shadow. A recorded eight-item review sample measured **5.8%–35.9% product height error**. Placement *after* rigging is far more reproducible than the product pixels themselves.

### The one deterministic exception — and why it matters

`src/lib/product-image/sidecarCapSplice.ts` (added 2026-07-19) exists because `gpt-image-2` was measured relighting metallic detached caps by **ΔRGB 36 on copper and 13 on gold** against byte-locked reference truth, and no prompt language stopped it. The adopted fix discards the model's rendered cap entirely and **splices in the reference photograph's own cap pixels** — keyed onto Bone, scaled to the rendered bottle's proportions, seated on the shared baseline, with a rig-painted contact shadow.

This is the only place in the system where output pixels are guaranteed to match the physical product. It is a working, shipped precedent for deterministic component compositing inside the existing rig, and it was reached empirically after prompting failed.

---

## 4. Glass material & rendering quality

### Optical handling: prompt text plus an optional style plate

Two mechanisms, both non-physical:

**(a) Canon prompt blocks** (`src/config/bestBottlesCatalogCanon.ts`) carry per-material language:

- *Clear/flint*: transparency, optical cleanliness, background visible through the glass with natural refraction and slight optical displacement, studio-card reflections, crisp rim/shoulder/thread/base definition; explicit negatives against liquid, tint, haze, cloudy fill, bubbles, sidewall noise.
- *Amber / cobalt / green*: saturation is described as the dominant visual identity; hue and chroma must not desaturate, grey out, wash, or shift; a cross-polarized-capture deepening effect is requested explicitly.
- *Frosted*: surface diffusion, milky muted body colour, sharp speculars suppressed in favour of broad soft highlights.
- *Swirl*: pattern must remain intact with denser swirls reading more saturated and thinner swirls more transparent.
- Global negatives against "barcode-like vertical stripes", duplicated rails, etched contour lines, and hard full-height highlight bands — these are known recurring artefacts.

**(b) An optional second, style-only reference plate** (`src/config/bestBottlesVisualTarget.ts`). SHA-256-pinned material plates exist for clear, cobalt, amber, green, and swirl, each tagged `transferMode: "style"` or `"optical-material"`. In `optical-material` mode the prompt asserts that Image 1's spatial mask, outer contour, wall boundaries, and proportions are immutable and Image 2 governs only hue, transmission, refraction, and specular behaviour inside those boundaries — an instruction the model is asked to respect, with no mechanism enforcing it. **Cobalt and amber plates are still marked v3 candidates under review (2026-07-20), not promoted to production.**

**Floor caustics and contact shadow are model-owned**, then heuristically QA'd against the thresholds in §2. Background is normalized to Bone `#F5F3EF` with a requested 18–28% contact-shadow opacity.

### What is not validated

There is **no glass-distortion scorer, no refraction validator, no dip-tube / internal-hardware detector, no liquid-level detector, no closure classifier, no component counter, no OCR or logo comparison, and no pixel-level product-identity similarity metric** in the active master lane. Those failure classes are caught by human review or not at all.

### Resolution & upscaling

- Native output: **2080 × 2288 PNG (10:11 exact), `quality=high`**. Both edges are multiples of 16 to satisfy the model's size constraint.
- **There is no upscaling or super-resolution step in this lane at all** — no Real-ESRGAN, no Ultimate SD Upscale, no provider upscaler. (Freepik exposes an `/upscale` endpoint; the master path never calls it.)
- The rig's recanvas resamples the full raster, which can slightly soften product pixels rather than sharpen them.
- Other pixel contracts in the wider system, for reference: paper-doll composition canvas 1000 × 1300; an example Sanity CDN hero 928 × 1152.

---

## 5. Infrastructure, speed & unit economics

### Hosting

| Layer | Where |
|---|---|
| Frontend SPA | Vercel (Vite build, SPA rewrites) |
| Generation orchestration | Supabase Edge Functions (Deno) |
| Inference | OpenAI API (no self-hosted compute) |
| Storage / DB | Supabase Storage (public bucket) + Postgres |
| Rig postprocess | Browser Canvas; Playwright pages in batch mode |
| Batch driver | Local `tsx` CLI |

**No RunPod, Vast.ai, fal.ai, Replicate, or any GPU rental is used for generation.** (fal.ai/Replicate credentials exist for a separate `remove-background` function that the locked master path does not call.)

### Cost per image — not measured

This is the most consequential gap for the budget question.

| Figure | Source | Status |
|---|---|---|
| `$0.095` / image | `src/pages/BestBottlesPipeline.tsx` UI constant | **Hard-coded estimate. Not billing.** |
| `$0.25` / image ("Director-Pro" / Pro Photography) | same file | **Hard-coded estimate.** |
| `$0.08` / `$0.04` | legacy paths + `scripts/local-generate.ts` | **Hard-coded estimate.** |
| `estimated_cost_usd` column | material-pilot lane only (migration `20260715010000`) | Persisted, but experimental lane only |

**The production master lane persists no cost, no latency, no attempt count, and no provider response metadata.** A trustworthy current cost-per-approved-image cannot be computed from this repository. It has to come from the OpenAI billing dashboard.

### Speed — measured

- Typical `gpt-image-2` edit at 2080 × 2288 `quality=high`: **120–155 seconds**.
- Recorded 61-job manifest (2026-07-05): successful elapsed **117.2 s – 292.1 s, median 144.3 s, mean 160.9 s**.
- This routinely exceeded Supabase's **150 s gateway idle timeout**, which is why a whitespace-heartbeat streaming wrapper (keepalive every 20 s) had to be added to the edge function.
- Comparative timeouts on unused paths: Gemini 60 s default; Freepik polls ~120 s.

### Failure / re-render rate — no ledger exists

No durable attempt record is written before the provider call, so a true rate cannot be derived. The available hard data points:

| Evidence | Figure |
|---|---|
| 2026-07-05 manifest, 61 jobs | 32 rendered, **29 billing-limit failures**; 28 one-attempt, **33 two-attempt** |
| Reference-role binding audit | **272 of 328 jobs invalid** (136 identities shared one reference across two roles); 9 outputs quarantined |
| Cylinder tracker, 2026-07-23 | 385 persisted rows; 287 with linked image evidence; 280 with Shopify destination evidence; **only 2 rows carry the strict `approved-keep` verdict**; 278 rows are live in Shopify *without* a recorded final quality verdict |
| Cylinder generation audit, 2026-07-29 | 240 already live, 44 approved-and-ready-to-push, **95 needing reference/source cleanup**, 41 needing canonical-copy review, 7 needing generation review |
| Full-catalog readiness artifact (2026-07-12) | 1,601 ready, **640 needs-reference**, 4 needs-measurement, 238 component-exception |

Observed failure classes, ranked by how they were caught:

| Failure | Detected by | Retry value |
|---|---|---|
| Wrong role / cap topology | Post-hoc audit only | None until reference source is fixed |
| Product scale error (5.8–35.9%) | Framing QA | Rig corrects moderate error; > 12 pp rejects |
| Wrong actuator/cap colour | Human | Variable; correct reference is the real fix |
| Clear glass reads flat / cutout | **Nothing** | Prompt/style plate may help; no guarantee |
| Missing or wrong dip tube / internal hardware | **Nothing** | Non-deterministic |
| Glass tint drift, plasticity, liquid hallucination | **Nothing** | Prompt only |
| Extra / missing detached component | **Nothing** (no semantic counter) | Fix reference, then review |
| Cropping / off-centre / baseline | Framing QA | Rig is effective |
| Shadow mismatch | Heuristic shadow QA | Auditable exception path exists |

---

## 6. Integration & workflow orchestration

### Convex

Convex holds Best Bottles product truth, measurements, and finished image URLs. Its role in the generation loop is narrower than one might assume:

- **Reads** go through a thin proxy edge function taking `{path, args}`, so the deployment URL stays server-side and the `convex` client never enters the browser bundle.
- **Convex does not trigger render jobs.** There is no Convex → generation webhook, scheduler, or queue.
- **Convex does not supply the geometry the generator uses.** Canonical physical truth comes from repo CSVs (`canon_*` columns). Convex's `widthMm` / `depthMm` are known-bad diameter copies and are explicitly excluded. 839 SKUs still await a measurement sync-back, which is owned by the sibling Best-Bottles-Website repo, not by Madison.
- **Writes are one-directional and post-hoc**: only *after* a successful Shopify push does the pipeline call `POST {convexUrl}/api/mutation` to patch `imageUrl` / `imageUrlCapOff`, guarded by a write token.

So Convex is, in effect, a product-truth read source plus a finished-URL sink — not part of the generation control loop.

### Shopify

**Fully automated via the GraphQL Admin API**, and this is the most robust part of the system:

- `productCreateMedia` → poll until media status is READY (explicit failure path if processing fails) → `productVariantAppendMedia`.
- `productVariantDetachMedia` + `listVariantMedia` for replacement, so re-pushes don't accumulate duplicates.
- SKU → variant resolution **throws if it does not match exactly one variant**.
- Publication requires a **server-issued single-use authorization** plus `approved-keep` state; manual visual-identity approval is required for matched Best Bottles variants.
- Optional same-transaction Convex sync as described above.

There is no manual upload step.

---

## 7. Primary bottlenecks

### 1. The architecture has no mechanism for the exact requirement being asked of it

"40 fitments, locked body, locked material, locked contact shadow" requires either spatial conditioning (mask / ControlNet / depth) or explicit layer compositing. This rig has neither on the master lane. Worse for diagnosis, the mask parameter **is wired into the provider wrapper and switched off by contract** — so this is a policy boundary, not a missing capability. Consistency is currently retrofitted by resampling the entire raster after the fact, which can reposition and rescale a bottle but cannot restore geometry, hardware, or optics the model invented.

The `sidecarCapSplice` module is the strongest internal signal here: when a component's fidelity actually had to be guaranteed, the team abandoned prompting and shipped deterministic pixel replacement. That approach works and is already in the codebase — it has simply not been generalized from "detached cap" to "body + closure".

### 2. No cost, latency, or attempt telemetry — the budget question is unanswerable from the system

Nominal arithmetic, using the repo's own unverified `$0.095` constant:

| Scenario | Renders | Cost | Wall clock @ 150 s, concurrency 2 |
|---|---:|---:|---:|
| 3,000 images, first-attempt success | 3,000 | ~$285 | ~62 h |
| At the observed ~1.54 attempts/success | ~4,620 | ~$440 | ~96 h |
| At `$0.25` (Pro tier) and 1.54 attempts | ~4,620 | ~$1,155 | ~96 h |

The spread between those rows is the entire budget question, and the deciding variable — real `gpt-image-2` billing at 2080 × 2288 `quality=high` — is not recorded anywhere in this system. Throughput is arguably the harder constraint than spend: **62–96 hours of generation wall clock**, each render followed by a browser rig pass, and then human review on essentially every image (2 of 385 Cylinder rows have cleared final review).

Concretely missing: a generation-attempt record written *before* the provider call, capturing model, reference hashes, prompt hash, request parameters, code commit, latency, retry count, and billed cost.

### 3. The reference estate — not the model — is the upstream gate

640 of the readiness artifact's rows are `needs-reference`; 95 Cylinder rows need source cleanup; 272 of 328 audited jobs were invalid on reference-role binding alone. No amount of prompt or model work fixes an image generated from the wrong or a low-resolution source.

The compounding irony: the estate contains 4,000+ layered Photoshop sources, and the contract **flattens them before the model sees anything**. The component separation that would make deterministic compositing (and therefore true variant locking) possible is discarded at the last step before it could be used.

---

## Appendix A — Verification map

Every claim above traces to one of these. Line numbers are from commit `3426195`.

| Claim | Location |
|---|---|
| `gpt-image-2` forced, no fallback, 500 on missing key | `supabase/functions/generate-madison-image/index.ts:2439-2464`, `2495-2510` |
| Provider routing policy | `supabase/functions/_shared/bestBottlesProviderRouting.ts` (whole file, 22 lines) |
| `/v1/images/edits` request construction; exact parameter list | `supabase/functions/_shared/openaiProvider.ts:408-465` |
| Mask support exists in wrapper | `supabase/functions/_shared/openaiProvider.ts:447-451` |
| Mask/control references rejected on master lane | `supabase/functions/generate-madison-image/index.ts:1961-1975` |
| Retired/blocked reference token list | `supabase/functions/generate-madison-image/index.ts:586-594` |
| Default model from `OPENAI_IMAGE_MODEL` secret | `supabase/functions/_shared/openaiProvider.ts:37-40` |
| Supported sizes incl. `2080x2288` | `supabase/functions/_shared/openaiProvider.ts:52-68` |
| 120–155 s latency, 150 s idle timeout, heartbeat wrapper | `supabase/functions/generate-madison-image/index.ts:3155-3168` |
| Rig normalization, QA thresholds, transform | `src/lib/product-image/rigPostprocess.ts` (3,212 lines) |
| Deterministic cap splice, ΔRGB 36 / 13 measurement | `src/lib/product-image/sidecarCapSplice.ts:1-17` |
| Glass optics + per-material prompt language | `src/config/bestBottlesCatalogCanon.ts:45-127` |
| Style / optical-material plates, SHA-256 pins, v3 candidate status | `src/config/bestBottlesVisualTarget.ts:85-130`, `240-330` |
| Bone hex, shadow opacity band | `supabase/functions/_shared/bestBottlesBackgroundAndShadowPrompt.ts` |
| Cost constants `$0.095` / `$0.25` / `$0.08` / `$0.04` | `src/pages/BestBottlesPipeline.tsx:4122-4176`; `scripts/local-generate.ts:2296` |
| Cost telemetry, pilot lane only | `supabase/migrations/20260715010000_best_bottles_material_pilot.sql`; `supabase/functions/generate-bestbottles-material-pilot/index.ts:273,300` |
| Batch concurrency 2 / 2 attempts / 1.5 s backoff / Playwright rig | `scripts/best-bottles/generate-family-batch.ts:28-33,144-145,1134-1171` |
| Convex read proxy | `supabase/functions/bestbottles-convex/index.ts:1-56` |
| Convex write only post-Shopify | `supabase/functions/backfill-bestbottles-convex-images/index.ts:360-380`; `supabase/functions/push-bestbottles-pdp-image/index.ts:147,185-195` |
| Shopify GraphQL media + variant attach/detach, single-variant guard | `supabase/functions/push-shopify-product-images/index.ts:425,785,928,944,1000,1095,1179-1205` |
| Canonical truth CSV, 2,484 data rows | `docs/best-bottles-canonical-truth/best-bottles-master-truth.csv` |
| Cylinder tracker counts, `approved-keep` = 2 | `docs/audits/best-bottles-cylinder-generation-shopify-audit-2026-07-23.md` |
| Cylinder disposition counts (240 live / 95 needs-reference / 44 ready) | `docs/best-bottles-cylinder-generation-audit.md` |
| 61-job manifest stats; role-binding defect 272/328; readiness 1,601 / 640 / 4 / 238 | `docs/audits/2026-07-15-best-bottles-image-generation-pipeline-technical-audit.md` §12, §16 |
| Pixel contracts (2080×2288 / 1000×1300 / 928×1152) | `CLAUDE.md`; `src/config/productImageDimensions.ts` |
| No 3D use for bottles (three.js = packaging preview only) | `src/components/press/Box3DPreview.tsx` |
| No upscaler on master lane | repo-wide grep: only `freepikProvider.ts:665-691` (unused here) and a reference-fetch 2× Lanczos in `scripts/fetch-bestbottles-live-references.ts:116-124` |

## Appendix B — Explicit negatives

Stated so a reviewer does not have to infer absence from silence. None of the following exist in the active Best Bottles master lane:

seed · mask / inpainting on this lane · ControlNet · IP-Adapter · T2I-Adapter · depth map · surface-normal map · Canny/edge map · SAM or any segmentation pass · LoRA · fine-tune · custom checkpoint · embedding-based identity model · 3D/CAD asset · deterministic glass shader · component-layer compositor (except the cap splice) · exact label overlay · upscaler / super-resolution · durable job queue · generation-attempt ledger · per-image cost or latency record · provider-revised-prompt persistence · automated OCR/logo/closure/component/liquid/glass-distortion validation · code-commit attachment per output.

## Appendix C — Open questions the reviewer will likely need answered from outside the repo

1. Actual OpenAI billing for `gpt-image-2`, `/images/edits`, `2080 × 2288`, `quality=high`, 1–2 reference parts — the single number that decides the $1,000 question.
2. Live counts for generated / QA-passed / `approved-keep` / rejected / pushed / reconciled, as opposed to tracker-row counts.
3. Human review minutes per image, and current reviewer capacity.
4. Whether the flattened-reference contract is negotiable — i.e. whether the 4,000+ layered PSDs can be exported as component packages (body / fitment / cap / label / shadow) rather than flattened rasters. This is the pivot point between "patch the existing rig" and "rebuild the conditioning layer".
5. What share of visual rejections are identity vs geometry vs glass/material vs component vs framing vs shadow. No labelled eval set exists today.

---

## Addendum (2026-07-30, same day): direction decided — the Paper-Doll Rig

Everything above documents the **as-is** system and remains accurate. Following this
audit, the forward architecture was designed and its decisions locked the same day.
The design of record is
**`docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md`** (visual version with
diagrams and the canvas A/B decision record:
https://claude.ai/code/artifact/d782ffe0-cb56-495a-9400-3c5a63536dc3).

For a reader of this audit, the key resolutions:

- **Appendix C #4 is answered: yes** — the flattened-reference contract is being
  superseded for the new lane. Layered PSDs export as alpha-preserving *components*
  (body plates + a closure library keyed by `neckThreadSize × applicator × colorway`),
  and SKU images become deterministic composites: generate each body once, composite
  closures, weld only the junction/dip-tube band under a reviewed mask, then clamp —
  original body pixels restored byte-for-byte outside the mask. §7's "no mechanism for
  the requirement" finding is resolved by construction rather than by model choice.
- **Bottleneck #1 (no spatial locking)** — resolved by the composite+clamp
  architecture; the 40-fitment consistency requirement becomes pixel-identity by
  construction, not a statistical hope.
- **Bottleneck #2 (no telemetry)** — build task 0 of the new lane is the
  generation-attempt ledger plus a real billing pull.
- **Bottleneck #3 (reference estate)** — the component model replaces per-SKU flattened
  references with per-part components (~100–200 catalog-wide), collapsing most of the
  `needs-reference` backlog.
- Art direction locked: canvas stays **Bone `#F5F3EF`** (owned constant — zero code
  change); shadow is rig-painted ambient contact, no directional cast; one-soft-source
  light contract enforced at component intake.
- No SD/ComfyUI/ControlNet rebuild, no fine-tune: rejected deliberately — rationale in
  the design doc's Non-goals.

Estimated new-lane economics (unverified until the ledger exists): ~200–400 body
generations + ~1,200 clamped welds ≈ $150–400 and 10–25 h wall clock for the ~3,000
images, vs ~$440–1,155 and 62–96 h under full regeneration.
