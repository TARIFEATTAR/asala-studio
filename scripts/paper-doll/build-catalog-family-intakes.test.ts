import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCatalogFamilyIntakeIndex } from "./build-catalog-family-intakes";

test("catalog family intakes cover every exactly mapped identity without production writes", async () => {
  const index = await buildCatalogFamilyIntakeIndex();
  assert.equal(index.summary.cohortCount, 97);
  assert.equal(index.summary.catalogIdentityCount, 2087);
  assert.equal(index.summary.unresolvedIdentityCount, 44);
  assert.equal(new Set(index.cohorts.flatMap((cohort) => cohort.catalogIdentities.map((identity) => identity.websiteSku))).size, 2087);
  assert.ok(index.cohorts.every((cohort) => cohort.componentRequirements.every((requirement) => requirement.compatibilityStatus === "unverified")));
  assert.ok(index.cohorts.every((cohort) => cohort.componentRequirements.every((requirement) => requirement.sourceIdentity === null)));
  assert.deepEqual(index.mutationPolicy, { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false });
});

test("CYL-5ML intake removes integrated spray caps and cap-color roller duplication", async () => {
  const index = await buildCatalogFamilyIntakeIndex();
  const intake = index.cohorts.find((cohort) => cohort.familyKey === "CYL-5ML-13-415");
  assert.ok(intake);
  assert.equal(intake.catalogIdentities.length, 54);
  assert.equal(intake.componentRequirements.length, 23);
  assert.equal(intake.componentRequirements.filter((requirement) => requirement.slot === "cap").length, 13);
  assert.equal(intake.componentRequirements.filter((requirement) => requirement.slot === "roller").length, 2);
  assert.equal(intake.componentRequirements.filter((requirement) => requirement.slot === "sprayer").length, 8);
  assert.ok(intake.componentRequirements.filter((requirement) => requirement.slot === "cap").every((requirement) => requirement.descriptor.capStyle !== "Spray"));
  assert.ok(intake.componentRequirements.filter((requirement) => requirement.slot === "roller").every((requirement) => !("capColor" in requirement.descriptor)));
});
