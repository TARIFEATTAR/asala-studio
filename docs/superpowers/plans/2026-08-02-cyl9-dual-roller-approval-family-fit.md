# CYL-9ML Dual-Roller Approval and Family Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two existing approved CYL-9ML roller variants visibly approved, move either variant directly into Family Fit, and preview its exact approved pixels plus one shared placement across all five locked body plates without requiring an overcap.

**Architecture:** Candidate history remains the immutable source of pixel approval. Pure review-policy and lineup-model functions determine UI state, while `ProductionCandidateWorkbench` owns stage changes and the single family placement transform. Roller Family Fit evaluates body plus roller only; complete-SKU cap requirements remain in the release-readiness layer.

**Tech Stack:** React 18, TypeScript 5.8, TanStack Query 5, Node test runner with `tsx`, Supabase signed private assets.

## Global Constraints

- Preserve the five existing locked body component versions and their pixels.
- Plastic and Metal remain separate immutable approved component versions sharing authority-mask SHA `b815bcd76f39e5a54e7ff68a660c826755dd670dc7464a7d38f87103f87e70c6`.
- Both variants use the natural-plastic housing; only the Metal roller sphere is mirror chrome.
- Geometry is called locked only when the exact authority-mask identity passes and the shared placement is approved.
- Family Fit permits X/Y translation and uniform scale only.
- Canonical canvas remains `2080x2288` with Bone `#F5F3EF`.
- This milestone performs no release cut, Sanity write, or public publication.
- Authority-mask visualization must not change any displayed product pixel, brightness, color, or translucency.
- Do not stage or rewrite unrelated user changes.

---

### Task 1: Make authority-mask inspection non-photometric

**Files:**
- Modify: `src/components/paper-doll/assemblyEditModel.ts`
- Modify: `src/components/paper-doll/assemblyEditModel.test.ts`
- Modify: `src/components/paper-doll/AssemblyEditCanvas.tsx`
- Modify: `src/pages/bestBottlesStudioPreview.test.ts`

**Interfaces:**
- Consumes: selected asset alpha bounds, current component transform, canvas display size.
- Produces: `transformedBoundsToDisplay(bounds, transform, display): { left; top; width; height }`; a transparent `authority-mask-bounds` Fabric rectangle.

- [ ] **Step 1: Write failing geometry and source assertions**

Add a numeric test showing that transformed release bounds map to the expected display rectangle. Add source assertions that the canvas contains an `authority-mask-bounds` object and never loads `selected.geometryMaskUrl` as a visible Fabric image.

```ts
assert.deepEqual(transformedBoundsToDisplay(
  { left: 900, top: 600, right: 1180, bottom: 900 },
  { translateXPx: 20, translateYPx: -10, scaleX: 0.9, scaleY: 0.9 },
  { width: 1040, height: 1144 },
), { left: 415, top: 265, width: 126, height: 135 });
```

- [ ] **Step 2: Run the focused tests and confirm red**

Run: `node --import tsx --test src/components/paper-doll/assemblyEditModel.test.ts src/pages/bestBottlesStudioPreview.test.ts`

Expected: FAIL because the transform helper and non-photometric bounds object do not exist.

- [ ] **Step 3: Implement the release-to-display bounds helper**

Transform each release-space edge with X/Y translation and scale, then map the resulting start and end points through `releaseToDisplay`. Return positive `left`, `top`, `width`, and `height` values.

- [ ] **Step 4: Replace the filled mask image with a transparent outline**

Remove the `fabric.Image.fromURL(selected.geometryMaskUrl, ...)` render path and its `opacity: 0.2` product overlay. When mask visibility is enabled, add only:

```ts
new fabric.Rect({
  ...transformedBoundsToDisplay(selected.alphaBounds, selectedTransform, display),
  fill: "rgba(0,0,0,0)",
  stroke: MASK_COLOR,
  strokeWidth: 1,
  strokeDashArray: [3, 3],
  selectable: false,
  evented: false,
  name: "authority-mask-bounds",
});
```

Update the rectangle geometry when the placement transform changes. Keep exact authority-mask SHA validation unchanged.

- [ ] **Step 5: Run focused tests and confirm green**

Run: `node --import tsx --test src/components/paper-doll/assemblyEditModel.test.ts src/pages/bestBottlesStudioPreview.test.ts`

Expected: all tests PASS and no visible mask image remains in the assembly canvas.

