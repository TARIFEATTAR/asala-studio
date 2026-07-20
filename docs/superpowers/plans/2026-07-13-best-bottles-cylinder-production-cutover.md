# Best Bottles Cylinder Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canonical Cylinder reference set the only selectable production cohort, feed `canon_*` geometry into paid generation, persist complete reconciliation evidence, and support auditable shadow-only review exceptions without uploading, generating, or publishing during the cutover.

**Architecture:** A pure cutover planner consumes the immutable v2 reference manifest and blocker report and emits a public, source-path-free readiness artifact for all 377 canonical publication targets. The paid runner joins that artifact by exact Website SKU + Grace SKU, replaces snapshot measurements with canonical values, and records raw/rig evidence through pure reconciliation payload builders. Studio uses the same readiness artifact as an outer generation gate. Shadow exceptions remain separate append-only evidence bound to exact hashes; machine QA is never rewritten.

**Tech Stack:** TypeScript, Node `tsx`, React, Supabase/Postgres migrations, Node test runner, Vite.

## Global Constraints

- Read `docs/best-bottles-canonical-truth/BEST-BOTTLES-CANONICAL-TRUTH.md` in full before geometry work.
- Consume only `canon_bodyHeightMm`, `canon_widthAxisMm`, `canon_secondAxisMm`, and variant `canon_heightWithCapMm` for generation geometry.
- Join canonical identities by exact normalized `websiteSku + graceSku`; never fall back to loose aliases.
- Preserve all 145 evidence blockers and the 13 current sub-1MP technical blockers; never substitute or silently upscale.
- The cutover performs zero external writes, zero paid image generations, and zero Shopify/Convex/Sanity changes.
- Preserve the existing dirty worktree and do not reset, discard, or overwrite unrelated changes.

---

### Task 1: Authoritative Cylinder production-readiness artifact

**Files:**
- Create: `src/lib/bestBottlesCylinderProductionCutover.ts`
- Create: `src/lib/bestBottlesCylinderProductionCutover.test.ts`
- Create: `scripts/best-bottles/build-cylinder-production-cutover.ts`
- Create: `scripts/best-bottles/build-cylinder-production-cutover.test.ts`
- Modify: `package.json`
- Generate: `public/data/best-bottles-cylinder-production-readiness.json`

**Interfaces:**
- Consumes: v2 production manifest and blocker report.
- Produces: `buildCylinderProductionReadiness()` and a 377-row, source-path-free public artifact with exact identity, canonical axes, reference hashes, resolution state, and blockers.

- [ ] **Step 1: Write failing pure-planner tests** asserting 219 production-qualified rows, 13 `reference-below-minimum-pixels` rows, 145 evidence-blocked rows, disjoint identities, and no source paths.
- [ ] **Step 2: Run tests and verify RED** with a missing-module failure.
- [ ] **Step 3: Implement the minimal pure planner** with an exact 1,000,000-pixel rule and deterministic sorting.
- [ ] **Step 4: Run tests and verify GREEN.**
- [ ] **Step 5: Write failing artifact-builder tests** for provenance hashes, immutable JSON shape, and `externalWriteCount: 0`.
- [ ] **Step 6: Run tests and verify RED, then implement and verify GREEN.**
- [ ] **Step 7: Generate the public artifact locally and independently validate its counts.**

### Task 2: Canonical geometry cutover in the paid family runner

**Files:**
- Create: `scripts/best-bottles/family-batch-canonical-product.ts`
- Create: `scripts/best-bottles/family-batch-canonical-product.test.ts`
- Modify: `scripts/best-bottles/generate-family-batch.ts`

**Interfaces:**
- Consumes: a production-readiness row plus the legacy snapshot metadata row.
- Produces: `applyCanonicalCylinderGeometry()` returning the prompt/generation product with canonical body height, assembled height, width axis, and second axis; non-Cylinder rows remain unchanged.

- [ ] **Step 1: Write failing tests** proving a 9 ml roller `63 -> 70 mm`, frosted 9 ml `63 -> 74 mm`, and 50 ml spray `85 -> 117 mm` correction; require exact dual-SKU identity and reject blocked rows.
- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement the minimal canonical overlay and verify GREEN.**
- [ ] **Step 4: Update runner target resolution** to load the cutover artifact, require production-qualified membership, and use the overlaid product before identity, prompt, topology, and scale compilation.
- [ ] **Step 5: Add/extend runner tests** proving stale snapshot geometry cannot reach `buildBodyForTarget()`.

