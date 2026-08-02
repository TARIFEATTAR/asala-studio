# CYL-9ML Shared Placement Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator approve the clean plastic and metal roller pixels, fit either approved roller once across all five locked CYL-9ML plates, and persist one immutable shared placement while presenting the active ledger as Current Release.

**Architecture:** Extend candidate history so the UI can resolve the immutable approved child produced by pixel approval. Add an organization-scoped placement ledger keyed by family, fitment geometry, exact authority-mask SHA, and canvas contract; write it only through an authenticated Edge Function and service-only transaction. Keep Family Fit separate from Current Release: placement locking creates immutable placement truth but never silently changes active release membership or Sanity.

**Tech Stack:** React 18, TypeScript, TanStack Query, Zod, Fabric.js, Supabase Postgres/RLS/RPC/Edge Functions, Node test runner, Vitest-compatible ESLint/TypeScript build tooling.

## Global Constraints

- The five CYL-9ML body plates remain immutable.
- Canvas coordinates are always `2080×2288` release pixels.
- Plastic and metal share placement only when their authority-mask SHA-256 values are identical.
- Only exact server-side mask-and-clamp identity earns `geometry locked`.
- Family Fit permits translation and uniform scale only; rotation, warping, non-uniform scaling, cropping, and per-body offsets fail closed.
- Pixel approval, placement lock, release cut, and Sanity publication are four separate named actions.
- No task in this plan changes active release membership or publishes to Sanity.
- Browser clients have organization-scoped reads and no direct placement-table writes.
- All immutable history preserves prior candidate, component, placement, QA, and approval rows.

---

### Task 1: Resolve Approved Pixel Children in Candidate History

**Files:**
- Create: `supabase/migrations/20260802210000_expose_approved_candidate_children.sql`
- Modify: `src/lib/paperDoll/candidateRepository.ts`
- Modify: `src/lib/paperDoll/candidateRepository.test.ts`
- Modify: `src/lib/paperDoll/candidateReviewPolicy.ts`
- Modify: `src/lib/paperDoll/candidateReviewPolicy.test.ts`

**Interfaces:**
- Consumes: existing `paper_doll_component_approvals.resulting_approved_component_version_id` and approved component versions.
- Produces: `CandidateHistoryEntry.approvedVersion`, `approvedImageUrl`, and `approvedCandidateDetails(entry)` for Family Fit eligibility.

- [ ] **Step 1: Write failing repository tests for approved children**

Add a fixture whose approval points to an approved child and assert:

```ts
assert.equal(result.jobs[0].approvedVersion?.approval_status, "approved");
assert.equal(result.jobs[0].approvedVersion?.image_sha256, candidateSha);
assert.match(result.jobs[0].approvedImageUrl ?? "", /paper-doll-approved/);
```

Also assert that a rejected decision and an approval without a resulting child produce `approvedVersion: null` and `approvedImageUrl: null`.

- [ ] **Step 2: Run the focused repository tests and verify failure**

Run:

```bash
node --import tsx --test src/lib/paperDoll/candidateRepository.test.ts src/lib/paperDoll/candidateReviewPolicy.test.ts
```

Expected: FAIL because approved child fields and policy do not exist.

- [ ] **Step 3: Extend the candidate-workbench RPC**

Create a forward migration that replaces `get_paper_doll_candidate_workbench(UUID, TEXT)` and adds an `approvedVersion` JSON object by joining:

```sql
LEFT JOIN public.paper_doll_component_versions AS approved_version
  ON approved_version.id = approval.resulting_approved_component_version_id
 AND approved_version.organization_id = approval.organization_id
```

Return only the immutable approved child referenced by the approval row. Preserve existing jobs, approvals, worker health, RLS, and execute grants.

- [ ] **Step 4: Parse and sign the approved child**

Extend the entry without replacing candidate identity:

```ts
export interface CandidateHistoryEntry {
  // existing fields
  approvedVersion: Record<string, unknown> | null;
  approvedImageUrl: string | null;
}
```

Sign `approvedVersion.storage_bucket + image_path` for 300 seconds only after the RPC returns an organization-visible approved version.

- [ ] **Step 5: Add the approval eligibility policy**

Implement:

```ts
export interface ApprovedCandidateDetails {
  componentVersionId: string;
  imageUrl: string;
  imageSha256: string;
  authorityMaskSha256: string;
  alphaBounds: { left: number; top: number; right: number; bottom: number };
}

export function approvedCandidateDetails(
  entry: CandidateHistoryEntry | null,
): ApprovedCandidateDetails | null;
```

