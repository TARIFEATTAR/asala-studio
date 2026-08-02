# CYL-9ML Roll-On Production Candidate Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first complete, UI-operated Paper-Doll production loop for the CYL-9ML roll-on system: exact catalog requirements, Blender-owned closure geometry, versioned upload/generation candidates, deterministic mask-and-clamp QA, named approval, and five-body lineup verification.

**Architecture:** The existing Best Bottles Studio remains the shell. A live Supabase-backed workbench selects one catalog requirement and creates an immutable candidate job; a local/containerized Blender worker or an explicitly selected AI provider produces candidate pixels in private Storage; a server-side clamp restores authoritative geometry before any candidate version is written. Fabric.js supplies visual selection and masks but never mutates an approved asset, and approval creates a new content-addressed approved version rather than modifying its parent.

**Tech Stack:** React 18, TypeScript, Fabric.js 5, TanStack Query, Supabase Postgres/Storage/Edge Functions, Node `sharp`, Blender Python/headless Eevee or Cycles, OpenAI GPT Image 2, Google Nano Banana, Zod, Node `tsx --test`.

## Global Constraints

- Reuse the five SHA-frozen 2080×2288 body plates; never regenerate or normalize them.
- Canonical release canvas is 2080×2288 with background `#F5F3EF`, center axis x=1041, and closure seat y=1002.
- Size closures from the locked 363 px body width, never from the measured 14.8 mm neck crest.
- Roll-on overcaps are moulded phenolic plastic with vacuum-metallized or coated finishes; no prompt or UI copy may call them aluminium, anodised, brushed, machined, or metal.
- Blender/object mask is geometry authority. Provider references, bounding boxes, and clean-looking generations are not geometry locks.
- Only post-clamp exact mask identity may display `geometry locked`.
- Every upload, provider result, manual paint, or transform creates a candidate child version; approved versions remain immutable.
- Provider/model fallback is prohibited. A different provider is a new named attempt.
- Rhinestone placement is a versioned deterministic layout, not regenerated independently per finish.
- Translucent hoods and live Sanity publication remain blocked in this milestone.
- Repair and requalify the 72.8% opaque-white-junk metal roller before it can appear in an assembly.
- Do not run broad `supabase db push`; the repository migration history is out of sync. Apply only the reviewed candidate-loop migration after a dry run and explicit schema verification.
- Do not rewrite the existing Studio route, authentication, organization context, or Masters lane.

## Shared Interfaces

These names and fields are stable across the tasks in this plan:

```ts
export type CandidateProvider = "blender" | "openai" | "google" | "manual";

export interface PrivateAssetRef {
  bucket: "paper-doll-sources" | "paper-doll-candidates" | "paper-doll-approved";
  path: string;
  sha256: string;
  contentType: string;
  byteSize: number;
}

export interface CandidateJobRequest {
  organizationId: string;
  requirementKey: string;
  componentId: string;
  parentComponentVersionId: string;
  parentSha256: string;
  provider: CandidateProvider;
  model: string;
  instruction: string;
  source: PrivateAssetRef;
  authoritativeMask: PrivateAssetRef;
  editMask: PrivateAssetRef;
  assemblyContext?: PrivateAssetRef;
  transform: { translateXPx: number; translateYPx: number; scaleX: number; scaleY: number };
}

export interface CandidateSelection extends CandidateJobRequest {
  selectionKind: "whole-layer" | "rectangle" | "brush";
}

export interface RenderCandidateResult {
  beauty: PrivateAssetRef;
  authoritativeMask: PrivateAssetRef;
  stoneMask?: PrivateAssetRef;
  canvas: { widthPx: 2080; heightPx: 2288; backgroundHex: "#F5F3EF" };
  mountAxisXPx: 1041;
  seatYPx: 1002;
  geometryRecipeSha256: string;
  rendererVersion: string;
}

export interface CandidateClampResult {
  output: PrivateAssetRef;
  maskSha256: string;
  changedPixelCount: number;
  changedBounds: { left: number; top: number; right: number; bottom: number } | null;
  geometryLocked: boolean;
  asymmetricStretchApplied: false;
}
```

---

## Task 1: Preserve the production baseline and reconcile reusable core modules

**Files:**

- Modify: `package.json`
- Create: `src/lib/paperDoll/corePort.test.ts`
- Port from `codex/best-bottles-product-hub-pipeline`: `src/lib/paperDoll/componentRegistry.ts`
- Port from `codex/best-bottles-product-hub-pipeline`: `src/lib/paperDoll/compositeEngine.ts`
- Port from `codex/best-bottles-product-hub-pipeline`: `src/lib/paperDoll/qaGates.ts`
- Port from `codex/best-bottles-product-hub-pipeline`: `src/lib/paperDoll/weldLane.ts`
- Port from `codex/best-bottles-product-hub-pipeline`: `src/lib/paperDoll/releaseContract.ts`
- Port from `codex/best-bottles-product-hub-pipeline`: `src/lib/paperDoll/releaseHash.node.ts`
- Port the corresponding focused `*.test.ts` files without importing generated release assets.

