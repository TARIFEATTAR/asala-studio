# Best Bottles Website + Madison Studio
## Project Status, Scope, Bottlenecks, and Completion Plan

**Status date:** 2026-07-15  
**Repositories reviewed:**

- Best Bottles website: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026`
- Madison Studio: `/Users/jordanrichter/Projects/Madison Studio/madison-app`

**GitHub repositories:**

- [asalastudio/best-bottles-website](https://github.com/asalastudio/best-bottles-website)
- [asalastudio/madison-studio-cursor](https://github.com/asalastudio/madison-studio-cursor)

## Executive summary

The Best Bottles project is not one unfinished feature. It is a public storefront, a commerce/data system, Grace, a CMS and handoff program, and a catalog-scale image factory. The original SOW and the current image-factory effort must be reported as separate but connected workstreams.

The public website is substantially built and the Best Bottles `main` branch contains a verified launch-reconciliation baseline, product catalog/PDP/Grace work, Shopify checkout foundations, Sanity visual editing, SEO/content corrections, legal-page scaffolding, and CI. The current repository evidence does not prove that all original launch-critical commerce and handoff requirements are complete. In particular, TaxJar/Avalara, FedEx carrier-rate integration, expert knowledge sessions, formal ownership transfer/training, and final production verification need an explicit current status check.

Madison’s image system is substantially more advanced than a one-off image script. It has SKU identity gates, canonical measurement truth, versioned prompt and framing contracts, reference-role controls, deterministic framing QA, shadow QA, reconciliation records, approval gates, Shopify guards, and local-only recovery plans. It is still a production system under construction: the latest plans have not run paid generation, Supabase/Convex mutations, Shopify mutations, or full live verification.

The most important conclusion is this:

> The project has built much of the control system around image generation, but the catalog is not yet complete until every required product identity has an approved image, the final image has passed human and machine QA, the correct Shopify product/variant has received it, Convex/staging reflect the Shopify URL, and the live PDP has been verified.

There is no single honest “project percentage.” The correct status is a gate-based readout:

| Area | Current evidence | Status |
|---|---|---|
| Public storefront foundation | Main branch, catalog/PDP/Grace, Sanity, SEO/content, CI, legal-page scaffolding | Substantially built; launch closure not fully evidenced |
| Original SOW baseline | Historical May scoreboard: 4/12 complete, 4/12 partial, 4/12 not started | Needs current re-baseline |
| Madison image-factory code | 380 Best Bottles image-coverage tests pass; catalog-scale tests pass; build passes | Strong implementation baseline |
| Catalog-wide image readiness | 1,601/2,245 bottle-body candidates marked ready in the 2026-05-14 readiness snapshot | 71.3% of that snapshot; not a live approval count |
| Cylinder production readiness | 228/377 production-qualified; 149/377 blocked in the current local readiness artifact | 60.5% qualified; not generated/published completion |
| Latest Cylinder role plan | 172 strict two-role-ready; 11 hard-blocked; 328 local role jobs; zero external writes | Ready for controlled execution, not live |
| Paid generation and publishing | Paid generation, Supabase/Convex mutation, Shopify mutation, and full live verification not run in the latest evidence | Blocked at external execution gates |
| Madison release state | Local branch is 87 commits ahead of its remote branch, with extensive uncommitted/untracked work; GitHub PR #17 remains draft/open | Release integration required |

## What the original SOW covered

The documented SOW launch plan describes four pillars and twelve deliverables. The table below preserves the documented May baseline and adds the current evidence found in the two repositories.

| SOW pillar | Deliverable | Documented baseline | Current evidence / remaining work |
|---|---|---|---|
| Brand Intelligence | Brand Brain knowledge system | Done | Implemented in Best Bottles/Grace; current knowledge quality and deployment should still be verified in production. |
| Brand Intelligence | Product intelligence for 2,000+ variants | Done/exceeded: 2,354 variants, about 258 groups, 63 fitments | Catalog projections still differ between repos and snapshots. Canonical measurement work found 839 of 2,483 SKUs with at least one wrong/unusable dimension; Best Bottles owns the Convex sync-back. |
| Brand Intelligence | Expert sessions with Abbas and Abduljalil | Not started in the May plan | No current repo/GitHub evidence proves the required recorded sessions were completed. This remains an explicit confirmation item. |
| Brand Intelligence | Grace MVP | Done/exceeded | Grace v3, tool calling, compatibility/recommendation flows, voice configuration, and truth guardrails are present. Open draft PR #36 still contains older family-minimum truth work and is not merged. |
| Technical Foundation | Headless architecture + Sanity CMS | Done | Main branch includes the headless app, Convex, Sanity, and visual editing integration. Production configuration and ownership still need verification. |
| Technical Foundation | Home, PLP/catalog, and PDP | Done, with additional pages | Current main includes catalog/PDP/checkout foundations, blog/resources/forms, and recent footer/legal work. Smoke test passed locally; final browser/production smoke is still a release gate. |
| Technical Foundation | Code ownership transfer + Sanity/API training | Partial | Handoff documentation exists, but no evidence of a completed formal transfer/training session was found. |
| E-commerce Experience | Paper Doll Product Builder | About 15% in May: Cylinder 5ml/9ml live; other families not complete | The project has expanded into a broader Madison image factory. The paper-doll/layered family scope remains incomplete unless explicitly replaced by the single-PNG PDP strategy. |
| E-commerce Experience | Image preparation/alignment for the initial catalog | Empire-only and partial in May | Madison has a much larger reference-locked factory and QA system, but the complete approved catalog image set is not finished. |
| B2B Operations | Tax-exempt automation | Not started in the May plan | No TaxJar/Avalara implementation or completion evidence was found in the current Best Bottles repo/GitHub record. |
| B2B Operations | FedEx weight-based shipping | Not started in the May plan | No FedEx carrier-rate integration or completion evidence was found. Mentions in Grace training/portal copy are not proof of a working checkout integration. |
| B2B Operations | Shopify Plus checkout/product/webhook sync | About 30% in May | Main includes checkout guards, Shopify/Convex foundations, media sync tooling, and recent reconciliation work. Product/variant sync, tax, shipping, end-to-end checkout, and production credentials still need a current pass/fail verification. |

### SOW work that was explicitly beyond the original launch scope

The May SOW plan identifies the following as Phase 2 or scope expansion rather than launch-critical SOW work:

- B2B portal shells and self-service operations.
- Madison’s AI hero-image pipeline/image factory.
- Grace v3 workspace and advanced interaction patterns.
- Clerk authentication and multi-tenant scoping.
- UX-audit polish backlog.
- Mixpanel/provider-agnostic analytics layer.
- Additional paper-doll families and full-family AI hero batches.

The documented Phase 2 estimate was approximately 7–11 weeks and $35k–$45k for portal work, additional paper-doll families, Grace expansion, and additional AI hero batches. That estimate does not constitute a current approved estimate for the newer reference/role-aware image-factory work.

## Full scope currently being built

The actual current scope is best understood as six connected workstreams.

### 1. Product truth and catalog reconciliation

- Reconcile live Best Bottles PDP evidence, Convex, the master catalog, the catalog PDF, Shopify/Grace identities, and Madison’s operational data.
- Preserve exact `websiteSku` and `graceSku` identity without fuzzy sibling substitution.
- Correct body dimensions, with-cap dimensions, real width/depth semantics, family taxonomy, color/material truth, applicator, cap state, and component topology.
- Maintain a canonical body geometry model: 118 distinct physical bodies across 28 families in the 2026-07-12 truth sheet.
- Sync the 839-SKU measurement correction set back through the Best Bottles website/Convex lane; Madison must not write those Convex changes.

### 2. Public website, Grace, CMS, and trust surfaces

- Home, catalog/PLP, PDP, search/filtering, fitment, cart, quote/sample/contact flows.
- Grace product search, recommendations, compatibility, navigation, voice, and truth guardrails.
- Sanity content, visual editing, blog/resources, SEO metadata, sitemap/robots, legal/trust pages.
- Analytics, error monitoring, production domain/configuration, mobile QA, accessibility/tap-target cleanup, and final smoke tests.

### 3. Commerce and B2B operations

- Shopify product/variant sync and exact SKU matching.
- Cart-to-checkout flow and webhook/state synchronization.
- Tax-exempt handling through TaxJar/Avalara or the selected provider.
- FedEx/Shopify carrier-rate integration.
- Quote-only/product purchase rules, quantity pricing, fitment/cart behavior, and end-to-end checkout validation.

### 4. Image-factory inputs and reference production

- Build one canonical reference for each product identity and required image role.
- Normalize cap state to `cap-on` and `cap-off`/PDP sidecar roles.
- Audit PSD/source files without mutating the original evidence.
- Produce opaque, exact-identity, hash-addressed reference exports with enough resolution for generation.
- Preserve provenance, source hashes, review decisions, topology exceptions, and blocked identities.

### 5. Image generation, QA, approval, and publication

- Compile one SKU-aware prompt from canonical identity/material rules, family framing, scale, shadow topology, and the visual calibration target.
- Generate with the locked Best Bottles provider/model policy.
- Normalize framing and run geometry/background/shadow QA.
- Record raw and final URLs, prompt/reference/catalog hashes, model/provider, canvas, rig, QA, and lifecycle state.
- Require human identity/applicator/material review before `approved-keep`.
- Push only the exact approved image to the exact Shopify product/variant.
- Mirror the Shopify CDN URL to Convex and verify the rendered staging/live PDP.

### 6. Release, security, and handoff

- Merge the Madison pipeline work into a reviewable branch/PR.
- Confirm deployed Supabase migrations and Edge Function source match the local contracts.
- Rotate any credentials that were exposed in Git history; PR #49 explicitly records that ElevenLabs and Shopify credentials must be rotated.
- Decide whether public source/generated URLs are acceptable or whether signed/private storage is required.
- Complete code ownership transfer, Sanity/API training, runbooks, and client sign-off.

## Current image-generation process

The current master lane is a reference-locked image edit. It is not a 3D reconstruction, a deterministic renderer, or a true layer compositor.

### Step 1 — Select and resolve the product

The operator selects a SKU. Madison resolves the product context: website and Grace SKU, family, capacity, material/color, body geometry, neck/thread, closure/applicator, cap state, topology, source reference, measurements, identity status, prompt version, rig version, scale contract, and shadow policy.

The reference is not trusted merely because it exists. It must be the correct identity and role. The current Cylinder lane accepts one product-identity reference and, where allowed, one style-only reference. It rejects extra product references, background references, masks/control references, transparent/retired reference types, and unresolved identity.

### Step 2 — Preflight and compile the prompt

The prompt is assembled from:

1. `src/config/bestBottlesCatalogCanon.ts` — identity/material/studio canon.
2. `src/config/bestBottlesFamilyProfiles.ts` — family framing, scale zone, baseline, centerline, fill range, and sidecar behavior.
3. `src/lib/bestBottlesPromptPreflight.ts` — product/family/material/closure/topology inference and QA tags.
4. `src/config/bestBottlesVisualTarget.ts` — style-only calibration and composition-safety instructions.

The prompt tells the model to preserve the exact silhouette and components, render empty clear glass correctly, preserve hardware and dip tubes, use the Bone background, respect the fixed canvas and product placement, and avoid liquid, haze, stripes, props, text, extra objects, and changed hardware.

The prompt is a contract and a strong instruction set. It is not a pixel-level mask or depth map.

### Step 3 — Call the image model

The locked Best Bottles master path uses OpenAI `gpt-image-2` through the Images edit endpoint, with the product reference as the first image and an optional style-only reference. The target is an opaque PNG at **2080 × 2288**, the 10:11 catalog-master contract.

The request does not currently send a mask, denoise/strength value, ControlNet/depth map, normal map, IP-Adapter, LoRA, 3D model, or OpenAI seed. The model must reconstruct the bottle pixels, transparent optics, hardware, occlusion, and shadow from the flattened product reference plus language.

### Step 4 — Save raw output and provenance

The Edge Function uploads the returned PNG to Supabase Storage and writes a `generated_images` row with the prompt, provider, references, context, tags, and image URL. The reconciliation layer records source/prompt/catalog hashes, canvas, bounds, baseline, centerline, fill, shadow policy, QA, lifecycle state, and raw/final URLs.

### Step 5 — Deterministic framing pass

The browser/local rig measures the visible foreground and can recanvas, scale, translate, place on the shared baseline, center the primary product, preserve sidecar placement, normalize the Bone background, and run framing/shadow checks. This improves repeatability of placement and canvas geometry.

It does not reliably restore a missing pump, fix a dip tube that merged into the background, reconstruct transparent depth, or repair a product whose geometry was redrawn incorrectly by the model.

### Step 6 — QA and approval

The candidate is not complete because the API returned 200. Machine QA checks canvas, bounds, fill, baseline, centerline, background, identity gates, and shadow evidence. Human review must confirm product identity, applicator/closure state, material/surface, crop, and visual quality. The approval RPC is the release gate for `approved-keep`.

### Step 7 — Publish and verify

Only the exact approved image may be pushed. The downstream chain is:

```text
Madison approved final
  -> exact Shopify product/variant/media
  -> Shopify CDN URL
  -> Convex mirror
  -> staging/live PDP rendering
  -> live verification record