Return null unless the approval decision is `approved`, the approved child status is `approved`, the candidate and approved image SHA values match, the exact geometry-mask SHA exists, alpha bounds are finite, and the approved signed URL exists.

- [ ] **Step 6: Run focused tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add supabase/migrations src/lib/paperDoll/candidateRepository.ts src/lib/paperDoll/candidateRepository.test.ts src/lib/paperDoll/candidateReviewPolicy.ts src/lib/paperDoll/candidateReviewPolicy.test.ts
git commit -m "feat(paper-doll): resolve approved pixel children"
```

---

### Task 2: Add the Immutable Shared-Placement Ledger

**Files:**
- Create: `supabase/migrations/20260802211000_paper_doll_shared_placements.sql`
- Create: `supabase/functions/_shared/paperDollPlacementContract.ts`
- Create: `supabase/functions/_shared/paperDollPlacementContract.test.ts`
- Create: `src/lib/paperDoll/placementContract.ts`
- Create: `src/lib/paperDoll/placementContract.test.ts`

**Interfaces:**
- Consumes: an approved component version, exact mask SHA, five release body component-version IDs, transform, and named approver.
- Produces: immutable `paper_doll_placement_versions`, per-body `paper_doll_placement_reviews`, `paper_doll_placement_approvals`, read RPC, and service-only lock RPC.

- [ ] **Step 1: Write failing contract tests**

Define and test this request shape:

```ts
const request = {
  organizationId,
  familyKey: "CYL-9ML",
  fitmentGeometryKey: "fitment__roller-ball__17-415__v1",
  calibrationComponentVersionId,
  expectedAuthorityMaskSha256: maskSha,
  canvas: { widthPx: 2080, heightPx: 2288 },
  transform: {
    translateXPx: 27.066,
    translateYPx: -134.132,
    uniformScale: 0.974,
  },
  compatibleBodyComponentVersionIds: fiveBodyIds,
  approverDisplayName: "Jordan Richter",
  approvalNote: "Flush across all five CYL-9ML plates",
};
```

Assert rejection of non-uniform fields, non-finite numbers, scale `<= 0`, wrong canvas, duplicate or fewer than five CYL-9ML bodies, missing approver, and malformed SHA.

- [ ] **Step 2: Run contract tests and verify failure**

Run:

```bash
node --import tsx --test src/lib/paperDoll/placementContract.test.ts supabase/functions/_shared/paperDollPlacementContract.test.ts
```

Expected: FAIL because the placement schemas do not exist.

- [ ] **Step 3: Implement the shared Zod/browser contract and Edge parser**

Export:

```ts
export const SharedPlacementLockRequestSchema = z.object({
  organizationId: z.string().uuid(),
  familyKey: z.literal("CYL-9ML"),
  fitmentGeometryKey: z.literal("fitment__roller-ball__17-415__v1"),
  calibrationComponentVersionId: z.string().uuid(),
  expectedAuthorityMaskSha256: z.string().regex(/^[a-f0-9]{64}$/),
  canvas: z.object({ widthPx: z.literal(2080), heightPx: z.literal(2288) }),
  transform: z.object({
    translateXPx: z.number().finite(),
    translateYPx: z.number().finite(),
    uniformScale: z.number().finite().positive(),
  }),
  compatibleBodyComponentVersionIds: z.array(z.string().uuid()).length(5),
  approverDisplayName: z.string().trim().min(1),
  approvalNote: z.string().trim().min(1).max(500),
});
```

Require five unique body IDs in a `superRefine` callback.

- [ ] **Step 4: Create immutable placement tables**

The migration creates:

```sql
CREATE TABLE public.paper_doll_placement_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  family_key TEXT NOT NULL,
  fitment_geometry_key TEXT NOT NULL,
  authority_mask_sha256 TEXT NOT NULL CHECK (authority_mask_sha256 ~ '^[a-f0-9]{64}$'),
  canvas_width_px INTEGER NOT NULL CHECK (canvas_width_px = 2080),
  canvas_height_px INTEGER NOT NULL CHECK (canvas_height_px = 2288),
  translate_x_px NUMERIC NOT NULL,
  translate_y_px NUMERIC NOT NULL,
  uniform_scale NUMERIC NOT NULL CHECK (uniform_scale > 0),
  mount_axis_x_px NUMERIC NOT NULL,
  contact_y_px NUMERIC NOT NULL,
  calibration_component_version_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Add composite organization foreign keys, deterministic uniqueness across the fingerprint and transform, RLS organization-member SELECT, service-role writes, no authenticated writes, and immutable/no-delete triggers.