**Interfaces:**

- Consumes: the current live `releaseRepository.ts`, private Storage contract, and release-ledger migrations.
- Produces: component-registry primitives, composite geometry math, `plateSilhouette`, `runSwatchLockGate`, `clampOutsideMask`, and Release v1 parsing/hash primitives available on the production branch.

- [ ] **Step 1: Commit the already-verified storage/ledger registration slice separately**

  Stage only the current asset-plane files after rerunning their focused tests. Keep any unrelated worktree edits out of the commit.

  ```bash
  node --import tsx --test src/lib/paperDoll/assetStorage.test.ts src/lib/paperDoll/storageProvisioning.node.test.ts src/lib/paperDoll/cyl9BodyRelease.node.test.ts src/lib/paperDoll/releasePreview.test.ts
  git add package.json scripts/paper-doll/upload-cyl9-body-release.ts src/lib/paperDoll/cyl9BodyRelease.node.ts src/lib/paperDoll/cyl9BodyRelease.node.test.ts src/lib/paperDoll/releasePreview.ts src/lib/paperDoll/releasePreview.test.ts src/components/paper-doll/StorageBackedReleasePanel.tsx
  git commit -m "feat(paper-doll): register locked CYL-9ML body release"
  ```

- [ ] **Step 2: Write the failing core-port contract test**

  ```ts
  import assert from "node:assert/strict";
  import test from "node:test";
  import { buildWeldMask, clampOutsideMask } from "./weldLane";
  import { runSwatchLockGate } from "./qaGates";

  test("production branch exposes hostile-provider clamp and swatch-lock gates", async () => {
    assert.equal(typeof buildWeldMask, "function");
    assert.equal(typeof clampOutsideMask, "function");
    assert.equal(typeof runSwatchLockGate, "function");
  });
  ```

- [ ] **Step 3: Run the test and verify the modules are absent**

  Run: `node --import tsx --test src/lib/paperDoll/corePort.test.ts`

  Expected: FAIL with module-not-found for `weldLane` or `qaGates`.

- [ ] **Step 4: Port only the pure modules and their tests**

  Inspect each source with `git show codex/best-bottles-product-hub-pipeline:<path>`. Recreate the files in this branch with `apply_patch`; do not cherry-pick the old static workbench snapshot or its public asset bundle.

- [ ] **Step 5: Add the focused production test command**

  Install `sharp@0.35.2` to match the proven branch before running the ported buffer tests.

  Run: `npm install sharp@0.35.2 --save-exact`

  ```json
  {
    "scripts": {
      "test:paper-doll-production": "node --import tsx --test src/lib/paperDoll/assetStorage.test.ts src/lib/paperDoll/releaseRepository.test.ts src/lib/paperDoll/compositeEngine.test.ts src/lib/paperDoll/qaGates.test.ts src/lib/paperDoll/weldLane.test.ts src/lib/paperDoll/corePort.test.ts"
    }
  }
  ```

- [ ] **Step 6: Verify and commit**

  Run: `npm run test:paper-doll-production && npm run build`

  Expected: all focused tests pass; production build completes without new errors.

  ```bash
  git add package.json src/lib/paperDoll
  git commit -m "feat(paper-doll): port deterministic production core"
  ```

## Task 2: Freeze the exact CYL-9ML roll-on requirements denominator

**Files:**

