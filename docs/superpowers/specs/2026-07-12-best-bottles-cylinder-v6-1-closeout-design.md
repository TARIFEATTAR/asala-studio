# Best Bottles Cylinder V6.1 Closeout Design

Date: 2026-07-12
Status: Approved design, pending implementation plan
Scope: Canonical Best Bottles Cylinder catalog only

## Objective

Close the complete canonical Cylinder catalog with one strict V6.1 generation contract, reviewed product-truth references, model-owned contact shadows, deterministic geometry normalization, durable QA evidence, and verified PDP publication.

The closeout target is an auditable 384-row Cylinder source ledger resolving to 377 unique website/Shopify publication targets. Seven duplicate website-SKU pairs and the additional `Tall Cylinder` alias must reconcile to canonical Grace SKUs; aliases retain lineage but never generate or publish a competing image.

All 377 final publication images must be regenerated with the final V6.1 contract. Existing V6.0 renders are evidence and rollback material, not final-family completion assets.

## Current Baseline

- Auditable Cylinder source rows: 384
- Unique website/Shopify publication targets: 377
- Generation-ready rows: 272
- Rows missing approved references: 112
- Local flattened reference candidates: 274
- Legacy website-only reference candidates: 99
- Rows requiring manual source matching: 11
- Existing generation manifest: 82 rendered, 221 billing failures, 8 rig failures
- Measurement overrides pending catalog synchronization: 10
- Missing catalog joins: 7

These counts are planning inputs. The implementation must regenerate a fresh read-only ledger before any external write or paid generation and fail if the SKU universe drifts unexpectedly.

## Non-Goals

- Enabling V6.1 for non-Cylinder families
- Treating components, accessories, packaging, or gift items as Cylinder products
- Using transparent, mask, paper-doll, background-removed, or legacy clean-lane images as generation references
- Generating directly from PSD files
- Automatically promoting legacy website imagery to canonical product truth
- Automatically approving, publishing, or replacing images that fail any machine or human gate

## Canonical Product Ledger

The pipeline must build one immutable closeout ledger retaining all 384 source rows and a derived set of 377 publication targets keyed by canonical Grace SKU, with website SKU as the strongest cross-system alias. Each publication target must include:

- canonical Grace SKU
- website SKU
- Shopify SKU/variant target
- family and product-group slug
- product identity and material fields
- capacity and measurements
- applicator and cap state
- approved reference path, URL, hash, dimensions, alpha state, and provenance
- resolved framing profile
- resolved V6.1 prompt/shadow policy
- generation, QA, approval, Shopify, and Convex lifecycle state

Only the eight reviewed alias mappings may collapse identity: seven duplicate website-SKU pairs plus `GBTallCyl9WhtSht`. Any additional duplicate remains a blocker. A publication target cannot proceed when product identity, catalog join, measurements, or destination is ambiguous.

## Reference and PSD Contract

### Runtime reference

Generation consumes exactly one reviewed opaque PNG per SKU. The reference is product-identity truth, not canvas-framing truth.

Required reference properties:

- exact canonical SKU match
- exact product and cap/applicator state
- one complete sellable product composition, including any intentional detached sidecar component
- opaque pixels with no alpha channel or transparent pixels
- reviewed neutral/white flattened presentation
- no mask, paper-doll, background-removed, or retired clean-lane lineage
- durable source provenance and SHA-256 hash

The runtime reference may retain its native source dimensions. The final generation canvas is always 2080 x 2288 and is governed by the framing profile and rig.

### PSD role

PSDs are upstream recovery and provenance sources. They are never sent directly to the image model.

For a missing reference:

1. Match PSD conservatively by exact normalized website SKU or reviewed crosswalk.
2. Inspect layers and pixels to confirm product identity, cap state, object count, and completeness.
3. Reject component-only, alternate-view-only, uncapped-only, ambiguous, or mismatched sources.
4. Export one opaque flattened product-truth PNG non-destructively.
5. Review the export against catalog truth and record the PSD path, export hash, and reviewer decision.
6. Upload under a new canonical object path; do not overwrite an existing reference object.
7. Update the SKU job only after dry-run reconciliation and explicit write approval.