Create `paper_doll_placement_reviews` with one row per placement/body pair and `paper_doll_placement_approvals` with approver identity, note, and review IDs. Both tables are append-only and organization-scoped.

- [ ] **Step 5: Add read and service-only lock RPCs**

`get_paper_doll_family_placement(UUID, TEXT, TEXT, TEXT)` returns the latest approved placement only for the supplied family, geometry key, mask SHA, and organization.

`lock_paper_doll_shared_placement(...)` must, in one transaction:

1. lock and verify the calibration component is approved;
2. verify its exact geometry-mask SHA and `2080×2288` canvas;
3. verify all five body IDs are approved `body` components in the active CYL-9ML release;
4. verify all five body geometry specs share the family placement contract;
5. insert or reuse the exact immutable placement version;
6. insert five named `assembly-context` passed review rows;
7. insert one placement approval referencing those five rows;
8. return IDs plus `releaseChanged: false` and `sanityPublished: false`.

Grant the read RPC to authenticated users and the lock RPC only to service role.

- [ ] **Step 6: Add SQL-contract assertions**

In the shared contract test, read the migration and assert it contains RLS, read-only authenticated grants, service-only lock execution, immutable triggers, exact mask comparison, five-body validation, and false release/Sanity flags.

- [ ] **Step 7: Run focused tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add supabase/migrations supabase/functions/_shared src/lib/paperDoll/placementContract.ts src/lib/paperDoll/placementContract.test.ts
git commit -m "feat(paper-doll): add immutable shared placement ledger"
```

---

### Task 3: Add the Authenticated Placement Lock Boundary

**Files:**
- Create: `supabase/functions/lock-paper-doll-placement/index.ts`
- Create: `supabase/functions/lock-paper-doll-placement/index.test.ts`
- Create: `src/lib/paperDoll/placementRepository.ts`
- Create: `src/lib/paperDoll/placementRepository.test.ts`

**Interfaces:**
- Consumes: `SharedPlacementLockRequest` from Task 2.
- Produces: `loadSharedPlacement(client, query)` and `lockSharedPlacement(client, request)`.

- [ ] **Step 1: Write failing repository and Edge boundary tests**

Assert that the repository sends exact RPC argument names, parses the returned transform, invokes `lock-paper-doll-placement`, and rejects malformed output. Assert that the Edge source requires bearer authentication, performs RLS-backed organization reads, calls the service-only transaction, and never writes release or Sanity records.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --import tsx --test src/lib/paperDoll/placementRepository.test.ts supabase/functions/lock-paper-doll-placement/index.test.ts
```

Expected: FAIL because the repository and Edge Function do not exist.

- [ ] **Step 3: Implement the repository**

Export:

```ts
export interface SharedPlacementRecord {
  id: string;
  familyKey: "CYL-9ML";
  fitmentGeometryKey: "fitment__roller-ball__17-415__v1";
  authorityMaskSha256: string;
  transform: { translateXPx: number; translateYPx: number; uniformScale: number };
  compatibleBodyComponentVersionIds: string[];
  approverDisplayName: string;
  approvedAt: string;
}

export async function loadSharedPlacement(
  client: RpcClient,
  input: { organizationId: string; familyKey: string; fitmentGeometryKey: string; authorityMaskSha256: string },
): Promise<SharedPlacementRecord | null>;

export async function lockSharedPlacement(
  client: FunctionClient,
  request: SharedPlacementLockRequest,
): Promise<SharedPlacementRecord>;
```

- [ ] **Step 4: Implement the Edge Function**

Follow `approve-paper-doll-candidate/index.ts`: authenticate the bearer token; parse the shared contract; use the user client to verify organization visibility of the approved calibration component and all five bodies; verify mask SHA and approval status; call the service-only transaction with `user.id`; return its exact record. Use CORS and fail with `401`, `403`, `409`, or `503` rather than masking state mismatches.

