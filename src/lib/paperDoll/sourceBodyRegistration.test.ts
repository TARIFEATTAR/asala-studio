import assert from "node:assert/strict";
import test from "node:test";

import { buildSourceBodyRegistrationPlan } from "./sourceBodyRegistration";
import { buildSprayer13TubeRegistrationPlan } from "../../../scripts/paper-doll/build-sprayer-13-415-tube-registration-plan";

const source = (sourceId: string, bodyLeft: number, bodyTop: number) => ({
  sourceId,
  sourceSha256: "a".repeat(64),
  bodyBoundsPx: { left: bodyLeft, top: bodyTop, width: 218, height: 636 },
  contextualPartBoundsPx: { left: bodyLeft + 89, top: bodyTop + 105, width: 60, height: 463 },
});

test("preserves one source-body registration across translated Photoshop assemblies", () => {
  const plan = buildSourceBodyRegistrationPlan({
    familyId: "CYL-5ML-13-415",
    componentPartId: "sprayer-dip-tube",
    sources: [source("source-one", 82, 273), source("source-two", 59, 237)],
    targetBodyAuthorityState: "named-geometry-review-required",
  });

  assert.equal(plan.sharedRegistrationConfirmed, true);
  assert.deepEqual(plan.normalizedRegistration, {
    leftWithinBody: 0.408257,
    topWithinBody: 0.165094,
    widthOfBody: 0.275229,
    heightOfBody: 0.727987,
  });
  assert.equal(plan.outputPolicy, "body-contextual-weld");
  assert.equal(plan.productionPlateEligible, false);
  assert.equal(plan.targetJobsWritten, false);
  assert.match(plan.blocker, /body authority/i);
});

test("rejects a translated source whose component registration drifts", () => {
  const drifted = source("source-two", 59, 237);
  drifted.contextualPartBoundsPx.left += 2;

  assert.throws(() => buildSourceBodyRegistrationPlan({
    familyId: "CYL-5ML-13-415",
    componentPartId: "sprayer-dip-tube",
    sources: [source("source-one", 82, 273), drifted],
    targetBodyAuthorityState: "named-geometry-review-required",
  }), /registration drift/i);
});

test("builds the seven-source 13-415 tube registration plan without writing target jobs", async () => {
  const plan = await buildSprayer13TubeRegistrationPlan();

  assert.equal(plan.sourceCount, 7);
  assert.equal(plan.sharedRegistrationConfirmed, true);
  assert.equal(plan.targetJobsWritten, false);
  assert.equal(plan.productionPlateEligible, false);
  assert.deepEqual(plan.normalizedRegistration, {
    leftWithinBody: 0.408257,
    topWithinBody: 0.165094,
    widthOfBody: 0.275229,
    heightOfBody: 0.727987,
  });
});
