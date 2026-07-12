# Best Bottles Global Catalog-Relative Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one versioned, perceptually compressed catalog scale with bounded family corrections, cap-state-safe body scaling, PSD eligibility gates, a Cylinder calibration board, and catalog-wide technical/hero lineups.

**Architecture:** A pure scale resolver owns the global capacity knots and interpolation. A separate registry module joins reconciled measurements and approved PSD evidence, while existing family profiles contribute only bounded corrections and composition constraints. Calibration and hero renderers consume the same approved manifest so visual review, generation, and lineage cannot disagree.

**Tech Stack:** TypeScript 5.8, Node 20, `tsx --test`, Sharp 0.35, existing Madison Best Bottles catalog/readiness JSON, existing v6.1 prompt and rig modules.

## Global Constraints

- Standard canvas is exactly 2080 × 2288.
- Shared shelf baseline remains 9% up from the canvas bottom.
- Global curve knots are 1/54, 3/56, 4/58, 5/61, 9/69, 28/74, 30/75, 50/78, 100/79, 118/80, 227/82, and 454/84, expressed as capacity ml / assembled canvas-height percent.
- Family correction is limited to ±2 percentage points and cannot reverse size order.
- The curve represents cap-on assembled height; cap-off reuses the derived cap-on body pixel height.
- `heightWithoutCap` is measurement evidence, not cap-off visual authorization.
- Cap-off and multi-component generation require approved PSD evidence for the exact state and topology.
- Missing cap-off evidence blocks cap-off only; evidence-backed cap-on work may proceed.
- Calibration must not write Shopify, Convex media, Supabase generation state, or approvals.
- Every production consumer must carry `best-bottles-catalog-scale-v1` and the applicable v6.1 lineage.

---

### Task 1: Pure global scale resolver

**Files:**
- Create: `src/config/bestBottlesCatalogScale.ts`
- Create: `src/config/bestBottlesCatalogScale.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `BEST_BOTTLES_CATALOG_SCALE_VERSION`, `BEST_BOTTLES_GLOBAL_SCALE_KNOTS`, `resolveBestBottlesGlobalScalePct`, `applyBestBottlesFamilyScaleCorrection`, and `deriveBestBottlesBodyTargetPx`.
- Consumes: capacity in ml, optional family correction, canvas height, verified body height, and verified assembled height.

- [ ] **Step 1: Write the failing resolver tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBestBottlesFamilyScaleCorrection,
  BEST_BOTTLES_GLOBAL_SCALE_KNOTS,
  deriveBestBottlesBodyTargetPx,
  resolveBestBottlesGlobalScalePct,
} from "./bestBottlesCatalogScale";

describe("Best Bottles global catalog scale", () => {
  it("pins every approved calibration knot", () => {
    for (const knot of BEST_BOTTLES_GLOBAL_SCALE_KNOTS) {
      assert.equal(resolveBestBottlesGlobalScalePct(knot.capacityMl), knot.assembledHeightPct);
    }
  });

  it("interpolates monotonically between knots", () => {
    const values = [1, 2, 3, 4, 5, 7, 9, 20, 28, 30, 50, 100, 118, 227, 454]
      .map(resolveBestBottlesGlobalScalePct);
    assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]));
  });

  it("rejects corrections outside the approved rail", () => {
    assert.throws(() => applyBestBottlesFamilyScaleCorrection(69, 2.01), /±2/);
    assert.equal(applyBestBottlesFamilyScaleCorrection(69, -2), 67);
  });

  it("derives a reusable cap-state body target", () => {
    assert.equal(deriveBestBottlesBodyTargetPx({
      canvasHeightPx: 2288,
      assembledHeightPct: 79,
      verifiedBodyHeightMm: 130,
      verifiedAssembledHeightMm: 150,
    }), 1567);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test src/config/bestBottlesCatalogScale.test.ts`  
Expected: FAIL because `bestBottlesCatalogScale.ts` does not exist.

