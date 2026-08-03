import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCyl5FamilyIntake } from "./build-next-family-intake";

test("CYL-5ML intake is complete inventory and performs no candidate or production mutations", async () => {
  const intake = await buildCyl5FamilyIntake();
  assert.equal(intake.familyKey, "CYL-5ML-13-415");
  assert.equal(intake.geometries.length, 3);
  assert.equal(intake.bodyAppearances.length, 4);
  assert.equal(intake.componentRequirements.length, 23);
  assert.deepEqual(
    Object.fromEntries(["cap", "roller", "sprayer"].map((slot) => [slot, intake.componentRequirements.filter((requirement) => requirement.slot === slot).length])),
    { cap: 13, roller: 2, sprayer: 8 },
  );
  assert.ok(intake.catalogIdentities.length > 0);
  assert.ok(intake.componentRequirements.every((requirement) => requirement.compatibilityStatus === "unverified"));
  assert.ok(intake.componentRequirements.every((requirement) => requirement.sourceIdentity === null));
  assert.deepEqual(intake.mutationPolicy, { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false });
});
