# Best Bottles Cylinder V6.1 Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the deduplicated 384-SKU Cylinder catalog with approved references, strict V6.1 model-owned shadows, topology-aware QA, full regeneration, approval, publication, and live PDP verification.

**Architecture:** Build an immutable Cylinder closeout ledger first, then make reference qualification, prompt policy, shadow topology, rig preservation, reconciliation, and batch execution consume that ledger. Every paid or external step fails closed on ledger, prompt, reference, and policy hashes; the rig owns geometry while the model exclusively owns V6.1 Cylinder shadows.

**Tech Stack:** TypeScript, Node test runner through `tsx`, React/Vite, Sharp, Playwright, Supabase Edge Functions/Postgres, Shopify Admin API, Convex.

## Global Constraints

- The canonical closeout universe is exactly 384 deduplicated Cylinder SKUs.
- `GBTallCyl9WhtSht` must resolve to canonical Grace SKU `GB-CYL-WHT-9ML-WHT-S`, not a second product.
- Every new Cylinder generation uses `best-bottles-reference-locked-v6.1`, `shadow-owner:model`, and `contact-back-right-v1`.
- V6.0 and `best-bottles-reference-locked-v6.1-shadow-smoke` are historical lineage only for new Cylinder output.
- The model owns the shadow; the rig may preserve and transform it but must never synthesize a Cylinder V6.1 shadow.
- Runtime generation accepts one reviewed opaque flattened PNG per SKU. PSD files are recovery/provenance sources only.
- Transparent, mask, paper-doll, background-removed, and retired clean-lane references are prohibited.
- Existing V6.0 renders do not satisfy final closeout; all 384 SKUs must be regenerated.
- Remote migration, deployment, paid generation, approval writes, Shopify publication, Convex mutation, push, and merge are explicit announced checkpoints.
- Preserve unrelated dirty-worktree changes and stage only task-scoped files.

---

### Task 1: Immutable Cylinder closeout ledger

**Files:**
- Create: `src/lib/bestBottlesCylinderCloseout.ts`
- Create: `src/lib/bestBottlesCylinderCloseout.test.ts`
- Create: `scripts/best-bottles/build-cylinder-closeout-ledger.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: readiness rows from `public/data/best-bottles-generation-readiness.json` and catalog rows from `public/data/best-bottles-catalog-lite.json`.
- Produces: `buildCylinderCloseoutLedger(input): CylinderCloseoutLedger`, `getCylinderCloseoutBlockers(ledger): CylinderCloseoutBlocker[]`, and `tmp/bestbottles-generation/cylinder-v6.1-closeout-ledger.json`.

- [ ] **Step 1: Write failing ledger tests**

```ts
it("deduplicates the Tall Cylinder alias into the canonical Cylinder row", () => {
  const ledger = buildCylinderCloseoutLedger({ readinessRows: fixtureRows });
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.rows[0].graceSku, "GB-CYL-WHT-9ML-WHT-S");
  assert.deepEqual(ledger.rows[0].aliases, ["GBTallCyl9WhtSht"]);
});

