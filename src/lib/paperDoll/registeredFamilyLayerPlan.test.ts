import assert from "node:assert/strict";
import test from "node:test";

import { buildRegisteredFamilyLayerPlan } from "./registeredFamilyLayerPlan";

test("maps an oversized source assembly into one reviewed catalog height zone", () => {
  const plan = buildRegisteredFamilyLayerPlan({
    familyKey: "CYL-100ML-18-415-SPRAY",
    canvas: { width: 2080, height: 2288 },
    targetCenterX: 1040,
    targetBaselineY: 2082,
    targetAssembledHeightPct: 79,
    layers: [
      { layerId: "body", role: "body", sourceBoundsPx: { left: 612, top: 293, width: 513, height: 2366 }, assemblyMember: true },
      { layerId: "tube", role: "body-contextual", sourceBoundsPx: { left: 689, top: 603, width: 232, height: 1960 }, assemblyMember: true },
      { layerId: "head", role: "exterior-component", sourceBoundsPx: { left: 715, top: 68, width: 306, height: 536 }, assemblyMember: true },
      { layerId: "overcap", role: "detached-review", sourceBoundsPx: { left: 1291, top: 2069, width: 336, height: 587 }, assemblyMember: false },
    ],
  });

  assert.deepEqual(plan.sourceAssemblyBoundsPx, { left: 612, top: 68, width: 513, height: 2591 });
  assert.equal(plan.targetAssemblyBoundsPx.height, 1808);
  assert.equal(plan.targetAssemblyBoundsPx.top + plan.targetAssemblyBoundsPx.height - 1, 2082);
  assert.equal(plan.targetAssemblyBoundsPx.left + Math.round(plan.targetAssemblyBoundsPx.width / 2), 1040);
  assert.ok(Math.abs(plan.uniformScale - 1808 / 2591) < 1e-10);
});

test("applies one transform to every registered assembly layer and leaves detached reviews unplaced", () => {
  const plan = buildRegisteredFamilyLayerPlan({
    familyKey: "CYL-28ML-16MM-ROLLON",
    canvas: { width: 2080, height: 2288 },
    targetCenterX: 1040,
    targetBaselineY: 2082,
    targetAssembledHeightPct: 74,
    layers: [
      { layerId: "body", role: "body", sourceBoundsPx: { left: 199, top: 251, width: 445, height: 1577 }, assemblyMember: true },
      { layerId: "roller", role: "exterior-component", sourceBoundsPx: { left: 221, top: 466, width: 339, height: 576 }, assemblyMember: true },
      { layerId: "overcap", role: "detached-review", sourceBoundsPx: { left: 773, top: 1313, width: 496, height: 515 }, assemblyMember: false },
    ],
  });

  const body = plan.layers.find((layer) => layer.layerId === "body")!;
  const roller = plan.layers.find((layer) => layer.layerId === "roller")!;
  const overcap = plan.layers.find((layer) => layer.layerId === "overcap")!;
  assert.equal(body.uniformScale, plan.uniformScale);
  assert.equal(roller.uniformScale, plan.uniformScale);
  assert.equal(overcap.uniformScale, null);
  assert.equal(overcap.placementBoundsPx, null);

  const sourceDeltaX = 221 - 199;
  const sourceDeltaY = 466 - 251;
  assert.ok(Math.abs((roller.placementBoundsPx!.left - body.placementBoundsPx!.left) - sourceDeltaX * plan.uniformScale) <= 1);
  assert.ok(Math.abs((roller.placementBoundsPx!.top - body.placementBoundsPx!.top) - sourceDeltaY * plan.uniformScale) <= 1);
});

test("rejects a family without one body and one exterior assembly component", () => {
  assert.throws(() => buildRegisteredFamilyLayerPlan({
    familyKey: "broken",
    canvas: { width: 2080, height: 2288 },
    targetCenterX: 1040,
    targetBaselineY: 2082,
    targetAssembledHeightPct: 79,
    layers: [
      { layerId: "body", role: "body", sourceBoundsPx: { left: 10, top: 10, width: 100, height: 400 }, assemblyMember: true },
    ],
  }), /exterior component/i);
});

test("allows an explicit body-only review without pretending it is a complete assembly", () => {
  const plan = buildRegisteredFamilyLayerPlan({
    familyKey: "CYL-9ML-17-415-ROLLON-74X21",
    canvas: { width: 2080, height: 2288 },
    targetCenterX: 1040,
    targetBaselineY: 2082,
    targetAssembledHeightPct: 69,
    reviewScope: "body-only",
    layers: [
      { layerId: "body", role: "body", sourceBoundsPx: { left: 249, top: 618, width: 250, height: 903 }, assemblyMember: true },
      { layerId: "contaminated-roller", role: "detached-review", sourceBoundsPx: { left: 255, top: 457, width: 228, height: 324 }, assemblyMember: false },
    ],
  });

  assert.equal(plan.reviewScope, "body-only");
  assert.equal(plan.layers[0].placementBoundsPx?.height, plan.targetAssemblyBoundsPx.height);
  assert.equal(plan.layers[1].placementBoundsPx, null);
});