- [ ] **Step 5: Run focused tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add supabase/functions/lock-paper-doll-placement src/lib/paperDoll/placementRepository.ts src/lib/paperDoll/placementRepository.test.ts
git commit -m "feat(paper-doll): add shared placement lock boundary"
```

---

### Task 4: Gate Family Fit Behind Pixel Approval

**Files:**
- Create: `src/components/paper-doll/workbenchStageModel.ts`
- Create: `src/components/paper-doll/workbenchStageModel.test.ts`
- Modify: `src/components/paper-doll/CandidateActionPanel.tsx`
- Modify: `src/components/paper-doll/ProductionCandidateWorkbench.tsx`
- Modify: `src/components/paper-doll/CandidateInspector.tsx`

**Interfaces:**
- Consumes: approved candidate details from Task 1 and an optional shared placement from Task 3.
- Produces: explicit `approve-pixels`, `family-fit`, `placement-locked`, and `current-release` UI state.

- [ ] **Step 1: Write failing stage-model tests**

Test:

```ts
assert.equal(resolveWorkbenchStage({ approved: null, placement: null }), "approve-pixels");
assert.equal(resolveWorkbenchStage({ approved, placement: null }), "family-fit");
assert.equal(resolveWorkbenchStage({ approved, placement }), "placement-locked");
assert.equal(canEnterFamilyFit({ approved: null }), false);
assert.equal(canEnterFamilyFit({ approved }), true);
```

Also assert that an approved component whose mask SHA differs from the placement returns `family-fit`, never `placement-locked`.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --import tsx --test src/components/paper-doll/workbenchStageModel.test.ts src/components/paper-doll/candidatePreviewModel.test.ts
```

Expected: FAIL because the stage model does not exist.

- [ ] **Step 3: Implement the pure stage model**

Export `resolveWorkbenchStage`, `canEnterFamilyFit`, and `placementMatchesApprovedGeometry`. Compare exact family key, geometry key, authority-mask SHA, and canvas dimensions.

- [ ] **Step 4: Update approval feedback and history**

After `approveCandidate` succeeds, invalidate both candidate-history and shared-placement queries. Display `Pixels approved` with the approved child ID and SHA. Keep candidate pixels visible while the approved child URL refreshes atomically.

- [ ] **Step 5: Gate Family Fit**

Disable Family Fit until `approvedCandidateDetails` exists. When enabled, mount the approved child, not the candidate or revoked release ancestor. Plastic and metal variant selectors may each show approved/unapproved status; only approved variants are selectable in Family Fit.

- [ ] **Step 6: Run focused tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/components/paper-doll/workbenchStageModel.ts src/components/paper-doll/workbenchStageModel.test.ts src/components/paper-doll/CandidateActionPanel.tsx src/components/paper-doll/ProductionCandidateWorkbench.tsx src/components/paper-doll/CandidateInspector.tsx
git commit -m "feat(paper-doll): gate family fit on pixel approval"
```

---

### Task 5: Lock and Reload One Placement Across Five Plates

**Files:**
- Create: `src/components/paper-doll/SharedPlacementPanel.tsx`
- Create: `src/components/paper-doll/SharedPlacementPanel.test.tsx`
- Modify: `src/components/paper-doll/ProductionCandidateWorkbench.tsx`
- Modify: `src/components/paper-doll/familyPlacementModel.ts`
- Modify: `src/components/paper-doll/familyPlacementModel.test.ts`
- Modify: `src/components/paper-doll/RollonLineup.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: approved component, five body IDs, draft `FamilyPlacementTransform`, and `lockSharedPlacement`.
- Produces: persisted placement reload, confirmation UI, dirty-state protection, and `5/5 synchronized` evidence.

- [ ] **Step 1: Write failing model and panel tests**

Assert:

```ts
assert.deepEqual(toPlacementLockTransform({ scaleX: 0.974, scaleY: 0.974, translateXPx: 27.066, translateYPx: -134.132 }), {
  translateXPx: 27.066,
  translateYPx: -134.132,
  uniformScale: 0.974,
});
assert.throws(() => toPlacementLockTransform({ ...transform, scaleY: 0.975 }), /uniform/i);
```