Legacy website images may be used as identity evidence or assisted crosswalk input. They cannot become canonical generation references without the same inspection and export qualification.

## Strict V6.1 Policy

Every canonical Cylinder ledger row must resolve to one production prompt version:

`best-bottles-reference-locked-v6.1`

The experimental `best-bottles-reference-locked-v6.1-shadow-smoke` identifier remains historical lineage only and cannot be emitted by new production generation.

For every Cylinder SKU:

- shadow owner is `model`
- deterministic rig shadow painting is prohibited
- the Edge runtime must accept the exact V6.1 record and reject V6.0, legacy, missing-version, mixed-owner, or conflicting-shadow records
- browser compiler and Edge runtime prompt constants must pass exact parity tests
- prompt, Library tags, reconciliation rows, and generation identity must carry the canonical version and ownership fields
- no caller-supplied metadata may override the canonical Cylinder policy

Non-Cylinder products retain their existing policy until separately approved.

## Model-Owned Shadow Contract

V6.1 uses a single lighting direction: a soft camera-left key producing a restrained contact shadow that feathers behind and toward camera-right.

Shared requirements:

- shadow is visibly attached at each real contact point
- densest contact core is approximately 32-42% opacity
- feather fades within approximately 20-30% of the primary bottle width unless the reviewed contact topology requires a smaller sidecar footprint
- contact core and feather form one continuous grounded shadow per contact object
- no detached oval, contact gap, hard outline, dramatic cast, doubled shadow, reflection, glossy floor, floor plane, smear, horizon, vignette, or background texture

Contact topology is derived from reviewed reference truth:

- assembled bottle: one bottle-base contact shadow
- detached cap or applicator: bottle and sidecar each receive an attached shadow with identical direction and compatible softness
- bulb, tassel, hose, or complex assembly: shadow only beneath visible physical contact points; accessories that do not touch the surface receive no invented grounding shadow

The topology is an input to prompt compilation and QA. It cannot be inferred solely from generic applicator text when the reviewed reference proves a different state.

## Rig Responsibilities

The rig owns geometry, not shadow appearance.

It must:

- normalize the fixed 2080 x 2288 canvas
- apply the resolved family/profile fill-height target
- seat the primary bottle on the shared baseline
- preserve the primary centerline and detached sidecar placement
- preserve model-owned shadow pixels through recanvas and the same scale/translation as their contact object
- exclude shadow pixels from product geometry, baseline, fill-height, and centerline measurements
- never paint, replace, strengthen, or synthesize a deterministic shadow for V6.1 Cylinder output

If a model-owned shadow is absent or invalid, the result becomes `review-pending` or `qa-failed`. The rig cannot silently repair it or fall back to V6.0 behavior.

## Shadow and Image QA

Machine QA must evaluate:

- prompt version and shadow ownership lineage
- exact reference hash and provenance
- output dimensions and Bone background contract
- product bounds, fill height, baseline, and centerline
- cap/applicator state and component count where machine-verifiable
- shadow contact gap
- contact-core density
- direction and right-extension ratio
- vertical depth and maximum spread
- connected component count per expected contact object
- absence of floor seams, reflections, detached shadows, and overlong tails
- preservation of product geometry after shadow masking

Shadow QA must accept an expected contact-object topology rather than assume every Cylinder output has exactly one shadow component.

Human review must confirm:

- exact SKU identity
- exact cap, applicator, finish, and component state
- correct glass/material appearance
- correct relative scale and family consistency
- visually natural, restrained contact shadows
- no AI artifacts, duplicate parts, invented surfaces, or identity drift

Approval remains fail-closed. A passing report must use the exact production shadow contract; missing or wrong contract values remain review-pending.

## Rollout Sequence

### Gate 1: Ledger and catalog truth

- freeze and hash the 384-row source ledger and its 377 publication targets
- reconcile the seven website-SKU pairs and the Tall Cylinder alias
- resolve 10 measurement overrides and 7 missing catalog joins
- prove exact Shopify/Convex targets without writing images

### Gate 2: Reference qualification