### Task 2: Represent clean-candidate and already-approved states honestly

**Files:**
- Modify: `src/lib/paperDoll/candidateReviewPolicy.ts`
- Modify: `src/lib/paperDoll/candidateReviewPolicy.test.ts`
- Modify: `src/components/paper-doll/CandidateActionPanel.tsx`
- Modify: `src/pages/bestBottlesStudioPreview.test.ts`

**Interfaces:**
- Consumes: `authorityMaskBlocker`, `approvedCandidateDetails`, selected candidate history.
- Produces: `resolveAncestorNotice(input): CandidateAncestorNotice | null`; `CandidateActionPanel.onOpenFamilyFit?: () => void`.

- [ ] **Step 1: Write the failing review-policy test**

```ts
test("a clean selected candidate downgrades a revoked ancestor to an audit notice", () => {
  assert.deepEqual(reviewPolicy.resolveAncestorNotice({
    parentMaskBlocker: "revoked ancestor",
    candidateMaskBlocker: null,
    hasCandidate: true,
  }), {
    tone: "warning",
    message: "Old release ancestor is audit-only. Clean geometry authority active.",
  });
  assert.deepEqual(reviewPolicy.resolveAncestorNotice({
    parentMaskBlocker: "revoked ancestor",
    candidateMaskBlocker: "revoked candidate",
    hasCandidate: true,
  }), { tone: "error", message: "revoked ancestor" });
});
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `node --import tsx --test src/lib/paperDoll/candidateReviewPolicy.test.ts`

Expected: FAIL because `resolveAncestorNotice` is not exported.

- [ ] **Step 3: Add the minimal review-state function**

```ts
export interface CandidateAncestorNotice {
  tone: "warning" | "error";
  message: string;
}

export function resolveAncestorNotice(input: {
  parentMaskBlocker: string | null;
  candidateMaskBlocker: string | null;
  hasCandidate: boolean;
}): CandidateAncestorNotice | null {
  if (!input.parentMaskBlocker) return null;
  if (input.hasCandidate && !input.candidateMaskBlocker) {
    return {
      tone: "warning",
      message: "Old release ancestor is audit-only. Clean geometry authority active.",
    };
  }
  return { tone: "error", message: input.parentMaskBlocker };
}
```

- [ ] **Step 4: Make approval and continuation explicit in Edit Lab**

Add `onOpenFamilyFit?: () => void` to `CandidateActionPanelProps`. Resolve one ancestor notice from the selected candidate. Render an amber notice for `warning` and the existing red blocker only for `error`.

Replace the ambiguous disabled approval action with this mutually exclusive state:

```tsx
{approved ? (
  <button type="button" onClick={onOpenFamilyFit} className="...">
    <ShieldCheck className="h-3.5 w-3.5" />Pixels Approved · Open Family Fit
  </button>
) : (
  <button type="button" disabled={!canApprove || busy} onClick={() => void decide("approved")} className="...">
    <ShieldCheck className="h-3.5 w-3.5" />Approve Pixels
  </button>
)}
```

Keep the immutable approval ID and SHA evidence visible below the action.

- [ ] **Step 5: Add a source-level UI regression assertion**

Extend `bestBottlesStudioPreview.test.ts` to assert that `CandidateActionPanel.tsx` contains `Pixels Approved · Open Family Fit`, `Old release ancestor is audit-only`, and no clean-candidate branch that renders the revoked ancestor as a red error.

- [ ] **Step 6: Run the focused tests and confirm green**

Run: `node --import tsx --test src/lib/paperDoll/candidateReviewPolicy.test.ts src/pages/bestBottlesStudioPreview.test.ts`

Expected: all tests PASS.

### Task 3: Make the five-body lineup a roller-fit validator

**Files:**
- Modify: `src/components/paper-doll/rollonLineupModel.ts`
- Modify: `src/components/paper-doll/rollonLineupModel.test.ts`
- Modify: `src/components/paper-doll/RollonLineup.tsx`

**Interfaces:**
- Consumes: five locked body assets, selected roller variant, exact candidate image override, `FamilyPlacementTransform`.
- Produces: `buildRollonLineup(assets, { rollerVariantKey, rollerImageUrlOverride, overcapVariantKey? })`; `RollonLineup` with an optional `overcapVariantKey`.

- [ ] **Step 1: Write the failing roller-only coverage test**

```ts
test("roller Family Fit reaches five of five without requiring an overcap", () => {
  const assets = [
    ...["CLR", "AMB", "BLU", "FRS", "SWL"].map((variant) => asset("body", variant)),
    asset("roller", "PLASTIC"),
  ];
  const lineup = buildRollonLineup(assets, { rollerVariantKey: "PLASTIC" });
  assert.ok(lineup.every((item) => item.status === "complete"));
  assert.ok(lineup.every((item) => item.layers.overcap === null));
  assert.ok(lineup.every((item) => item.issues.length === 0));
});
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `node --import tsx --test src/components/paper-doll/rollonLineupModel.test.ts`