- Create: `docs/paper-doll-rig/cyl9-rollon-requirements.json`
- Create: `src/lib/paperDoll/rollonRequirements.ts`
- Create: `src/lib/paperDoll/rollonRequirements.test.ts`
- Create: `scripts/paper-doll/build-cyl9-rollon-requirements.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: Best Bottles product truth rows keyed by `websiteSku` first and `graceSku` second.
- Produces: `loadCyl9RollonRequirements(): Cyl9RollonRequirementSnapshot` with a canonical SHA-256 and unique requirements for five bodies, ten overcap finishes, plastic/metal roller fitments, and explicit product assembly mappings.

- [ ] **Step 1: Write failing schema and uniqueness tests**

  ```ts
  test("snapshot contains five body variants and the ten named overcap finishes", () => {
    const snapshot = loadCyl9RollonRequirements();
    assert.deepEqual(snapshot.bodyVariantKeys, ["CLR", "AMB", "BLU", "FRS", "SWL"]);
    assert.deepEqual(snapshot.overcapVariantKeys, [
      "SHN-SL", "SHN-GL", "MAT-CU", "SHN-BLK", "MAT-SL",
      "MAT-GL", "WHT", "SL-DOT", "BLK-DOT", "PNK-DOT",
    ]);
    assert.deepEqual(snapshot.rollerVariantKeys, ["PLASTIC", "METAL"]);
  });

  test("every mapping uses one exact body, roller and overcap requirement", () => {
    for (const mapping of loadCyl9RollonRequirements().assemblyMappings) {
      assert.ok(mapping.websiteSku || mapping.graceSku);
      assert.match(mapping.mappingKey, /^CYL-9ML:/);
      assert.ok(mapping.bodyVariantKey);
      assert.ok(mapping.rollerVariantKey);
      assert.ok(mapping.overcapVariantKey);
    }
  });
  ```

- [ ] **Step 2: Verify the test fails before the snapshot exists**

  Run: `node --import tsx --test src/lib/paperDoll/rollonRequirements.test.ts`

  Expected: FAIL with missing module or snapshot.

- [ ] **Step 3: Implement a fail-closed Zod parser and canonical hash**

  ```ts
  export interface Cyl9RollonRequirementSnapshot {
    schemaVersion: 1;
    familyKey: "CYL-9ML";
    sourceGeneratedAt: string;
    sourceSha256: string;
    bodyVariantKeys: ["CLR", "AMB", "BLU", "FRS", "SWL"];
    overcapVariantKeys: string[];
    rollerVariantKeys: ["PLASTIC", "METAL"];
    requirements: RollonComponentRequirement[];
    assemblyMappings: RollonAssemblyRequirement[];
  }
  ```

- [ ] **Step 4: Generate the JSON from catalog truth and stop on ambiguous identities**

  The script must reject duplicate `websiteSku`, unresolved family geometry, missing 17-415 thread, or mappings that rely only on item-name parsing. It may emit unresolved evidence rows, but they cannot count in the release denominator.

- [ ] **Step 5: Verify the snapshot against the real catalog**

  Run:

  ```bash
  npm run paper-doll:cyl9:requirements
  node --import tsx --test src/lib/paperDoll/rollonRequirements.test.ts
  ```

  Expected: the stored hash recomputes exactly, five bodies and twelve unique roll-on component variants are represented, and every included mapping resolves without fallback.

  Catalog correction: the exact SKU and product-description evidence consistently identifies `MattCu` / matte copper. `MAT-CU` replaces the earlier unsubstantiated `SHN-CU` token. The snapshot preserves this correction as an advisory issue.

- [ ] **Step 6: Commit**

  ```bash
  git add package.json docs/paper-doll-rig/cyl9-rollon-requirements.json scripts/paper-doll/build-cyl9-rollon-requirements.ts src/lib/paperDoll/rollonRequirements.ts src/lib/paperDoll/rollonRequirements.test.ts
  git commit -m "feat(paper-doll): freeze CYL-9ML roll-on requirements"
  ```

## Task 3: Add immutable candidate-job and named-approval contracts

**Files:**

- Create: `supabase/migrations/20260802052230_paper_doll_candidate_jobs.sql`.
- Create: `supabase/migrations/20260802052407_paper_doll_candidate_job_fk_indexes.sql` from the post-DDL advisor result.
- Create: `src/lib/paperDoll/candidateJobContract.ts`
- Create: `src/lib/paperDoll/candidateJobContract.test.ts`
- Modify: `src/integrations/supabase/types.ts` only through generated types.

**Interfaces:**

- Consumes: `paper_doll_components`, `paper_doll_component_versions`, `paper_doll_qa_results`, private buckets, organization membership, and `generation_attempts` when a provider is called.
- Produces: `paper_doll_candidate_jobs`, `paper_doll_component_approvals`, read-only `get_paper_doll_candidate_workbench`, and TypeScript `CandidateJobRequest`/`CandidateJobRecord`.

- [ ] **Step 1: Write failing request-contract tests**

  ```ts
  test("AI jobs require a parent SHA, authoritative mask and explicit provider", () => {
    const result = CandidateJobRequestSchema.safeParse({
      organizationId: ORG_ID,
      requirementKey: "CYL-9ML:OVERCAP:MAT-GL",
      parentComponentVersionId: VERSION_ID,
      parentSha256: SHA,
      provider: "google",
      model: "gemini-3-pro-image-preview",
      editMask: { bucket: "paper-doll-sources", path: MASK_PATH, sha256: MASK_SHA },
      instruction: "Change only the coating to soft matte gold.",
    });
    assert.equal(result.success, true);
  });

  test("auto provider and missing masks fail closed", () => {
    assert.equal(CandidateJobRequestSchema.safeParse({ provider: "auto" }).success, false);
  });
  ```

- [ ] **Step 2: Run the tests and verify failure**

  Run: `node --import tsx --test src/lib/paperDoll/candidateJobContract.test.ts`

  Expected: FAIL with missing schema module.

- [ ] **Step 3: Implement the migration**

  `paper_doll_candidate_jobs` must include UUID organization/component/parent references, requirement key, provider (`blender|openai|google|manual`), exact model, status (`queued|running|clamping|qa|candidate_ready|failed|cancelled`), prompt and prompt SHA, source/mask references, optional `generation_attempt_id`, output metadata, initiating user, error, and timestamps. Browser roles receive SELECT only; service role owns writes.

  `paper_doll_component_approvals` must be append-only and contain candidate version, resulting approved version, approver user, decision, evidence IDs, expected SHA, and timestamp.

- [ ] **Step 4: Add the read-only workbench RPC**

  Use `SECURITY INVOKER`, organization RLS, `REVOKE` from `PUBLIC, anon`, and grant only `authenticated, service_role`. Return candidate jobs and approval evidence without signed URLs.

- [ ] **Step 5: Test the SQL source before applying it**

  ```ts
  test("candidate schema grants no browser writes", () => {
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
    assert.doesNotMatch(sql, /FOR INSERT TO authenticated/i);
    assert.match(sql, /SECURITY INVOKER/i);
    assert.match(sql, /REVOKE ALL.*anon/is);
  });
  ```

- [ ] **Step 6: Apply only this migration and regenerate types**

  First run a linked dry run. If global migration drift blocks it, apply the exact reviewed SQL through the Supabase migration tool and repair only this single version. Then generate TypeScript types and verify the tables, RLS, policies, RPC privileges, and security advisors.

- [ ] **Step 7: Commit**

  ```bash
  git add supabase/migrations src/lib/paperDoll/candidateJobContract.ts src/lib/paperDoll/candidateJobContract.test.ts src/integrations/supabase/types.ts
  git commit -m "feat(paper-doll): add candidate job and approval ledger"
  ```

## Task 4: Create the Blender geometry authority and deterministic roll-on render pack

**Files:**

- Create: `workers/paper-doll-renderer/Dockerfile`
- Create: `workers/paper-doll-renderer/package.json`
- Create: `workers/paper-doll-renderer/src/worker.ts`
- Create: `workers/paper-doll-renderer/blender/cyl9_rollon_overcap.py`
- Create: `workers/paper-doll-renderer/blender/materials.py`
- Create: `workers/paper-doll-renderer/fixtures/cyl9-rollon-scene.json`
- Create: `scripts/paper-doll/render-cyl9-rollon-pack.ts`
- Create: `scripts/paper-doll/render-cyl9-rollon-pack.test.ts`
- Create: `docs/paper-doll-rig/cyl9-rollon-stone-layout.json`

**Interfaces:**

- Consumes: a candidate job with provider `blender`, locked canvas/axis/seat, body-width geometry authority, and the roll-on requirement variant.
- Produces: full-canvas PNG beauty pass, binary object mask, optional stone mask, renderer recipe JSON, SHA-256 values, and `RenderCandidateResult`.

- [ ] **Step 1: Write a failing renderer recipe test**

  ```ts
  test("all overcap finishes share one scene geometry recipe", async () => {
    const pack = await inspectRenderPack(FIXTURE_DIR);
    assert.equal(pack.assets.length, 10);
    assert.equal(new Set(pack.assets.map((x) => x.geometryRecipeSha256)).size, 1);
    assert.equal(new Set(pack.assets.map((x) => x.maskSha256)).size, 1);
    assert.ok(pack.assets.every((x) => x.mountAxisXPx === 1041 && x.seatYPx === 1002));
  });
  ```

- [ ] **Step 2: Verify failure before the renderer exists**

  Run: `node --import tsx --test scripts/paper-doll/render-cyl9-rollon-pack.test.ts`

  Expected: FAIL with missing render-pack module.

- [ ] **Step 3: Implement one parametric overcap mesh and camera**

  The scene must generate a single cylinder/crown/flared-base mesh from one recipe, render on an orthographic camera, and place the output using the locked 363 px target width, x=1041, y=1002. The recipe records image-contract-derived dimensions separately from vendor-confirmed physical dimensions and must not label this mesh AR-ready.

- [ ] **Step 4: Implement material families without geometry changes**

  - `SHN-SL` is the mirror master.
  - `SHN-GL` and `SHN-CU` use deterministic hue/material parameters while retaining the mirror room-band structure.
  - `SHN-BLK`, `MAT-SL`, `MAT-GL`, and `WHT` use distinct roughness/specular response on the same mesh.
  - No material function may add a displacement, bevel, modifier, camera change, or mesh transform.

- [ ] **Step 5: Freeze rhinestone layout once**

  Store normalized, ordered stone centers and radii in `cyl9-rollon-stone-layout.json`. The Blender script instances stones from that file for `SL-DOT`, `BLK-DOT`, and `PNK-DOT`; it never asks an image model to invent placement.

- [ ] **Step 6: Render and calibrate on real output**

  Run the pack command, inspect alpha rather than frame tone, confirm every mask SHA matches, confirm the object is not the full frame, and record clipping mass/material measurements separately by finish family.

- [ ] **Step 7: Commit renderer code and small evidence only**

  Do not commit multi-megabyte render outputs. Commit recipe, masks only if size policy permits, measured report, scripts, and tests.

  ```bash
  git add workers/paper-doll-renderer scripts/paper-doll/render-cyl9-rollon-pack.ts scripts/paper-doll/render-cyl9-rollon-pack.test.ts docs/paper-doll-rig/cyl9-rollon-stone-layout.json
  git commit -m "feat(paper-doll): add canonical roll-on Blender renderer"
  ```

## Task 5: Implement provider adapters and deterministic mask-and-clamp candidate intake

**Files:**

- Create: `supabase/functions/generate-paper-doll-candidate/index.ts`
- Create: `supabase/functions/_shared/paperDollCandidateContract.ts`
- Create: `supabase/functions/_shared/paperDollCandidateContract.test.ts`
- Create: `src/lib/paperDoll/candidateClamp.node.ts`
- Create: `src/lib/paperDoll/candidateClamp.node.test.ts`
- Create: `scripts/paper-doll/process-paper-doll-candidate.ts`

**Interfaces:**

- Consumes: `CandidateJobRequest`, source image bytes, selected edit mask, authoritative object mask, explicit provider/model, and Blender worker outputs.
- Produces: candidate object in `paper-doll-candidates`, candidate component-version row with parent lineage, append-only QA results, changed-pixel evidence, and final job status.

- [ ] **Step 1: Write hostile-provider clamp tests**

  ```ts
  test("clamp restores every pixel outside the edit mask and object mask", async () => {
    const result = await clampCandidate({ source, provider: solidMagenta, editMask, objectMask });
    assert.deepEqual(result.outsideEditPixels, source.outsideEditPixels);
    assert.equal(result.maskSha256, authoritativeMaskSha256);
    assert.equal(result.geometryLocked, true);
  });

  test("dimension mismatch normalizes without asymmetric stretching", async () => {
    const result = await clampCandidate({ source, provider: squareProviderResult, editMask, objectMask });
    assert.deepEqual(result.canvas, { widthPx: 2080, heightPx: 2288 });
    assert.equal(result.asymmetricStretchApplied, false);
  });
  ```

- [ ] **Step 2: Run tests and verify failure**

  Run: `node --import tsx --test src/lib/paperDoll/candidateClamp.node.test.ts`

  Expected: FAIL with missing clamp module.

- [ ] **Step 3: Implement the pure Sharp clamp**

  Normalize with contain/letterbox math, restore source outside the edit mask, apply authoritative alpha exactly, restore assembly outside the component mask, calculate changed-pixel count/bounds, and emit source/output/mask hashes.

- [ ] **Step 4: Implement explicit provider adapters**

  Support only `openai:gpt-image-2` and the named Google Nano Banana model IDs accepted by the contract. Reference images precede prompt text. No adapter may fall through to another provider or model.

- [ ] **Step 5: Record the attempt before provider dispatch**

  Reuse `generationAttemptLedger.ts`. Link the resulting `generation_attempt_id` to the candidate job, record actual provider/model/latency/cost, and mark failures without creating a component version.

- [ ] **Step 6: Upload then create the candidate version**

  Upload with `upsert:false` to an organization-scoped content-addressed candidate path. Only after download/hash verification insert the candidate component version, parent ID, QA rows, and job result. A storage success followed by DB failure leaves an unreferenced object, never a false approval.

- [ ] **Step 7: Verify and deploy the function**

  Run contract, clamp, storage, and RLS tests. Deploy with JWT verification enabled. Confirm anon rejection and organization isolation with real authenticated fixtures.

- [ ] **Step 8: Commit**

  ```bash
  git add supabase/functions/generate-paper-doll-candidate supabase/functions/_shared/paperDollCandidateContract.ts supabase/functions/_shared/paperDollCandidateContract.test.ts src/lib/paperDoll/candidateClamp.node.ts src/lib/paperDoll/candidateClamp.node.test.ts scripts/paper-doll/process-paper-doll-candidate.ts
  git commit -m "feat(paper-doll): clamp generated candidate versions"
  ```

## Task 6: Build the minimum Fabric Assembly/Edit Lab canvas

**Files:**

- Create: `src/components/paper-doll/ProductionCandidateWorkbench.tsx`
- Create: `src/components/paper-doll/AssemblyEditCanvas.tsx`
- Create: `src/components/paper-doll/CandidateInspector.tsx`
- Create: `src/components/paper-doll/assemblyEditModel.ts`
- Create: `src/components/paper-doll/assemblyEditModel.test.ts`
- Create: `src/components/paper-doll/useCandidateMask.ts`
- Modify: `src/pages/BestBottlesStudio.tsx`

**Interfaces:**

- Consumes: live release workbench data, requirement snapshot, candidate jobs, signed source/candidate URLs, and release coordinates.
- Produces: `CandidateSelection` containing selected component version, exact full-canvas mask PNG, selection kind, temporary transform, instruction, provider, and model.

- [ ] **Step 1: Write pure canvas-model tests**

  ```ts
  test("display coordinates round-trip to the 2080x2288 release canvas", () => {
    const point = displayToRelease({ x: 260, y: 286 }, { width: 520, height: 572 });
    assert.deepEqual(point, { x: 1040, y: 1144 });
  });

  test("release-lock transforms are non-persistent", () => {
    assert.equal(canPersistTransform({ mode: "release-lock" }), false);
    assert.equal(canPersistTransform({ mode: "edit-lab", createsCandidate: true }), true);
  });
  ```

- [ ] **Step 2: Verify failure**

  Run: `node --import tsx --test src/components/paper-doll/assemblyEditModel.test.ts`

  Expected: FAIL with missing model.

- [ ] **Step 3: Implement Fabric canvas basics only**

  Add pan, zoom, layer selection, visibility, centerline, baseline, seat, alpha-bounds, and object-mask overlays. Add rectangle, whole-layer, and brush masks. Do not add filters, text, arbitrary effects, or direct approved-layer mutation.

- [ ] **Step 4: Implement two explicit modes**

  `release-lock` disables transform persistence and painting. `edit-lab` permits temporary movement and mask painting, but Save Candidate serializes the affine delta and mask rather than changing the release.

- [ ] **Step 5: Implement the inspector**

  Show parent/version SHA, source/candidate/difference views, provider/model/cost, prompt hash, changed pixels, QA evidence, and the `geometry locked` label only when the server returns exact mask identity.

- [ ] **Step 6: Mount only for CYL-9ML release-capable groups**

  Preserve Masters and legacy Components for all other families. Remove the local preview query dependency from the production path; a missing live release renders an explicit unavailable state.

- [ ] **Step 7: Verify and commit**

  Run focused model tests, component tests, keyboard checks, and `npm run build`.

  ```bash
  git add src/components/paper-doll src/pages/BestBottlesStudio.tsx
  git commit -m "feat(paper-doll): add assembly edit lab canvas"
  ```

## Task 7: Connect Generate, Upload, candidate history, and approval promotion

**Files:**

- Create: `src/lib/paperDoll/candidateRepository.ts`
- Create: `src/lib/paperDoll/candidateRepository.test.ts`
- Create: `src/components/paper-doll/CandidateActionPanel.tsx`
- Create: `supabase/functions/approve-paper-doll-candidate/index.ts`
- Create: `supabase/functions/_shared/paperDollApprovalContract.ts`
- Create: `supabase/functions/_shared/paperDollApprovalContract.test.ts`
- Modify: `src/components/paper-doll/ProductionCandidateWorkbench.tsx`

**Interfaces:**

- Consumes: `CandidateSelection`, private source/candidate objects, candidate workbench RPC, named authenticated user, and passing blocking QA IDs.
- Produces: queued job, polled candidate history, manual-upload job, or newly inserted approved component version plus append-only approval record.

- [ ] **Step 1: Write repository tests for explicit provider requests**

  ```ts
  test("createCandidateJob sends one exact provider and expected parent SHA", async () => {
    await createCandidateJob(client, selection);
    assert.deepEqual(invocation.body.provider, "openai");
    assert.deepEqual(invocation.body.model, "gpt-image-2");
    assert.deepEqual(invocation.body.parentSha256, PARENT_SHA);
  });
  ```

- [ ] **Step 2: Write approval tests that reject stale or unqualified candidates**

  Test expected SHA mismatch, missing blocking QA, cross-organization candidate, anonymous request, previously approved parent mutation, and metal-roller white-junk failure.

- [ ] **Step 3: Implement Generate and Upload Source**

  Generate calls only the candidate Edge Function. Upload Source writes to `paper-doll-sources` with `upsert:false`, records SHA/bytes/content type, then creates a `manual` candidate job; it never inserts an approved row directly.

- [ ] **Step 4: Implement worker health and job history**

  Show `offline`, `ready`, `busy`, or `error`. Blender jobs may be queued while the worker is offline, but the UI must say so and never report generation as running without a claimed job.

- [ ] **Step 5: Implement approval as copy-plus-insert**

  The server downloads and verifies the candidate, copies it to a content-addressed path in `paper-doll-approved` with no overwrite, and inserts a new approved child version plus approval evidence. The candidate row remains unchanged.

- [ ] **Step 6: Refresh live release state without silently editing the release**

  Approval updates the component inventory. Adding the approved version to a release remains an explicit release-draft action, so an operator cannot change the current release by approving a candidate.

- [ ] **Step 7: Deploy, verify, and commit**

  Deploy the approval function with JWT verification. Confirm RLS and immutable-trigger behavior against a real Best Bottles user and an unrelated organization fixture.

  ```bash
  git add src/lib/paperDoll/candidateRepository.ts src/lib/paperDoll/candidateRepository.test.ts src/components/paper-doll/CandidateActionPanel.tsx src/components/paper-doll/ProductionCandidateWorkbench.tsx supabase/functions/approve-paper-doll-candidate supabase/functions/_shared/paperDollApprovalContract.ts supabase/functions/_shared/paperDollApprovalContract.test.ts
  git commit -m "feat(paper-doll): approve immutable candidate versions"
  ```

## Task 8: Repair rollers and qualify the full opaque roll-on component pack

**Files:**

- Create: `scripts/paper-doll/repair-cyl9-metal-roller.ts`
- Create: `scripts/paper-doll/repair-cyl9-metal-roller.test.ts`
- Modify: `src/lib/paperDoll/qaGates.ts`
- Modify: `src/lib/paperDoll/qaGates.test.ts`
- Create: `docs/paper-doll-rig/evidence/CYL-9ML-ROLLON-COMPONENT-QUALIFICATION.md`

**Interfaces:**

- Consumes: recropped metal roller source, plastic roller source, ten rendered overcaps, actual alpha masks, and calibrated approved/rejected fixtures.
- Produces: approved or blocked version decision for each of twelve unique roll-on components with real QA evidence.

- [ ] **Step 1: Write the opaque-white-fraction regression test**

  ```ts
  test("rejects the frozen metal roller with 72.8 percent opaque white junk", async () => {
    const result = await opaqueWhiteFraction(defectiveMetalRoller);
    assert.ok(result.fraction >= 0.728 - 0.005);
    assert.equal(result.passed, false);
  });

  test("accepts the plastic roller calibration fixture", async () => {
    const result = await opaqueWhiteFraction(plasticRoller);
    assert.equal(result.fraction, 0);
  });
  ```

- [ ] **Step 2: Verify the current gate fails to detect the defect**

  Run the targeted QA test and preserve the failing measurement as evidence.

- [ ] **Step 3: Implement repair from the recropped source**

  Remove background with ML matting, crop from alpha, place at the locked axis/seat without arbitrary per-bottle movement, and generate a new candidate SHA. Never modify or relabel the defective frozen version.

- [ ] **Step 4: Calibrate finish-specific QA**

  Use alpha for silhouette/mask identity. Calibrate mirror clipping/band evidence on mirror fixtures, diffuse-gradient evidence on matte fixtures, and specular/body-readability evidence on glossy black/white fixtures. Do not reuse one tone threshold across materials.

- [ ] **Step 5: Qualify rhinestones**

  Compare the deterministic stone layout ID, count, ordered centers, and stone-mask SHA. Reject any provider or render that moves, drops, or invents stones.

- [ ] **Step 6: Record the twelve-component verdict**

  The qualification document lists version IDs, hashes, gate versions, calibration fixtures, pass/fail status, and remaining blockers. No component is approved solely by visual impression.

- [ ] **Step 7: Commit**

  ```bash
  git add scripts/paper-doll/repair-cyl9-metal-roller.ts scripts/paper-doll/repair-cyl9-metal-roller.test.ts src/lib/paperDoll/qaGates.ts src/lib/paperDoll/qaGates.test.ts docs/paper-doll-rig/evidence/CYL-9ML-ROLLON-COMPONENT-QUALIFICATION.md
  git commit -m "fix(paper-doll): repair and qualify CYL-9ML rollers"
  ```

## Task 9: Build a blocked roll-on release draft and verify the five-body lineup

**Files:**

- Create: `src/lib/paperDoll/rollonReleaseDraft.node.ts`
- Create: `src/lib/paperDoll/rollonReleaseDraft.node.test.ts`
- Create: `scripts/paper-doll/build-cyl9-rollon-release.ts`
- Create: `src/components/paper-doll/RollonLineup.tsx`
- Create: `src/components/paper-doll/rollonLineupModel.ts`
- Create: `src/components/paper-doll/rollonLineupModel.test.ts`
- Create: `docs/paper-doll-rig/evidence/CYL-9ML-ROLLON-PRODUCTION-CANDIDATE-LOOP.md`

**Interfaces:**

- Consumes: five approved bodies, approved opaque roll-on component versions, requirement snapshot, exact assembly mappings, and QA evidence.
- Produces: a new blocked or ready roll-on release draft, five-body lineup, completeness counts, and browser evidence; it does not publish to Sanity.

- [ ] **Step 1: Write release-builder tests**

  ```ts
  test("release contains no missing requirement disguised as complete", () => {
    const draft = buildRollonReleaseDraft(input);
    assert.equal(draft.counts.required, input.requirements.requirements.length);
    assert.equal(draft.counts.approved + draft.counts.blocked + draft.counts.missing, draft.counts.required);
  });

  test("unknown or blocked component prevents ready status", () => {
    const draft = buildRollonReleaseDraft(inputWithBlockedMetalRoller);
    assert.equal(draft.releaseStatus, "blocked");
  });
  ```

- [ ] **Step 2: Verify the tests fail before the builder exists**

  Run: `node --import tsx --test src/lib/paperDoll/rollonReleaseDraft.node.test.ts`

  Expected: FAIL with missing builder.

- [ ] **Step 3: Implement deterministic manifest creation**

  Select only exact approved component-version IDs. Preserve body/cap/roller layer order, mappings, canvas, axis, seat, object masks, QA references, source commit, renderer recipe, requirements hash, and canonical manifest SHA.

- [ ] **Step 4: Register the draft atomically**

  Upload any new approved objects first, verify them by download/hash, then insert the release header and memberships in one database transaction. Re-running an existing release version must verify the same manifest hash and perform no mutation.

- [ ] **Step 5: Render five explicit assemblies**

  Show clear, amber, cobalt, frosted, and swirl at identical canvas scale with shared baseline, centerline, cap mask, and layer-order overlays. No fallback asset may render when a mapping is missing.

- [ ] **Step 6: Run browser and console verification**

  Verify real signed private assets, candidate generation/history, mask painting, explicit provider selection, approval evidence, matrix counts, lineup alignment, and zero Sanity writes. Capture screenshots without the `paperDollPreview=1` query.

- [ ] **Step 7: Run the completion suite**

  ```bash
  npm run test:paper-doll-production
  node --import tsx --test src/lib/paperDoll/candidateJobContract.test.ts src/lib/paperDoll/candidateClamp.node.test.ts src/lib/paperDoll/rollonRequirements.test.ts src/lib/paperDoll/rollonReleaseDraft.node.test.ts src/components/paper-doll/assemblyEditModel.test.ts src/components/paper-doll/rollonLineupModel.test.ts
  npm run build
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add src/lib/paperDoll/rollonReleaseDraft.node.ts src/lib/paperDoll/rollonReleaseDraft.node.test.ts scripts/paper-doll/build-cyl9-rollon-release.ts src/components/paper-doll/RollonLineup.tsx src/components/paper-doll/rollonLineupModel.ts src/components/paper-doll/rollonLineupModel.test.ts docs/paper-doll-rig/evidence/CYL-9ML-ROLLON-PRODUCTION-CANDIDATE-LOOP.md
  git commit -m "feat(paper-doll): verify CYL-9ML roll-on candidate loop"
  ```

## Completion Gate

- [ ] The production worktree contains the proven pure compositor, clamp, QA, and release primitives without the old static/public workbench asset path.
- [ ] The Matrix denominator comes from one versioned catalog-truth snapshot and distinguishes missing, candidate, QA-passed, approved, in-release, and blocked states.
- [ ] All ten overcap finishes share one authoritative object mask; chrome tint variants and rhinestone layouts are deterministic.
- [ ] The plastic and repaired metal roller variants have calibrated opaque-white-fraction evidence.
- [ ] The Assembly/Edit Lab supports pan, zoom, overlays, layer/rectangle/brush masks, explicit provider selection, and versioned temporary transforms.
- [ ] Every provider/manual edit produces a candidate child in private Storage; no path overwrites an approved object.
- [ ] Only server-clamped exact mask identity displays `geometry locked`.
- [ ] Named approval creates a new approved child version and append-only evidence.
- [ ] Five body assemblies render at one locked scale/baseline with no fallback mappings.
- [ ] The roll-on release remains blocked if any required component or mapping is missing or failed.
- [ ] No translucent asset approval and no Sanity write occurs in this milestone.
