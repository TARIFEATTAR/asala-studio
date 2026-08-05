import assert from "node:assert/strict";
import test from "node:test";

const approved = { authorityMaskSha256: "a".repeat(64) };
const placement = { authorityMaskSha256: "a".repeat(64) };

type ResolveWorkbenchStage = (input: {
  approved: typeof approved | null;
  placement: typeof placement | null;
}) => string;

type CanEnterFamilyFit = (input: { approved: typeof approved | null }) => boolean;

test("Family Fit unlocks only after pixel approval", async () => {
  const model = await import("./workbenchStageModel").catch(() => ({}));
  const resolve = (model as { resolveWorkbenchStage?: ResolveWorkbenchStage }).resolveWorkbenchStage;
  const canEnter = (model as { canEnterFamilyFit?: CanEnterFamilyFit }).canEnterFamilyFit;
  assert.ok(resolve && canEnter, "workbench stage model must exist");
  assert.equal(resolve({ approved: null, placement: null }), "approve-pixels");
  assert.equal(resolve({ approved, placement: null }), "family-fit");
  assert.equal(canEnter({ approved: null }), false);
  assert.equal(canEnter({ approved }), true);
});

test("placement lock requires the exact approved mask identity", async () => {
  const model = await import("./workbenchStageModel").catch(() => ({}));
  const resolve = (model as { resolveWorkbenchStage?: ResolveWorkbenchStage }).resolveWorkbenchStage;
  assert.ok(resolve, "resolveWorkbenchStage must exist");
  assert.equal(resolve({ approved, placement }), "placement-locked");
  assert.equal(resolve({ approved, placement: { authorityMaskSha256: "b".repeat(64) } }), "family-fit");
});