```

The latest local evidence has not completed this chain for the full current target set.

## Why this is an image factory, not a one-off image

A one-off image can be judged by a person as a single creative artifact. A person can make manual edits, accept small inconsistencies, and keep the source context in their head. The system does not need to know whether the next 2,482 products share the same body, cap state, baseline, prompt version, or Shopify identity.

An image factory has to solve all of those problems simultaneously:

- **Scale:** the operational catalog contains about 2,483 pipeline products, 118 physical bodies, 28 families, and hundreds of applicator/color/cap combinations.
- **Identity:** a visually similar sibling is still the wrong product. `GB09BlackCapApp` must not be routed to a Cylinder roll-on identity merely because the SKU prefix looks similar.
- **Shared geometry:** the same body must keep consistent dimensions across variants, while cap height and applicator topology can change by SKU.
- **Multiple roles:** a product may require an identity/cap-on image and a separate PDP cap-off sidecar composition. Those roles cannot share mutable pointers or be inferred from a filename alone.
- **Quality at release:** every image needs machine evidence, human review, a stable lifecycle state, and a downstream publication assignment.
- **Cross-system correctness:** the image must attach to the correct Shopify product/variant, then appear in Convex and the rendered PDP.
- **Repeatability:** the system must explain which reference, truth snapshot, prompt, model, canvas, rig, and postprocess produced the image.
- **Failure handling:** one bad image must not contaminate a whole family batch, silently overwrite a good image, or be treated as complete because an `image_url` exists.

### Why transparent bottles make this especially difficult

Clear glass is not a flat colored object. The final pixels have to communicate silhouette, wall thickness, front and rear walls, refraction, optical density, edge highlights, base rings, internal hardware, background transmission, and contact shadows. In the flattened source image, a white pump or dip tube can have pixels that are visually close to the white background. The model must infer that the hardware is a separate object behind or inside transparent glass while also replacing the scene background.

That is fundamentally different from asking for “a premium bottle photo.” The model may:

- erase or merge a white pump/dip tube into the background;
- put hardware on the wrong depth plane;
- turn a dip tube into a reflection or stripe;
- make glass cloudy, plastic-like, tinted, or liquid-filled;
- redraw a round Cylinder as slender, faceted, or too narrow;
- change an actuator color;
- add or remove a cap or accessory;
- create a shadow that floats, disconnects, doubles, or bridges objects.

The current model/prompt path can reduce these errors and the QA system can reject them. It cannot guarantee exact pixel ownership because the active master path lacks a deterministic product layer, semantic masks, depth ordering, and a seed/strength control. That is why retries are not a complete strategy: another attempt may produce a better result by chance, but it does not fix the underlying ambiguity.

## What has been improved in the current pipeline

The latest Madison work has moved the system from a loosely connected image-generation workflow toward a controlled factory:

- Canonical product truth and measurement precedence are documented and hash-addressed.
- Geometry is keyed to the physical bottle body, not blindly to each SKU or raw Convex diameter.
- A global catalog scale curve separates capacity-owned display scale from family corrections.
- Cap-on identity and cap-off/PDP sidecar roles are independent and explicit.
- PSD/source evidence is audited immutably, with human review decisions and source hashes.
- Transparent/retired reference cutovers are blocked unless the evidence is explicitly valid.
- Cylinder V6.1 requires a versioned prompt, model-owned shadow policy, topology evidence, geometry QA, and human review.
- The role-aware plan is sealed and local-only until external execution is explicitly authorized.
- Local framing recovery can normalize exact `2080 × 2288` opaque outputs without another model call.
- Studio, batch, and server lanes are being converged on the same reference roles and canonical geometry.
- Shopify writes are guarded by exact organization, job, product identity, generated-image identity, `approved-keep`, and explicit publish authorization.
- The workbench now distinguishes reference lineage from image quality/approval; “has an image” is not the same as “complete.”

## Current bottlenecks and issues

### A. No single current catalog projection

The repositories contain several valid but different snapshots:

- Best Bottles local catalog-integrity check: **2,474 products / 369 product groups**, with no duplicate Grace SKUs, missing Grace SKUs, or orphan group references in that check.
- Madison runtime reconciliation snapshot: **2,483 runtime products / 358 product groups**.
- Madison canonical truth sheet: **2,483 rows**, 118 physical bodies, 28 families, and 839 SKUs requiring measurement correction or review.
- Older master/Convex reconciliation: **2,321 master rows, 2,474 Convex rows, 2,483 enriched/runtime rows**, with 9 master-to-Convex gaps and 162 Convex-to-master extras.

These are not automatically contradictory because they were generated at different times and from different joins, but the project needs one dated release manifest before mass generation or publishing.

### B. Reference and evidence coverage is incomplete

The latest Cylinder production-readiness artifact reports:

- 377 canonical publication identities.
- 242 local reference exports.
- 228 production-qualified identities.
- 14 below the one-megapixel minimum.
- 135 evidence-blocked identities.
- 149 total blocked identities.

The role-aware plan partitions the same publication universe into execution routes, including 11 hard-blocked identities. These are readiness/planning artifacts, not proof of final images.

### C. Paid generation and external state are still gated

The latest global-scale verification explicitly records paid generation, Supabase/Convex mutation, and Shopify mutation as not run. The V6.1 closeout runbook requires explicit authorization before the smoke allowlist or full 377-target generation can run. The local role remediation outputs remain `review-pending`/`not-promoted`.

### D. The model is still responsible for too many product pixels

Prompt instructions describe glass, hardware, refraction, and shadows, but the active master lane does not give the provider a product silhouette mask, component layers, depth map, or 3D geometry. This is the root cause of the hardest failures and cannot be solved reliably by adding more prompt adjectives.

### E. Multiple lanes still have different behavior

The active Edge master lane, local CLI lane, older prompt compiler, historical paper-doll artifacts, and review-only creative artifacts are not one identical execution path. The audit also found a real Bone color split between `#F5F3EF` in older canon/brief material and `#F6EFE8` in the current Cylinder visual-target/contract path. One authoritative contract is still needed.