- [ ] **Step 3: Implement the minimal resolver**

```ts
export const BEST_BOTTLES_CATALOG_SCALE_VERSION = "best-bottles-catalog-scale-v1" as const;

export const BEST_BOTTLES_GLOBAL_SCALE_KNOTS = [
  { capacityMl: 1, assembledHeightPct: 54 },
  { capacityMl: 3, assembledHeightPct: 56 },
  { capacityMl: 4, assembledHeightPct: 58 },
  { capacityMl: 5, assembledHeightPct: 61 },
  { capacityMl: 9, assembledHeightPct: 69 },
  { capacityMl: 28, assembledHeightPct: 74 },
  { capacityMl: 30, assembledHeightPct: 75 },
  { capacityMl: 50, assembledHeightPct: 78 },
  { capacityMl: 100, assembledHeightPct: 79 },
  { capacityMl: 118, assembledHeightPct: 80 },
  { capacityMl: 227, assembledHeightPct: 82 },
  { capacityMl: 454, assembledHeightPct: 84 },
] as const;

export function resolveBestBottlesGlobalScalePct(capacityMl: number): number {
  if (!Number.isFinite(capacityMl) || capacityMl <= 0) throw new Error("A positive capacityMl is required.");
  const first = BEST_BOTTLES_GLOBAL_SCALE_KNOTS[0];
  const last = BEST_BOTTLES_GLOBAL_SCALE_KNOTS.at(-1)!;
  if (capacityMl <= first.capacityMl) return first.assembledHeightPct;
  if (capacityMl >= last.capacityMl) return last.assembledHeightPct;
  const upperIndex = BEST_BOTTLES_GLOBAL_SCALE_KNOTS.findIndex((knot) => knot.capacityMl >= capacityMl);
  const lower = BEST_BOTTLES_GLOBAL_SCALE_KNOTS[upperIndex - 1];
  const upper = BEST_BOTTLES_GLOBAL_SCALE_KNOTS[upperIndex];
  const progress = (capacityMl - lower.capacityMl) / (upper.capacityMl - lower.capacityMl);
  return lower.assembledHeightPct + progress * (upper.assembledHeightPct - lower.assembledHeightPct);
}

export function applyBestBottlesFamilyScaleCorrection(basePct: number, correctionPct: number): number {
  if (Math.abs(correctionPct) > 2) throw new Error("Family scale correction must remain within ±2 percentage points.");
  return basePct + correctionPct;
}

export function deriveBestBottlesBodyTargetPx(input: {
  canvasHeightPx: number;
  assembledHeightPct: number;
  verifiedBodyHeightMm: number;
  verifiedAssembledHeightMm: number;
}): number {
  if (input.verifiedBodyHeightMm <= 0 || input.verifiedAssembledHeightMm <= 0) {
    throw new Error("Verified positive body and assembled heights are required.");
  }
  return Math.round(
    input.canvasHeightPx * (input.assembledHeightPct / 100) *
      (input.verifiedBodyHeightMm / input.verifiedAssembledHeightMm),
  );
}
```

- [ ] **Step 4: Add the focused test script and confirm GREEN**

Add to `package.json`:

```json
"test:bestbottles:catalog-scale": "tsx --test src/config/bestBottlesCatalogScale.test.ts src/lib/bestBottlesCalibrationRegistry.test.ts scripts/best-bottles/build-catalog-scale-registry.test.ts scripts/best-bottles/build-catalog-lineups.test.ts"
```

Run: `npx tsx --test src/config/bestBottlesCatalogScale.test.ts`  
Expected: 4 passing tests.

- [ ] **Step 5: Commit the resolver**

```bash
git add package.json src/config/bestBottlesCatalogScale.ts src/config/bestBottlesCatalogScale.test.ts
git commit -m "feat(best-bottles): add global catalog scale resolver"
```

### Task 2: Calibration registry and PSD cap-state gate