- validate all existing flattened candidates
- recover or create the 112 missing approved references
- produce a per-SKU reference manifest with provenance and hashes
- require 377/377 eligible publication-target references before the full paid batch

### Gate 3: V6.1 archetype qualification

Run a controlled paid smoke matrix representing at minimum:

- 3 ml, 4 ml, 5 ml, 9 ml, 25-30 ml, 50 ml, 100 ml, and large plastic Cylinder sizes
- clear, amber, cobalt, frosted, swirl, and opaque/plastic materials
- assembled and detached-cap compositions
- fine-mist sprayer, lotion pump, metal and plastic roller, cap/closure, reducer, antique bulb sprayer, and bulb/tassel assemblies

Every archetype must pass identity, framing, material, and topology-aware shadow review before full-family generation.

### Gate 4: Full regeneration

- generate all 377 publication targets with the locked V6.1 compiler and deployed Edge runtime
- use a resumable manifest with immutable prompt, reference, and policy hashes
- never skip an older V6.0 render as complete
- stop the affected cohort on systemic QA failure rather than consuming the whole budget

### Gate 5: Review and approval

- build a review gallery grouped by archetype, capacity, material, and applicator
- surface reference, raw render, rigged render, geometry QA, shadow QA, and lineage together
- require explicit human confirmation and strict reconciliation RPC approval

### Gate 6: Publication and verification

- run Shopify publication preflight
- let the authorized operator perform the go-live action
- record Shopify CDN URL even when downstream Convex sync needs retry
- verify Shopify media, Convex `products.imageUrl`, storefront PDP output, and reconciliation state
- require 377/377 publication verdicts and 384/384 source-row resolutions with no stale V6.0 image, unresolved alias, or approved-not-pushed target

## Error Handling and Resumability

- Reference, catalog, prompt, and topology failures block before provider spend.
- Provider billing/rate failures remain retryable without changing prompt or reference identity.
- Rig geometry failure and shadow QA failure are distinct manifest outcomes.
- A resumed run verifies prompt, reference, and policy hashes before skipping any row.
- Any hash drift creates a new attempt/version rather than mutating historical evidence.
- Shopify success plus Convex failure records `shopify-pushed` and the CDN URL, then retries Convex separately.
- Terminal approved/pushed/synced rows cannot be relinked or overwritten without an explicit rollback workflow.

## Verification Strategy

Required automated verification includes:

- Cylinder policy resolver tests proving all 384 source rows resolve to V6.1/model ownership and exactly 377 generation identities
- non-Cylinder regression tests proving no unintended policy expansion
- browser/Edge exact prompt parity tests
- rejection tests for V6.0 and mixed shadow authority on Cylinder
- assembled, detached sidecar, and complex-accessory prompt topology tests
- synthetic shadow QA fixtures for each topology
- rig tests proving preservation, transform parity, geometry exclusion, and zero deterministic shadow paint
- reference provenance, alpha, cap-state, alias, and hash validation tests
- resumable manifest hash tests
- strict approval and terminal-state SQL/client tests
- full Best Bottles suite, TypeScript checks, targeted lint, diff check, and production build

Before production activation, apply and verify the shadow-evidence migration, deploy the synchronized Edge Function, download the deployed source for parity confirmation, and execute the controlled smoke matrix.

## Completion Criteria

Cylinder is closed only when:

- the canonical ledger contains exactly 384 source rows resolving to exactly 377 publication targets
- all catalog joins and measurements are resolved
- 377 approved publication-target reference manifests pass validation
- every final output was generated with canonical V6.1 and model shadow ownership
- every output passes geometry and topology-aware shadow QA
- every output receives explicit human approval through the strict reconciliation gate
- every Shopify and Convex target matches the approved final URL
- every storefront PDP verifies live with no drift
- no Cylinder row remains missing-reference, review-pending, failed, approved-not-pushed, stale-V6.0, or identity-ambiguous

## Operational Safety

Implementation may prepare code, tests, reports, dry runs, manifests, and review artifacts without additional approval. Remote migrations, Edge deployments, paid batch generation, approval writes, Shopify publication, Convex mutation, branch push, and merge remain explicit external checkpoints and must be announced before execution.