### F. Provenance, cost, and retry observability are incomplete

Exact recreation is not currently possible for OpenAI masters because the system does not persist every provider request byte hash/order, provider-revised prompt, code SHA, seed, complete postprocess recipe, or a durable attempt/cost record. Provider cost, approval attempts, retry rates, human review time, and live generation latency are not available from one reliable ledger.

### G. The current Madison release is not cleanly integrated

The local Madison branch `codex/best-bottles-product-hub-pipeline` is 87 commits ahead of its remote branch and has approximately 66 modified files, 21 deleted files, and 196 untracked files. GitHub PR #17 is still draft/open and reflects the earlier broad workbench head, not the full July 12–15 hardening. The branch needs a deliberate cleanup, commit/review strategy, and deployment plan.

### H. Typecheck is not green

The current Madison `npx tsc -p tsconfig.app.json --noEmit` run fails. The output includes pipeline-specific errors in `build-cylinder-reference-production.ts`, `run-cylinder-dual-role-remediation.ts`, `generate-prompts.ts`, `bestBottlesFamilyProfiles.ts`, and current Cylinder production-readiness tests, in addition to a large pre-existing app/database typing backlog. The Madison Vite build still passes, and the focused Best Bottles tests pass, but the repository cannot honestly be called type-clean.

### I. Some launch requirements are present only as copy or plans