**Files:**
- Create: `src/lib/bestBottlesCalibrationRegistry.ts`
- Create: `src/lib/bestBottlesCalibrationRegistry.test.ts`

**Interfaces:**
- Consumes: reconciled catalog row, measurement status, canonical reference IDs, and PSD-confirmed topology.
- Produces: `BestBottlesCalibrationRegistryRow`, `resolveBestBottlesCapStateEligibility`, and `validateBestBottlesCalibrationRow`.

- [ ] **Step 1: Write failing evidence-gate tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveBestBottlesCapStateEligibility,
  validateBestBottlesCalibrationRow,
} from "./bestBottlesCalibrationRegistry";

describe("Best Bottles calibration evidence", () => {
  it("does not infer cap-off from heightWithoutCap", () => {
    assert.equal(resolveBestBottlesCapStateEligibility({
      capOnReferenceId: "opaque-cap-on-psd-export",
      capOffReferenceId: null,
      topologyReferenceId: null,
      heightWithoutCap: "130 ±2 mm",
      isMultiComponent: false,
    }), "cap-off-unavailable");
  });

  it("allows cap-off only with an approved PSD reference", () => {
    assert.equal(resolveBestBottlesCapStateEligibility({
      capOnReferenceId: "opaque-cap-on-psd-export",
      capOffReferenceId: "approved-cap-off-psd-export",
      topologyReferenceId: null,
      heightWithoutCap: "130 ±2 mm",
      isMultiComponent: false,
    }), "cap-off-confirmed");
  });

  it("rejects disputed measurement anchors", () => {
    assert.throws(() => validateBestBottlesCalibrationRow({ measurementStatus: "disputed" }), /reconciled/);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesCalibrationRegistry.test.ts`  
Expected: FAIL because the registry module does not exist.

- [ ] **Step 3: Implement explicit states and validation**

Define these exact exported types:

```ts
export type BestBottlesMeasurementStatus = "reconciled" | "missing" | "disputed";
export type BestBottlesCapStateEligibility =
  | "cap-on-confirmed"
  | "cap-off-confirmed"
  | "multi-component-confirmed"
  | "cap-off-unavailable"
  | "needs-psd-review";

export interface BestBottlesCalibrationRegistryRow {
  scaleContractVersion: "best-bottles-catalog-scale-v1";
  graceSku: string;
  websiteSku: string;
  productGroupId: string;
  family: string;
  capacityMl: number;
  bodyMaterial: string;
  shapeClass: string;
  heightWithCapMm: number;
  heightWithoutCapMm: number;
  diameterMm: number;
  measurementStatus: BestBottlesMeasurementStatus;
  measurementSources: string[];
  capOnReferenceId: string;
  capOffReferenceId: string | null;
  topologyReferenceId: string | null;
  capStateEligibility: BestBottlesCapStateEligibility;
  globalTargetPct: number;
  familyCorrectionPct: number;
  finalAssembledTargetPct: number;
  bodyTargetPx: number;
  promptVersion: "best-bottles-reference-locked-v6.1";
}
```

`resolveBestBottlesCapStateEligibility` must return `needs-psd-review` for multi-component products lacking `topologyReferenceId`, `multi-component-confirmed` when that evidence exists, `cap-off-confirmed` only when `capOffReferenceId` exists, and otherwise `cap-off-unavailable`. `validateBestBottlesCalibrationRow` must reject any status other than `reconciled` and require all positive numeric measurements.

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `npx tsx --test src/lib/bestBottlesCalibrationRegistry.test.ts`  
Expected: 3 passing tests.

- [ ] **Step 5: Commit the registry contract**

```bash
git add src/lib/bestBottlesCalibrationRegistry.ts src/lib/bestBottlesCalibrationRegistry.test.ts
git commit -m "feat(best-bottles): gate catalog scale on measurements and PSD evidence"
```

### Task 3: Replace family-owned scale with bounded corrections

**Files:**
- Modify: `src/config/bestBottlesFamilyProfiles.ts`
- Modify: `src/config/bestBottlesFamilyProfiles.test.ts`
- Modify: `src/lib/product-image/familyRig.ts`
- Modify: `src/lib/product-image/familyRig.test.ts`

**Interfaces:**
- Consumes: global scale resolver from Task 1.
- Produces: family profiles whose `targetProductHeightPct` is global target plus a validated family correction.

- [ ] **Step 1: Write failing profile tests for global authority**

Add tests proving that 1/3/4/5/9/28/30/50/100/118/227/454 ml Cylinder products resolve to the approved targets with a Cylinder correction of `0`, and that every authored family correction is within ±2. Add a test that 28 ml never resolves taller than 30 ml and 100 ml never resolves taller than 118 ml.

Use the existing `getBestBottlesFamilyProfileForProduct` entrypoint and assert `targetProductHeightPct` to avoid testing an implementation detail.

- [ ] **Step 2: Run the focused profile tests and confirm RED**

Run: `npx tsx --test src/config/bestBottlesFamilyProfiles.test.ts src/lib/product-image/familyRig.test.ts`  
Expected: FAIL because existing family zones still own scale.

- [ ] **Step 3: Add correction metadata to family profiles**

Add these fields to `BestBottlesFamilyProfile`:

```ts
scaleContractVersion: typeof BEST_BOTTLES_CATALOG_SCALE_VERSION;
globalTargetProductHeightPct: number;
familyScaleCorrectionPct: number;
```

Define a typed `BEST_BOTTLES_FAMILY_SCALE_CORRECTIONS` record keyed by `BestBottlesFamilyProfileId`. Set every correction to `0` for the initial calibration release. Future non-zero corrections require calibration evidence and a versioned change.

In `buildProfile`, resolve capacity through `resolveBestBottlesGlobalScalePct`, apply the profile correction, and assign the three fields above. Keep width, baseline, centerline, glass/material cues, and detached-component placement family-owned.

- [ ] **Step 4: Preserve current names while removing scale authority**

Keep existing relative-zone IDs temporarily for UI/report compatibility, but derive their target percentage from the global resolver. Add a deprecation comment that zones classify composition and cannot own an independent height curve.

- [ ] **Step 5: Run profile and rig tests and confirm GREEN**

Run: `npx tsx --test src/config/bestBottlesFamilyProfiles.test.ts src/lib/product-image/familyRig.test.ts`  
Expected: all tests pass with global targets and unchanged geometry constraints.

- [ ] **Step 6: Commit family integration**

```bash
git add src/config/bestBottlesFamilyProfiles.ts src/config/bestBottlesFamilyProfiles.test.ts src/lib/product-image/familyRig.ts src/lib/product-image/familyRig.test.ts
git commit -m "feat(best-bottles): make family scale corrections globally bounded"
```

### Task 4: Primary-bottle fit and cap-state pair consistency

**Files:**
- Modify: `src/lib/product-image/familyRig.ts`
- Modify: `src/lib/product-image/familyRig.test.ts`
- Modify: `src/lib/product-image/rigPostprocess.ts`
- Modify: `src/lib/product-image/rigPostprocess.test.ts`

**Interfaces:**
- Produces: `computePrimaryBottleRigScale` and cap-state pair metrics that ignore detached sidecar width.
- Consumes: derived body target from Task 1 and primary-bottle versus full-foreground bounds from segmentation.

- [ ] **Step 1: Write failing sidecar and pair tests**

Add tests with a 300 px-wide, 1500 px-tall bottle and a distant 500 px-wide sidecar. Assert that adding the sidecar does not change the bottle scale. Add a cap-on/cap-off pair test asserting equal rounded `bodyTargetPx` for identical measurements and scale contract.

- [ ] **Step 2: Run focused rig tests and confirm RED**

Run: `npx tsx --test src/lib/product-image/familyRig.test.ts src/lib/product-image/rigPostprocess.test.ts`  
Expected: FAIL because `computeRigFitScale` still contains the full assembly.

- [ ] **Step 3: Implement primary-object fit**

Add:

```ts
export function computePrimaryBottleRigScale(input: {
  primaryBoxWidthPx: number;
  primaryBoxHeightPx: number;
  targetBodyHeightPx: number;
  maxPrimaryWidthPx: number;
}): number {
  const heightScale = input.targetBodyHeightPx / input.primaryBoxHeightPx;
  const widthScale = input.maxPrimaryWidthPx / input.primaryBoxWidthPx;
  return Math.min(heightScale, widthScale);
}
```

Update postprocess segmentation to return both `primaryBottleBounds` and `fullForegroundBounds`. Use only `primaryBottleBounds` for scale and baseline QA; use `fullForegroundBounds` only for crop/safe-margin checks. Fail closed with `primary-bottle-bounds-unresolved` when detached topology is expected but the primary bottle cannot be isolated.

- [ ] **Step 4: Add pair QA metadata**

Persist `scale_contract_version`, `resolved_assembled_target_pct`, `resolved_body_target_px`, and `primary_bottle_bounds` into rig QA. A cap-state pair fails review when body height differs by more than 2% or baseline differs by more than 6 px.

- [ ] **Step 5: Run tests and confirm GREEN**

Run: `npx tsx --test src/lib/product-image/familyRig.test.ts src/lib/product-image/rigPostprocess.test.ts`  
Expected: all sidecar and pair tests pass.

- [ ] **Step 6: Commit the fit correction**

```bash
git add src/lib/product-image/familyRig.ts src/lib/product-image/familyRig.test.ts src/lib/product-image/rigPostprocess.ts src/lib/product-image/rigPostprocess.test.ts
git commit -m "fix(best-bottles): preserve bottle scale across cap states and sidecars"
```

### Task 5: Build the reconciled registry and Cylinder calibration manifest

**Files:**
- Create: `scripts/best-bottles/build-catalog-scale-registry.ts`
- Create: `scripts/best-bottles/build-catalog-scale-registry.test.ts`
- Modify: `package.json`
- Generate: `public/data/best-bottles-catalog-scale-registry.json`
- Generate: `public/data/best-bottles-cylinder-calibration-manifest.json`

**Interfaces:**
- Consumes: `public/data/best-bottles-catalog-lite.json`, `public/data/best-bottles-generation-readiness.json`, and `docs/best-bottles-reference-migration-manifest.json`.
- Produces: deterministic registry JSON and the approved-capacity Cylinder worklist.

- [ ] **Step 1: Write failing builder tests**

Use three fixtures: reconciled cap-on-only, reconciled cap-off PSD-confirmed, and disputed vintage-bulb topology. Assert that the first remains cap-on eligible, the second is cap-off eligible, and the third is excluded from calibration with an explicit reason.

- [ ] **Step 2: Run builder tests and confirm RED**

Run: `npx tsx --test scripts/best-bottles/build-catalog-scale-registry.test.ts`  
Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement pure joins before CLI I/O**

Export `buildBestBottlesCatalogScaleRegistry(input)` from the script. Join by normalized Grace SKU first and website SKU second. Require `measurementStatus === "reconciled"`, positive parsed measurements, approved opaque cap-on reference lineage, and the v6.1 prompt policy. Emit exclusion records instead of dropping failures silently.

- [ ] **Step 4: Select Cylinder anchors deterministically**

Select one canonical row at each of `1, 3, 4, 5, 9, 28, 30, 50, 100, 118, 227, 454`. Prefer clear glass, simple cap-on topology, reconciled measurements, approved opaque PSD-derived reference, and no named exception. If no eligible anchor exists, emit `missing-anchor` and make the command exit non-zero after writing the report.

- [ ] **Step 5: Add package scripts and run dry generation**

Add:

```json
"bestbottles:scale:registry": "tsx scripts/best-bottles/build-catalog-scale-registry.ts",
"bestbottles:scale:cylinder-manifest": "tsx scripts/best-bottles/build-catalog-scale-registry.ts --family Cylinder"
```

Run: `npm run bestbottles:scale:registry`  
Expected: registry JSON plus an explicit eligible/excluded summary; no network or database writes.

- [ ] **Step 6: Run tests and commit**

```bash
npx tsx --test scripts/best-bottles/build-catalog-scale-registry.test.ts
git add package.json scripts/best-bottles/build-catalog-scale-registry.ts scripts/best-bottles/build-catalog-scale-registry.test.ts public/data/best-bottles-catalog-scale-registry.json public/data/best-bottles-cylinder-calibration-manifest.json
git commit -m "feat(best-bottles): build catalog scale registry and Cylinder anchors"
```

### Task 6: Render the Cylinder board and catalog-family lineups

**Files:**
- Create: `scripts/best-bottles/build-catalog-lineups.ts`
- Create: `scripts/best-bottles/build-catalog-lineups.test.ts`
- Modify: `package.json`
- Generate: `tmp/best-bottles-calibration/cylinder-technical.png`
- Generate: `tmp/best-bottles-calibration/catalog-families-technical.png`
- Generate: `tmp/best-bottles-calibration/catalog-families-hero.png`
- Generate: `tmp/best-bottles-calibration/catalog-family-lineup-manifest.json`

**Interfaces:**
- Consumes: approved registry rows and normalized/rigged canonical product images.
- Produces: technical and clean PNGs from one ordered manifest.

- [ ] **Step 1: Write failing manifest-parity tests**

Test that technical and hero render plans contain the same SKU order, reference IDs, scale versions, resolved targets, and lineup positions. Test that a row lacking reconciled measurements or an approved cap-on PSD is rejected.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test scripts/best-bottles/build-catalog-lineups.test.ts`  
Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement deterministic Sharp composition**

Export `buildCatalogLineupRenderPlan(rows)` and keep I/O in `main()`. Use the rigged canonical PNG for each row, never ask an image model to recreate the bottle. Seat every primary bottle on one shared baseline and composite at the registry's resolved scale. Technical tiles add family, capacity, SKU, measurements, global target, correction, and final target. The hero uses the identical product layers and positions without labels.

- [ ] **Step 4: Protect visual truth**

Fail when a source file is missing, its reference ID differs from the manifest, its v6.1 lineage is absent, or its primary-bottle QA bounds are unavailable. Do not substitute a legacy website GIF, transparent derivative, generated stand-in, or sibling SKU.

- [ ] **Step 5: Add scripts and build the available outputs**

Add:

```json
"bestbottles:scale:lineups": "tsx scripts/best-bottles/build-catalog-lineups.ts"
```

Run: `npm run bestbottles:scale:lineups`  
Expected: outputs for every currently eligible anchor plus a written missing-evidence list. No publishing.

- [ ] **Step 6: Inspect the three images**

Open each output at original resolution. Verify exact SKU order, shared baseline, v6.1 grounding, no cropped closures, no sidecar-driven shrink, and visible but compressed scale progression. Record reviewer outcome in the manifest instead of editing images manually.

- [ ] **Step 7: Commit code and manifest, not disposable PNG review outputs**

```bash
git add package.json scripts/best-bottles/build-catalog-lineups.ts scripts/best-bottles/build-catalog-lineups.test.ts
git commit -m "feat(best-bottles): render technical and hero catalog lineups"
```

### Task 7: Enforce lineage in generation and review gates

**Files:**
- Modify: `src/lib/bestBottlesGenerationIdentity.ts`
- Modify: `src/lib/bestBottlesGenerationIdentity.test.ts`
- Modify: `src/lib/bestBottlesPromptPreflight.ts`
- Modify: `src/lib/bestBottlesPromptPreflight.test.ts`
- Modify: `supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts`
- Modify: `supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts`
- Modify: `scripts/best-bottles/generate-family-batch.ts`
- Modify: `scripts/best-bottles/family-batch-resume.ts`
- Modify: `scripts/best-bottles/family-batch-resume.test.ts`

**Interfaces:**
- Consumes: registry row and scale-contract version.
- Produces: generation payload and QA lineage that fail closed on stale or missing scale contracts.

- [ ] **Step 1: Write failing lineage tests**

Assert that a Best Bottles generation identity includes `scale-contract:best-bottles-catalog-scale-v1`, the resolved target, and registry key. Assert that missing or historical scale lineage is rejected for new runs, and that resume invalidates a prior rendered entry when its scale contract differs.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesGenerationIdentity.test.ts src/lib/bestBottlesPromptPreflight.test.ts supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts scripts/best-bottles/family-batch-resume.test.ts`  
Expected: FAIL on missing scale lineage.

- [ ] **Step 3: Thread registry evidence through generation**

Add `scaleContractVersion`, `calibrationRegistryKey`, `resolvedAssembledTargetPct`, and `resolvedBodyTargetPx` to the compiled identity, prompt QA checklist, edge-function validation, batch manifest, and resume fingerprint. Keep v6.1 shadow policy unchanged.

- [ ] **Step 4: Add cap-state rejection**

Before prompt compilation, reject cap-off when registry state is not `cap-off-confirmed` or `multi-component-confirmed`. Reject multi-component generation when topology evidence is missing. Permit `cap-off-unavailable` cap-on rows.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run the command from Step 2.  
Expected: all focused tests pass.

- [ ] **Step 6: Commit lineage enforcement**

```bash
git add src/lib/bestBottlesGenerationIdentity.ts src/lib/bestBottlesGenerationIdentity.test.ts src/lib/bestBottlesPromptPreflight.ts src/lib/bestBottlesPromptPreflight.test.ts supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts scripts/best-bottles/generate-family-batch.ts scripts/best-bottles/family-batch-resume.ts scripts/best-bottles/family-batch-resume.test.ts
git commit -m "feat(best-bottles): enforce scale and PSD lineage in generation"
```

### Task 8: Full verification and operator handoff

**Files:**
- Modify: `docs/best-bottles-generation-readiness.md`
- Create: `docs/best-bottles-global-scale-verification.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: reproducible verification evidence and a no-publish handoff.

- [ ] **Step 1: Run the focused catalog-scale suite**

Run: `npm run test:bestbottles:catalog-scale`  
Expected: every new resolver, registry, builder, and lineup test passes.

- [ ] **Step 2: Run the existing Best Bottles regression suite**

Run: `npm run test:bestbottles:image-coverage`  
Expected: all existing image, prompt, shadow, reference, rig, and publish-preflight tests pass.

- [ ] **Step 3: Run static verification**

Run: `npx tsc --noEmit`  
Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 4: Rebuild dry artifacts**

```bash
npm run bestbottles:catalog:reconcile
npm run bestbottles:generation:readiness
npm run bestbottles:scale:registry
npm run bestbottles:scale:lineups
```

Expected: deterministic outputs, explicit exclusions, no Shopify/Convex/Supabase writes, and no missing anchor hidden as success.

- [ ] **Step 5: Document evidence**

Record test counts, registry counts, excluded-reason counts, selected anchor SKUs, SHA-256 hashes for manifests, and links to the three lineup PNGs in `docs/best-bottles-global-scale-verification.md`. State plainly that calibration outputs are not approved storefront media.

- [ ] **Step 6: Review working-tree scope**

Run: `git status --short` and `git diff --check`. Confirm that unrelated pre-existing user changes remain untouched and that no generated secret, key, paid image request, database mutation, or Shopify action occurred.

- [ ] **Step 7: Commit verification docs**

```bash
git add docs/best-bottles-generation-readiness.md docs/best-bottles-global-scale-verification.md
git commit -m "docs(best-bottles): verify global catalog scale rollout"
```