### Task 3: Durable batch reconciliation

**Files:**
- Modify: `src/lib/bestBottlesImageReconciliation.ts`
- Modify: `src/lib/bestBottlesImageReconciliation.test.ts`
- Modify: `scripts/best-bottles/generate-family-batch.ts`

**Interfaces:**
- Produces: `buildBestBottlesRawReconciliationPayload()` and existing rig payloads using caller-supplied byte hashes.
- Runner records raw evidence after generation, rig evidence after postprocess, and links the generated image to the exact SKU job.

- [ ] **Step 1: Write failing payload tests** for byte reference hash, prompt hash, canonical truth, model shadow owner/topology, canvas 2080×2288, and `rigging` lifecycle.
- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement the raw payload builder and refactor the browser recorder onto it; verify GREEN.**
- [ ] **Step 4: Add runner-side persistence** using the existing service client and exact `pipeline_sku_job_id`.
- [ ] **Step 5: Make shadow-only misses persist as `review-pending`; geometry/identity failures remain hard failures.**
- [ ] **Step 6: Verify focused reconciliation and runner tests.**

### Task 4: Auditable shadow-only review exceptions

**Files:**
- Create: `src/lib/bestBottlesShadowReviewException.ts`
- Create: `src/lib/bestBottlesShadowReviewException.test.ts`
- Modify: `src/lib/product-image/rigReview.ts`
- Modify: `src/lib/product-image/rigReview.test.ts`
- Create: `supabase/migrations/20260713002000_best_bottles_shadow_review_exceptions.sql`

**Interfaces:**
- Produces: `isBestBottlesShadowReviewExceptionValid()` and an append-only database record bound to image, SKU job, final/reference/prompt/ledger/report hashes, contract, topology, reviewer, reason, and policy version.

- [ ] **Step 1: Write failing tests** allowing only enumerated aesthetic-threshold misses while geometry, identity, bounds, contract, and expected contacts pass.
- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement the pure validator and verify GREEN.**
- [ ] **Step 4: Extend rig review** so machine pass OR exact valid exception satisfies only the shadow requirement; never alter the machine report.
- [ ] **Step 5: Add the migration** with RLS, revocation, exact hash binding, and an approval predicate that accepts strict machine pass OR a valid active exception.
- [ ] **Step 6: Run SQL text-contract and rig-review tests.**

### Task 5: Studio and Pipeline fail-closed UI cutover

**Files:**
- Create: `src/hooks/useBestBottlesCylinderProductionReadiness.ts`
- Create: `src/hooks/useBestBottlesCylinderProductionReadiness.test.ts`
- Modify: `src/components/darkroom/MastersTabPanel.tsx`
- Modify: `src/pages/BestBottlesPipeline.tsx`

**Interfaces:**
- Consumes: `/data/best-bottles-cylinder-production-readiness.json`.
- Produces: exact readiness summaries and `isProductionQualifiedCylinderIdentity(websiteSku, graceSku)`.

- [ ] **Step 1: Write failing hook/helper tests** for exact dual-SKU membership and fail-closed behavior when the artifact is missing or invalid.
- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement the hook/helper and verify GREEN.**
- [ ] **Step 4: Filter Cylinder batch candidates through exact production qualification.**
- [ ] **Step 5: Disable the stale unrestricted family shortcut** and display canonical 377 / local 232 / qualified 219 / blocked 158 counts plus manifest version.
- [ ] **Step 6: Keep single-SKU and group generation blocked for non-qualified identities with the exact blocker reason.**

### Task 6: Verification and handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-best-bottles-cylinder-production-cutover.md`

- [ ] **Step 1: Run all new focused tests.**
- [ ] **Step 2: Run `npm run test:bestbottles:image-coverage`.**
- [ ] **Step 3: Run `npm run test:bestbottles:catalog-scale`.**
- [ ] **Step 4: Run `npx tsc --noEmit --pretty false`.**
- [ ] **Step 5: Regenerate readiness and independently verify 377 = 219 + 13 + 145, zero duplicate identity keys, zero external writes, and no absolute PSD source paths in the public artifact.**
- [ ] **Step 6: Inspect the final diff only in touched files and report remaining blockers; do not stage, commit, upload, generate, or publish.**