FedEx appears in portal/training language, but no working carrier-rate integration was found. TaxJar/Avalara appear in the SOW plan, but no implementation was found. Legal pages are present in merged PR #53, but the PR explicitly requires client review of return/damage windows, governing law, carrier naming, and the free-shipping discrepancy.

### J. Security and production-operations verification remain open

Best Bottles PR #49 records that previously exposed ElevenLabs and Shopify credentials remain in Git history and must be rotated. Madison’s audit also identifies public source/generated URLs, incomplete storage cleanup evidence, and unverified provider retention/training terms. These are operational decisions and verification tasks, not image-generation code tasks.

## What is complete, in progress, and still needed

### Complete or substantially complete

- Best Bottles public application foundation, catalog/PDP/Grace surfaces, and Sanity integration.
- Product-group/catalog integrity checks in the current Best Bottles Convex deployment snapshot.
- Main-branch content truth corrections, SEO/canonical fixes, checkout configuration guard, CI, shared footer, and legal-page scaffolding.
- Madison Best Bottles workbench, SKU-level identity/preflight, reference roles, prompt canon, family framing, rig postprocess, reconciliation/approval structures, and Shopify guardrails.
- Canonical measurement-truth and geometry documentation, including explicit source precedence and body-vs-variant rules.
- Focused Madison verification: 380 image-coverage tests passed; catalog-scale suite passed 19/19; PSD-audit suite passed 71/71; Vite build passed.