Render the panel and assert that `Lock Shared Placement` is disabled until all five explicit body IDs are present and the approved mask matches. Assert the confirmation lists five plate variants, both inheriting material variants, transform values, and approver name.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --import tsx --test src/components/paper-doll/familyPlacementModel.test.ts src/components/paper-doll/SharedPlacementPanel.test.tsx
```

Expected: FAIL because transform serialization and the lock panel do not exist.

- [ ] **Step 3: Implement transform serialization and dirty-state comparison**

Add `toPlacementLockTransform`, `fromSharedPlacementRecord`, and `placementTransformsEqual`. Preserve three-decimal release-pixel precision and reject non-uniform scale.

- [ ] **Step 4: Implement SharedPlacementPanel**

Show draft/locked status, exact transform, geometry fingerprint, five plate names, inherited approved variants, and approver input. Require an approval note. On confirmation, call `lockSharedPlacement`; invalidate the placement query; show the returned immutable placement ID; never change release state.

- [ ] **Step 5: Load and apply persisted placement**

In `ProductionCandidateWorkbench`, query by exact approved mask SHA. Initialize Family Fit from the locked placement when present; otherwise use measured calibration. Do not reset a loaded lock merely by switching body or material variant. If the operator changes a locked transform, mark it `Draft changes` and require a new lock version.

- [ ] **Step 6: Keep the lineup authoritative**

Render one transform across all five explicit compatible plates. Remove any per-body adjustment affordance. Display the same placement ID on each lineup cell when locked.

- [ ] **Step 7: Add focused tests to the production suite and run them**

Update `test:paper-doll-production`, then run:

```bash
npm run test:paper-doll-production
```

Expected: all tests pass, including five-body cascade, refresh reload, mask mismatch invalidation, and non-uniform rejection.

- [ ] **Step 8: Commit Task 5**

```bash
git add package.json src/components/paper-doll/SharedPlacementPanel.tsx src/components/paper-doll/SharedPlacementPanel.test.tsx src/components/paper-doll/ProductionCandidateWorkbench.tsx src/components/paper-doll/familyPlacementModel.ts src/components/paper-doll/familyPlacementModel.test.ts src/components/paper-doll/RollonLineup.tsx
git commit -m "feat(paper-doll): lock shared CYL-9ML placement"
```

---

### Task 6: Rename the Read-Only Mode to Current Release and Verify

**Files:**
- Modify: `src/components/paper-doll/ProductionCandidateWorkbench.tsx`
- Modify: `src/components/paper-doll/assemblyEditModel.test.ts`
- Modify: `src/pages/bestBottlesStudioPreview.test.ts`
- Modify: `docs/paper-doll-rig/CLOSURE-REBIRTH-RESEARCH-HANDOFF.md`

**Interfaces:**
- Consumes: existing internal `release-lock` mode.
- Produces: user-facing `Current Release` label and end-to-end evidence without changing internal route/state identifiers.

- [ ] **Step 1: Write failing copy and immutability tests**

Assert rendered workbench copy contains `Current Release` and does not present `Release Lock` as a user-facing action. Preserve tests proving `release-lock` rejects transforms, painting, candidate writes, and placement writes.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --import tsx --test src/components/paper-doll/assemblyEditModel.test.ts src/pages/bestBottlesStudioPreview.test.ts
```

Expected: FAIL on the old user-facing label.

- [ ] **Step 3: Rename user-facing copy only**

Keep the internal discriminant `release-lock` and render `Current Release`. Add explanatory copy: `Read-only active ledger snapshot. Approved pixels and placement drafts are not released until a separate release cut.`

- [ ] **Step 4: Update the handoff**

Record the new lifecycle, placement ledger identifiers, exact non-mutation boundary, tests, and the remaining separate milestones: generic new-fitment intake, release cut, and Sanity dry-run/publication.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run test:paper-doll-production
npx tsc --noEmit
npx eslint src/components/paper-doll src/lib/paperDoll supabase/functions/lock-paper-doll-placement
npm run build
git diff --check
```

Expected: all commands exit `0`; only existing non-blocking bundle-size or malformed escaped-selector warnings may remain.

- [ ] **Step 6: Verify in the browser**

At the CYL-9ML roll-on workbench:

1. confirm unapproved rollers cannot enter Family Fit;
2. approve plastic pixels with named evidence;
3. enter Family Fit and adjust one transform;
4. inspect Amber, Cobalt, Clear, Frosted, and Swirl with the same values;
5. lock shared placement and refresh;
6. confirm the placement ID and transform reload;
7. approve/select metal and confirm it inherits the same placement when mask SHA matches;
8. open Current Release and confirm it remains read-only and unchanged;
9. confirm no Sanity publication control is active in this milestone.

- [ ] **Step 7: Commit Task 6**

```bash
git add src/components/paper-doll/ProductionCandidateWorkbench.tsx src/components/paper-doll/assemblyEditModel.test.ts src/pages/bestBottlesStudioPreview.test.ts docs/paper-doll-rig/CLOSURE-REBIRTH-RESEARCH-HANDOFF.md
git commit -m "feat(paper-doll): finalize shared placement workflow"
```

---

## Completion Boundary

This plan is complete when approved plastic and metal rollers share one persisted CYL-9ML placement across all five locked plates and the active release is shown read-only as Current Release.

The following require their own implementation plans after this milestone passes:

1. reusable proposed-geometry intake and compatibility mapping for vintage bulbs, tassels, pumps, sprayers, and other new fitment shapes;
2. release-candidate assembly and explicit release cut including placement membership;
3. Sanity dry-run diff, named publication approval, publish transaction, and append-only publication events.