it("fails closeout when the canonical universe is not exactly 384 rows", () => {
  assert.match(getCylinderCloseoutBlockers({ rows: [] })[0].message, /384/);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/bestBottlesCylinderCloseout.test.ts`

Expected: FAIL because `bestBottlesCylinderCloseout.ts` does not exist.

- [ ] **Step 3: Implement the ledger and blocker API**

```ts
export const CYLINDER_CLOSEOUT_EXPECTED_SKUS = 384;

export interface CylinderCloseoutRow {
  graceSku: string;
  websiteSku: string;
  aliases: string[];
  productGroupSlug: string | null;
  status: string;
  issues: string[];
}

export interface CylinderCloseoutLedger {
  version: "cylinder-v6.1-closeout-v1";
  generatedAt: string;
  rows: CylinderCloseoutRow[];
  sha256: string;
}
```

Normalize Grace/website aliases, prefer catalog-backed Grace SKU, collapse the one Tall Cylinder duplicate, sort by Grace SKU, hash stable JSON, and report duplicate, missing-join, missing-measurement, or count drift blockers.

- [ ] **Step 4: Add the read-only CLI**

Add `bestbottles:cylinder:closeout-ledger` to `package.json`. The CLI writes JSON and a CSV exception report, prints counts/hashes, and exits nonzero when blockers exist.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx --test src/lib/bestBottlesCylinderCloseout.test.ts
npm run bestbottles:cylinder:closeout-ledger
```

Expected: tests pass; CLI reports exactly 384 canonical rows and explicitly lists unresolved catalog blockers until they are repaired.

- [ ] **Step 6: Commit**

```bash
git add package.json src/lib/bestBottlesCylinderCloseout.ts src/lib/bestBottlesCylinderCloseout.test.ts scripts/best-bottles/build-cylinder-closeout-ledger.ts
git commit -m "feat(best-bottles): freeze Cylinder closeout ledger"
```

### Task 2: Reference qualification and PSD recovery manifest

**Files:**
- Create: `src/lib/bestBottlesCylinderReferenceReadiness.ts`
- Create: `src/lib/bestBottlesCylinderReferenceReadiness.test.ts`
- Create: `scripts/best-bottles/build-cylinder-reference-recovery.ts`
- Modify: `src/lib/bestBottlesReferenceValidation.ts`
- Modify: `src/lib/bestBottlesReferenceValidation.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CylinderCloseoutLedger`, flattened-reference filesystem inventory, PSD coverage CSV, and persisted SKU-job provenance.
- Produces: `buildCylinderReferenceManifest(input): CylinderReferenceManifest` with one `eligible`, `recover-from-psd`, `manual-source-match`, or `blocked` decision per ledger row.

- [ ] **Step 1: Write failing qualification tests**

```ts
it("accepts one opaque reviewed flattened PNG with exact SKU provenance", () => {
  const result = qualifyCylinderReference(validReferenceFixture);
  assert.equal(result.status, "eligible");
});

it("routes a matched capped PSD without an export to recovery, not generation", () => {
  const result = qualifyCylinderReference(cappedPsdOnlyFixture);
  assert.equal(result.status, "recover-from-psd");
});

it("blocks live website imagery and component-only PSDs", () => {
  assert.equal(qualifyCylinderReference(liveWebsiteFixture).status, "blocked");
  assert.equal(qualifyCylinderReference(componentPsdFixture).status, "blocked");
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/bestBottlesCylinderReferenceReadiness.test.ts src/lib/bestBottlesReferenceValidation.test.ts`

Expected: FAIL because the manifest API and exact provenance/hash result do not exist.

- [ ] **Step 3: Implement reference decisions**

```ts
export type CylinderReferenceStatus =
  | "eligible"
  | "recover-from-psd"
  | "manual-source-match"
  | "blocked";

export interface CylinderReferenceDecision {
  graceSku: string;
  websiteSku: string;
  status: CylinderReferenceStatus;
  sourcePath: string | null;
  sourcePsdPath: string | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
  opaque: boolean | null;
  reasons: string[];
}
```

Require exact SKU filename tokens, supported raster format, at least one megapixel, opaque pixels, approved provenance, and non-retired lineage. Keep native reference dimensions separate from the 2080 x 2288 output canvas.

- [ ] **Step 4: Implement the recovery CLI**

The read-only script joins all 384 ledger rows to local flattened PNGs and the existing PSD inventory, then writes:

- `tmp/bestbottles-generation/cylinder-v6.1-reference-manifest.json`
- `tmp/bestbottles-generation/cylinder-v6.1-reference-recovery.csv`
- `tmp/bestbottles-generation/cylinder-v6.1-manual-source-match.csv`

It must never export or modify a PSD.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx --test src/lib/bestBottlesCylinderReferenceReadiness.test.ts src/lib/bestBottlesReferenceValidation.test.ts
npm run bestbottles:cylinder:reference-recovery
```

Expected: tests pass and the report accounts for all 384 rows with no duplicate decision.

- [ ] **Step 6: Commit**

```bash
git add package.json src/lib/bestBottlesCylinderReferenceReadiness.ts src/lib/bestBottlesCylinderReferenceReadiness.test.ts src/lib/bestBottlesReferenceValidation.ts src/lib/bestBottlesReferenceValidation.test.ts scripts/best-bottles/build-cylinder-reference-recovery.ts
git commit -m "feat(best-bottles): qualify Cylinder reference recovery"
```

### Task 3: Strict V6.1 Cylinder policy

**Files:**
- Modify: `src/lib/bestBottlesShadowPolicy.ts`
- Modify: `src/lib/bestBottlesShadowPolicy.test.ts`
- Modify: `src/lib/bestBottlesGenerationIdentity.ts`
- Modify: `src/lib/bestBottlesGenerationIdentity.test.ts`
- Modify: `src/lib/bestBottlesCatalogCanonPrompt.ts`
- Modify: `src/lib/bestBottlesPromptCompiler.ts`
- Modify: `src/lib/bestBottlesPromptPreflight.ts`
- Modify: `src/lib/product-image/rigPostprocess.ts`
- Modify: `src/hooks/useAssembledPromptGeneration.ts`
- Modify: `src/components/darkroom/MastersTabPanel.tsx`

**Interfaces:**
- Consumes: product context `{ graceSku, websiteSku, family, bottleCollection }`.
- Produces: `resolveBestBottlesShadowPolicy(input): BestBottlesShadowPolicy` with canonical Cylinder V6.1/model ownership and non-Cylinder legacy behavior.

- [ ] **Step 1: Replace the exact-SKU test with failing family-policy tests**

```ts
for (const product of cylinderPolicyFixtures) {
  assert.deepEqual(resolveBestBottlesShadowPolicy(product), {
    promptVersion: "best-bottles-reference-locked-v6.1",
    owner: "model",
    contract: "contact-back-right-v1",
    rollout: "cylinder-family",
  });
}

assert.equal(resolveBestBottlesShadowPolicy(circleFixture).owner, "rig");
```

Include clear, amber, cobalt, frosted, swirl, plastic, Tall Cylinder alias, and a non-Cylinder fixture.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/bestBottlesShadowPolicy.test.ts src/lib/bestBottlesGenerationIdentity.test.ts`

Expected: FAIL because current policy only allowlists `GB-SPR-CLR-3ML-BLK`.

- [ ] **Step 3: Implement canonical family resolution**

```ts
export type BestBottlesPromptVersion =
  | "best-bottles-reference-locked-v6.0"
  | "best-bottles-reference-locked-v6.1";

export interface BestBottlesShadowPolicyInput {
  graceSku?: string | null;
  websiteSku?: string | null;
  family?: string | null;
  bottleCollection?: string | null;
}
```

Resolve Cylinder from reviewed catalog context, not SKU substring alone. Canonicalize the Tall Cylinder alias. Remove new-generation emission of `shadow-smoke-sku:*` and `v6.1-shadow-smoke`.

Update every production caller to pass the available family, collection, Grace SKU, and website SKU context in the same task. Keep a string-input compatibility overload only for historical-record parsing; it must default to V6.0 when family truth is absent and cannot promote a new Cylinder generation by SKU substring.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test src/lib/bestBottlesShadowPolicy.test.ts src/lib/bestBottlesGenerationIdentity.test.ts`

Expected: all policy and identity tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bestBottlesShadowPolicy.ts src/lib/bestBottlesShadowPolicy.test.ts src/lib/bestBottlesGenerationIdentity.ts src/lib/bestBottlesGenerationIdentity.test.ts src/lib/bestBottlesCatalogCanonPrompt.ts src/lib/bestBottlesPromptCompiler.ts src/lib/bestBottlesPromptPreflight.ts src/lib/product-image/rigPostprocess.ts src/hooks/useAssembledPromptGeneration.ts src/components/darkroom/MastersTabPanel.tsx
git commit -m "feat(best-bottles): enforce Cylinder V6.1 policy"
```

### Task 4: Contact-topology-aware prompt compiler and Edge parity

**Files:**
- Create: `src/lib/bestBottlesShadowTopology.ts`
- Create: `src/lib/bestBottlesShadowTopology.test.ts`
- Modify: `src/config/bestBottlesCatalogCanon.ts`
- Modify: `src/lib/bestBottlesCatalogCanonPrompt.ts`
- Modify: `src/lib/bestBottlesCatalogCanonPrompt.test.ts`
- Modify: `src/lib/bestBottlesPromptPreflight.ts`
- Modify: `src/lib/bestBottlesPromptPreflight.test.ts`
- Modify: `supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts`
- Modify: `supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts`
- Modify: `supabase/functions/generate-madison-image/index.ts`

**Interfaces:**
- Produces: `resolveBestBottlesShadowTopology(product, promptSku): BestBottlesShadowTopology` and `buildModelOwnedShadowPrompt(topology): string`.

- [ ] **Step 1: Write failing topology and parity tests**

```ts
assert.equal(resolveBestBottlesShadowTopology(assembledFixture).kind, "assembled");
assert.equal(resolveBestBottlesShadowTopology(detachedCapFixture).kind, "detached-sidecar");
assert.equal(resolveBestBottlesShadowTopology(tasselFixture).kind, "complex-contact");
assert.match(buildModelOwnedShadowPrompt(detached), /bottle base and detached cap/);
assert.equal(BEST_BOTTLES_STUDIO_DIRECTION_V2, STUDIO_DIRECTION);
```

Add Edge rejection assertions for Cylinder V6.0, missing policy tags, legacy smoke version, and mixed deterministic/model shadow phrases.

- [ ] **Step 2: Verify RED**

Run:

```bash
npx tsx --test src/lib/bestBottlesShadowTopology.test.ts src/lib/bestBottlesCatalogCanonPrompt.test.ts src/lib/bestBottlesPromptPreflight.test.ts supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts
```

Expected: FAIL on missing topology API, stale prompt parity, and exact-SKU Edge allowlist.

- [ ] **Step 3: Implement topology resolution and prompt blocks**

```ts
export interface BestBottlesShadowTopology {
  kind: "assembled" | "detached-sidecar" | "complex-contact";
  expectedContacts: Array<"bottle" | "sidecar" | "accessory">;
  source: "reviewed-reference" | "catalog-cap-state";
}
```

Compile one V6.1 shadow block from topology. Preserve the 32-42% contact core, 20-30% primary-width feather, camera-right direction, and prohibitions. Remove deterministic-shadow language from every Cylinder V6.1 path.

- [ ] **Step 4: Synchronize the Edge resolver**

Accept canonical V6.1 for ledger-backed Cylinder context; reject historical smoke/V6.0 records for new Cylinder generation. Log prompt version, owner, contract, and topology. Keep non-Cylinder behavior unchanged.

- [ ] **Step 5: Verify GREEN**

Run the Step 2 command and `deno check supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts`.

Expected: all prompt/topology/parity tests pass; Deno check reports no diagnostics for the shared resolver.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bestBottlesShadowTopology.ts src/lib/bestBottlesShadowTopology.test.ts src/config/bestBottlesCatalogCanon.ts src/lib/bestBottlesCatalogCanonPrompt.ts src/lib/bestBottlesCatalogCanonPrompt.test.ts src/lib/bestBottlesPromptPreflight.ts src/lib/bestBottlesPromptPreflight.test.ts supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts supabase/functions/generate-madison-image/index.ts
git commit -m "feat(best-bottles): compile topology-aware V6.1 shadows"
```

### Task 5: Multi-contact shadow QA and rig preservation

**Files:**
- Modify: `src/lib/product-image/shadowQa.ts`
- Modify: `src/lib/product-image/shadowQa.test.ts`
- Modify: `src/lib/product-image/rigPostprocess.ts`
- Modify: `src/lib/product-image/rigPostprocess.test.ts`
- Modify: `src/lib/product-image/rigReview.ts`
- Modify: `src/lib/product-image/rigReview.test.ts`
- Modify: `src/hooks/useAssembledPromptGeneration.ts`

**Interfaces:**
- Consumes: `BestBottlesShadowTopology` and per-contact product bounds.
- Produces: `ShadowQaReport.contacts[]`, a union candidate mask, and a union preservation mask.

- [ ] **Step 1: Write failing multi-contact tests**

```ts
const report = analyzeModelOwnedShadow({ ...fixture, topology: detachedTopology });
assert.equal(report.report.contacts.length, 2);
assert.equal(report.report.status, "pass");

assert.equal(
  analyzeModelOwnedShadow({ ...fixtureWithoutCapShadow, topology: detachedTopology }).report.status,
  "fail",
);
```

Add regressions proving the rig paints zero deterministic pixels, preserves both valid shadows through one transform, and excludes both masks from product geometry.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/product-image/shadowQa.test.ts src/lib/product-image/rigPostprocess.test.ts src/lib/product-image/rigReview.test.ts`

Expected: FAIL because QA assumes one primary shadow component.

- [ ] **Step 3: Implement topology-aware analysis**

```ts
export interface ShadowContactQa {
  contact: "bottle" | "sidecar" | "accessory";
  status: ShadowQaStatus;
  bounds: ShadowQaBounds;
  measurements: ShadowQaReport["measurements"];
  failures: string[];
  warnings: string[];
}
```

Analyze one lane per expected contact, combine masks, require each expected contact to pass, reject unexpected disconnected components, and retain `target.contract = "contact-back-right-v1"`.

- [ ] **Step 4: Enforce model-only rig behavior**

Pass topology from generation context to normalization and review evidence. Remove any Cylinder V6.1 deterministic fallback path. Missing baseline/shadow returns review evidence with zero synthesized pixels.

- [ ] **Step 5: Verify GREEN**

Run the Step 2 command plus `npx tsc -p tsconfig.app.json --noEmit`.

Expected: focused tests pass; TypeScript reports no new diagnostics in touched files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/product-image/shadowQa.ts src/lib/product-image/shadowQa.test.ts src/lib/product-image/rigPostprocess.ts src/lib/product-image/rigPostprocess.test.ts src/lib/product-image/rigReview.ts src/lib/product-image/rigReview.test.ts src/hooks/useAssembledPromptGeneration.ts
git commit -m "feat(best-bottles): validate multi-contact V6.1 shadows"
```

### Task 6: Durable reconciliation and strict approval contract

**Files:**
- Modify: `supabase/migrations/20260712001000_best_bottles_model_shadow_evidence.sql`
- Modify: `supabase/tests/best_bottles_image_reconciliation.sql`
- Modify: `src/lib/bestBottlesImageReconciliation.ts`
- Modify: `src/lib/bestBottlesImageReconciliation.test.ts`
- Modify: `src/components/bestbottles/RigReviewPanel.tsx`
- Modify: `src/components/bestbottles/BestBottlesReconciliationBadges.tsx`

**Interfaces:**
- Persists canonical prompt version, model owner, topology, and complete shadow QA JSON.
- Approval requires V6.1, model ownership, exact contract, passing contact reports, passing geometry, and human confirmations.

- [ ] **Step 1: Write failing SQL/client approval tests**

Add cases proving Cylinder V6.0, rig ownership, missing topology, one failing sidecar contact, and null evidence are rejected; a complete V6.1 detached-sidecar report passes.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.test.ts`

Expected: FAIL because approval currently accepts rig ownership and only checks the single-contact contract.

- [ ] **Step 3: Extend migration and payloads**

Add `prompt_version TEXT` and `shadow_topology JSONB` where absent, preserve `shadow_owner` and `shadow_qa`, and make Cylinder approval require:

```sql
r.prompt_version = 'best-bottles-reference-locked-v6.1'
AND r.shadow_owner = 'model'
AND r.shadow_qa->>'status' = 'pass'
AND r.shadow_qa->'target'->>'contract' = 'contact-back-right-v1'
AND jsonb_array_length(COALESCE(r.shadow_qa->'contacts', '[]'::jsonb)) > 0
```

Keep non-Cylinder legacy approval semantics unchanged.

- [ ] **Step 4: Surface contact evidence in review UI**

Show prompt version, topology, each contact status/gap/spread, failures, warnings, and reference hash beside the identical-scale comparison.

- [ ] **Step 5: Verify GREEN**

Run focused client tests. If Docker is available, run `supabase db reset` and the SQL test; otherwise run static SQL contract assertions and record the integration limitation.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260712001000_best_bottles_model_shadow_evidence.sql supabase/tests/best_bottles_image_reconciliation.sql src/lib/bestBottlesImageReconciliation.ts src/lib/bestBottlesImageReconciliation.test.ts src/components/bestbottles/RigReviewPanel.tsx src/components/bestbottles/BestBottlesReconciliationBadges.tsx
git commit -m "feat(best-bottles): gate Cylinder approval on V6.1 evidence"
```

### Task 7: Hash-safe full-family generation runner

**Files:**
- Modify: `scripts/best-bottles/generate-family-batch.ts`
- Create: `scripts/best-bottles/generate-family-batch.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: closeout ledger and eligible reference manifest.
- Produces: a resumable V6.1 manifest whose skip key includes prompt, policy, reference, and ledger hashes.

- [ ] **Step 1: Write failing resume tests**

```ts
assert.equal(canSkipRenderedEntry(v60Entry, v61Identity), false);
assert.equal(canSkipRenderedEntry(v61Entry, changedReferenceIdentity), false);
assert.equal(canSkipRenderedEntry(v61Entry, exactIdentity), true);
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test scripts/best-bottles/generate-family-batch.test.ts`

Expected: FAIL because current resume logic skips on `status === "rendered"` alone.

- [ ] **Step 3: Implement immutable generation identity**

Each manifest entry records `ledgerHash`, `referenceHash`, `promptHash`, `promptVersion`, `shadowOwner`, `shadowContract`, `shadowTopology`, `rawImageUrl`, `finalImageUrl`, geometry QA, shadow QA, attempt history, and lifecycle state.

Require 384 eligible references for the unrestricted full run. Permit explicit archetype-smoke allowlists before that gate. Stop a cohort after a configurable systemic QA-failure threshold.

- [ ] **Step 4: Verify GREEN**

Run the focused test and a `--dry-run` archetype manifest command. Expected: all older V6.0 entries are scheduled for regeneration and no provider call occurs.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/best-bottles/generate-family-batch.ts scripts/best-bottles/generate-family-batch.test.ts
git commit -m "feat(best-bottles): make Cylinder V6.1 regeneration hash-safe"
```

### Task 8: Archetype smoke matrix and review artifacts

**Files:**
- Create: `src/lib/bestBottlesCylinderSmokeMatrix.ts`
- Create: `src/lib/bestBottlesCylinderSmokeMatrix.test.ts`
- Create: `scripts/best-bottles/build-cylinder-v6.1-smoke-matrix.ts`
- Modify: `scripts/best-bottles/build-review-gallery.ts`
- Modify: `package.json`

**Interfaces:**
- Produces a deterministic representative SKU allowlist covering every required size, material, cap state, applicator, and topology.

```ts
export interface CylinderSmokeMatrixEntry {
  graceSku: string;
  websiteSku: string;
  coverage: {
    sizeBand: string;
    material: string;
    applicator: string;
    topology: BestBottlesShadowTopology["kind"];
  };
}

export function buildCylinderSmokeMatrix(
  ledger: CylinderCloseoutLedger,
  references: CylinderReferenceManifest,
): CylinderSmokeMatrixEntry[];
```

- [ ] **Step 1: Write failing coverage tests**

Assert the selected matrix covers all required dimensions from the spec and every selected SKU exists in the closeout ledger with an eligible reference.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/bestBottlesCylinderSmokeMatrix.test.ts`

Expected: FAIL because the matrix builder does not exist.

- [ ] **Step 3: Implement deterministic selection and gallery grouping**

Select the smallest SKU set that covers size, material, applicator, and topology requirements. Emit JSON/Markdown and group review cards by archetype with reference/raw/final images and geometry/shadow evidence.

- [ ] **Step 4: Verify GREEN**

Run the focused test and builder. Expected: every required coverage dimension appears and every selected entry is eligible.

- [ ] **Step 5: Commit**

```bash
git add package.json src/lib/bestBottlesCylinderSmokeMatrix.ts src/lib/bestBottlesCylinderSmokeMatrix.test.ts scripts/best-bottles/build-cylinder-v6.1-smoke-matrix.ts scripts/best-bottles/build-review-gallery.ts
git commit -m "feat(best-bottles): build Cylinder V6.1 smoke matrix"
```

### Task 9: Full verification and activation checkpoints

**Files:**
- Modify: `docs/BEST_BOTTLES_RECONCILIATION_HANDOFF.md`
- Create: `docs/best-bottles-cylinder-v6-1-closeout-runbook.md`

**Interfaces:**
- Produces the operator runbook and evidence checklist for migration, deployment, paid smoke, full generation, approval, publication, and live verification.

- [ ] **Step 1: Run local verification**

```bash
npm run test:bestbottles:image-coverage
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npx eslint src/lib/bestBottlesCylinderCloseout.ts src/lib/bestBottlesCylinderCloseout.test.ts src/lib/bestBottlesCylinderReferenceReadiness.ts src/lib/bestBottlesCylinderReferenceReadiness.test.ts src/lib/bestBottlesShadowPolicy.ts src/lib/bestBottlesShadowPolicy.test.ts src/lib/bestBottlesShadowTopology.ts src/lib/bestBottlesShadowTopology.test.ts src/lib/product-image/shadowQa.ts src/lib/product-image/shadowQa.test.ts src/lib/product-image/rigPostprocess.ts src/lib/product-image/rigPostprocess.test.ts src/lib/product-image/rigReview.ts src/lib/product-image/rigReview.test.ts src/lib/bestBottlesImageReconciliation.ts src/lib/bestBottlesImageReconciliation.test.ts src/lib/bestBottlesCylinderSmokeMatrix.ts src/lib/bestBottlesCylinderSmokeMatrix.test.ts scripts/best-bottles/build-cylinder-closeout-ledger.ts scripts/best-bottles/build-cylinder-reference-recovery.ts scripts/best-bottles/generate-family-batch.ts scripts/best-bottles/generate-family-batch.test.ts scripts/best-bottles/build-cylinder-v6.1-smoke-matrix.ts src/components/bestbottles/RigReviewPanel.tsx src/components/bestbottles/BestBottlesReconciliationBadges.tsx
git diff --check
npm run build
```

Expected: all relevant tests pass; build exits zero. Existing unrelated warnings are recorded, not silently described as clean.

- [ ] **Step 2: Prepare migration/deployment evidence**

Run remote migration dry-run and download the currently deployed `generate-madison-image` source. Compare it with local V6.1 resolver bytes. Do not apply or deploy until the checkpoint is announced.

- [ ] **Step 3: External checkpoint — migration and Edge deployment**

After explicit confirmation, apply the shadow-evidence migration and deploy only required Edge functions. Download deployed source and rerun parity verification.

- [ ] **Step 4: External checkpoint — paid smoke matrix**

After explicit confirmation and billing readiness, generate only the smoke allowlist. Review every archetype; any systemic failure returns to the responsible task before full generation.

- [ ] **Step 5: External checkpoint — full 384 regeneration**

Run the hash-safe manifest until 384 final candidates pass machine QA. Build the review gallery and require explicit human approvals.

- [ ] **Step 6: External checkpoint — publication**

Run Shopify preflight, let the authorized operator trigger publication, retry Convex separately when needed, and verify 384/384 Shopify, Convex, and storefront verdicts.

- [ ] **Step 7: Commit documentation**

```bash
git add docs/BEST_BOTTLES_RECONCILIATION_HANDOFF.md docs/best-bottles-cylinder-v6-1-closeout-runbook.md
git commit -m "docs(best-bottles): add Cylinder V6.1 closeout runbook"
```