### In progress

- Canonical reference and PSD evidence production/review.
- Cylinder role-aware remediation and sidecar recovery.
- Convergence of Studio, local batch, and Edge/server reference/prompt/geometry authority.
- Completion of the production readiness and closeout manifests.
- Current Best Bottles content/security hardening: open PR #55 CSP report-only baseline and open draft PR #36 Grace truth drift guardrails.
- Reconciliation of the original SOW against the current live environment and Linear state.

### Still required for a complete image-factory launch

1. Approve one current catalog/release manifest and resolve all identity/taxonomy/measurement conflicts.
2. Finish or explicitly disposition the 149 blocked Cylinder readiness rows, including the 11 hard blockers.
3. Complete human review of required reference roles and seal the final allowlist.
4. Receive explicit billing/provider authorization and run a bounded smoke matrix.
5. Review smoke outputs for identity, geometry, material, applicator, cap state, baseline, scale, and shadow.
6. Run the full approved generation set, resumably and cohort-by-cohort.
7. Approve each candidate through the reconciliation/approval RPC; never mark an image complete from generation success alone.
8. Publish only approved images to exact Shopify products/variants.
9. Sync Shopify media IDs/URLs to Convex and verify rendered PDP/staging output.
10. Produce a final closeout report with counts for approved, rejected, regenerated, published, live-verified, and blocked.