Expected: TypeScript/runtime failure because `overcapVariantKey` is currently required.

- [ ] **Step 3: Make overcap validation opt-in**

Change the selection contract to:

```ts
selection: {
  rollerVariantKey: string;
  rollerImageUrlOverride?: string;
  overcapVariantKey?: string | null;
}
```

Resolve an overcap only when `overcapVariantKey` is present, and append a missing-overcap issue only in that case. Preserve exact no-fallback behavior whenever an overcap is explicitly requested.

- [ ] **Step 4: Update lineup presentation**

Default `RollonLineup.overcapVariantKey` to `null`. Display `PLASTIC roller fit` or `METAL roller fit` when no overcap is requested; retain `ROLLER + OVERCAP` only for complete-assembly calls.

- [ ] **Step 5: Run lineup tests and confirm green**

Run: `node --import tsx --test src/components/paper-doll/rollonLineupModel.test.ts`

Expected: all existing exact-component tests and the new roller-only test PASS.

### Task 4: Route approved variants directly into the shared Family Fit canvas

**Files:**
- Modify: `src/components/paper-doll/ProductionCandidateWorkbench.tsx`
- Modify: `src/pages/bestBottlesStudioPreview.test.ts`

**Interfaces:**
- Consumes: selected `ApprovedCandidateDetails`, `enterMode("family-fit")`, `familyTransform`, `placementQuery.data`.
- Produces: one visible path from approved variant to five-body Family Fit using the exact approved image URL and the same placement transform as the Amber canvas.

- [ ] **Step 1: Write the failing workbench wiring assertions**

Add assertions that `ProductionCandidateWorkbench.tsx`:

```ts
assert.match(source, /onOpenFamilyFit=\{\(\) => enterMode\("family-fit"\)\}/);
assert.match(source, /overcapVariantKey=\{null\}/);
assert.match(source, /placementTransform=\{mode === "family-fit" \? familyTransform/);
assert.match(source, /approvedCandidate\.imageUrl/);
```

- [ ] **Step 2: Run the focused UI test and confirm red**

Run: `node --import tsx --test src/pages/bestBottlesStudioPreview.test.ts`

Expected: FAIL on the missing continuation callback and explicit roller-only lineup scope.

- [ ] **Step 3: Wire the stage transition and exact preview identities**

Pass `onOpenFamilyFit={() => enterMode("family-fit")}` into `CandidateActionPanel`. Pass `overcapVariantKey={null}` into `RollonLineup`. In Family Fit, continue to pass `approvedCandidate.imageUrl` as the roller override and `familyTransform` as the lineup transform. Outside Family Fit, do not claim the five previews inherit a locked placement.

- [ ] **Step 4: Run the focused UI test and confirm green**

Run: `node --import tsx --test src/pages/bestBottlesStudioPreview.test.ts`

Expected: all assertions PASS.

### Task 5: Verify the complete UI milestone

**Files:**
- Verify only; do not change production files unless a failing test identifies a root cause.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: verified CYL-9ML dual-roller approval and Family Fit milestone.

- [ ] **Step 1: Run the full paper-doll production suite**

Run: `npm run test:paper-doll-production`

Expected: all tests PASS.

- [ ] **Step 2: Run TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Build the application**

Run: `npm run build`

Expected: Vite build succeeds.

- [ ] **Step 4: Perform browser acceptance on localhost**

Verify both `Natural Plastic` and `Metal Ball` show `Pixels Approved`; each can open Family Fit; the selected roller remains mounted on Amber; all five lineup cards show the same roller and transform; the lineup reports `5/5 complete`; and the page performs no release or Sanity write.

- [ ] **Step 5: Review the diff and commit the milestone**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Stage only the plan and the paper-doll files changed by this milestone, then commit with:

```bash
git commit -m "fix(paper-doll): connect approved rollers to family fit"
```