### Still required for the original SOW launch

The current evidence does not close the following without external confirmation or implementation:

- Tax-exempt automation decision, credentials, implementation, and test checkout.
- FedEx carrier-service/weight-based shipping setup, credentials, and test checkout.
- Full Shopify product/variant sync and webhook verification.
- Expert knowledge sessions with Abbas and Abduljalil, if still required by the SOW.
- Formal code ownership transfer and Sanity/API training.
- Final production domain/env verification, analytics accounts, error monitoring, and full launch smoke test.
- Client/legal approval of the new legal pages and any shipping/returns claims.
- Credential rotation and production security review.

## Completion plan

### Gate 0 — Decide what “complete” means

Create a signed/current re-baseline with three separate acceptance columns:

1. **SOW v1 launch complete:** original twelve deliverables and launch blockers.
2. **Phase 2/product-platform complete:** portal, Grace expansion, additional families, and other deferred work.
3. **Image factory complete:** catalog scope, image roles, quality definition, approval/publish chain, and operational handoff.

Without this gate, the project can appear unfinished forever because Phase 2 expansion is being measured against a Phase 1 SOW.

### Gate 1 — Lock truth and ownership

- Best Bottles repo owns Convex/catalog measurement sync-back.
- Madison owns generation, Supabase, image contracts, and the factory UI.
- Cowork/reference-prep lane owns reviewed source artifacts and lane-segmented handoffs.
- One dated release manifest becomes the only mass-generation input.
- Confirm final Bone color, final image role set, and whether labels are excluded from catalog masters.

### Gate 2 — Clean the implementation baseline

- Resolve the pipeline-specific type errors.
- Separate generated/local artifacts from source changes.
- Restore/reconcile migrations deliberately; do not treat a dirty migration folder as deployable truth.
- Update or supersede draft PR #17 with the July pipeline work.
- Make local CLI and Edge prompt/provider/provenance behavior either identical or explicitly separate and supported.
- Add a durable generation-attempt record before paid generation.

### Gate 3 — Complete evidence before spending on generation

- Finish canonical reference exports, exact SKU filenames, source hashes, cap state, topology, and review decisions.
- Rebuild the readiness/role-aware artifacts.
- Require zero unresolved hard blockers in the authorized cohort; do not force the entire catalog through because a date is approaching.

### Gate 4 — Controlled generation

- Run the smoke matrix across capacity, material, family, applicator, cap state, and topology archetypes.
- Stop a cohort after systemic QA failures rather than retrying indefinitely.
- Review raw/final/reference triplets and record provider failures separately from visual QA failures.
- Then run the full approved set in bounded, resumable batches.

### Gate 5 — Approval, publication, and live verification

- Require machine QA plus human identity/applicator/material/shadow approval.
- Publish only exact `approved-keep` jobs.
- Verify Shopify media, Convex mirror, and rendered PDP URLs match.
- Record final counts and leave rejected/blocked identities visible in the worklist.

### Gate 6 — Website launch and handoff

- Close the remaining SOW commerce/integration items.
- Confirm production domain, analytics, monitoring, legal copy, and credentials.
- Run the full launch smoke test.
- Complete ownership transfer and training.
- Deliver final runbooks and a client-facing closeout with all exceptions.

## Verification performed for this update

### Madison Studio

- Best Bottles image-coverage suite: **380 passed, 0 failed**.
- Catalog-scale suite: **19 passed, 0 failed**.
- PSD audit suite: **71 passed, 0 failed**.
- Vite development build: **passed**; existing large-chunk warnings remain.
- TypeScript: **failed**; see the typecheck issue above.
- Current local worktree: extensive uncommitted/untracked pipeline work; no external writes performed by this audit.

### Best Bottles website

- Catalog smoke test: **3 passed, 0 failed**.
- Catalog integrity check: **STATUS OK** for the inspected deployment snapshot: 2,474 products, 369 product groups, zero duplicate Grace SKUs, zero missing Grace SKUs, zero orphan product-group references.
- Best Bottles `main` is cleanly committed at the July 11 Sprint 1 baseline, with two small local modifications and one untracked audit directory in the inspected checkout.

### GitHub status reviewed

- Best Bottles PR #49: merged launch-reconciliation baseline; records credential-rotation and catalog/image follow-ups.
- Best Bottles PR #51: merged content truth, Grace Empire correction, SEO/canonical fixes, checkout guard, and CI.
- Best Bottles PR #53: merged shared footer/legal pages; client/legal review remains.
- Best Bottles PR #55: open report-only CSP baseline; review notes call for an aggregation endpoint and future removal of `unsafe-inline`/`unsafe-eval` before enforcement.
- Best Bottles PR #36: open draft Grace family truth drift guardrails; not merged.
- Madison PR #17: open draft broad Best Bottles image-workbench publication; local Madison has materially advanced beyond the PR head.

## Questions that must be answered to close the remaining uncertainty

These are the only questions that materially change the completion plan:

1. Is the acceptance target the original Phase 1 SOW launch, the expanded platform/portal, the complete catalog image factory, or all three? The recommended answer is to track all three separately.
2. Were the Abbas/Abduljalil knowledge sessions completed and recorded, and where is the authoritative handoff artifact?
3. Are TaxJar/Avalara and FedEx integrations actually live in Shopify, or are they still outstanding SOW work?
4. What is the current production source of truth for catalog counts and product-group IDs: Best Bottles Convex, the master catalog, or a new signed release manifest?
5. What is the approved final Bone color: `#F5F3EF` or `#F6EFE8`?
6. Is paid generation authorized now, and what budget/attempt policy should govern the smoke and full batches?
7. Which human reviewers are authorized to approve image identity, material, applicator, shadow, and publication readiness?
8. Is the local Madison CLI a supported production lane, or should the Edge/Studio lane become the only supported path?
9. Are public Supabase source/generated URLs acceptable for Best Bottles assets, and what are the provider retention/training requirements?
10. Should the final deliverable be client-facing only, internal only, or the two-layer format used by this document?

## Primary evidence files

### Best Bottles website repository

- `docs/SOW_LAUNCH_PLAN_2026-05-04.md`
- `docs/PRODUCT_LAUNCH_GAMEPLAN.md`
- `docs/AIOS_SHOPIFY_PDP_IMAGE_PIPELINE.md`
- `docs/IMAGE_PIPELINE_CONTRACT.md`
- `docs/DATA_QUALITY_AUDIT.md`
- `docs/data_alignment/PARITY_FINAL_REPORT.json`
- `docs/PHOTOGRAPHER_HANDOFF.md`

### Madison Studio repository

- `docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md`
- `docs/best-bottles-image-generation-pipeline-audit-2026-07-14.md`
- `docs/best-bottles-catalog-reconciliation.md`
- `docs/best-bottles-generation-readiness.md`
- `docs/best-bottles-global-scale-verification.md`
- `docs/best-bottles-canonical-truth/BEST-BOTTLES-CANONICAL-TRUTH.md`
- `docs/best-bottles-canonical-truth/AGENT-HANDOFF.md`
- `docs/best-bottles-cylinder-v6-1-closeout-runbook.md`
- `docs/best-bottles-family-workflow-sequence-cylinder.md`
- `public/data/best-bottles-cylinder-production-readiness.json`
- `tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json`
- `docs/superpowers/plans/2026-07-14-best-bottles-image-pipeline-audit.md`
- `docs/BEST_BOTTLES_COST_AND_TIME_AUDIT_2026-07-15.md`
