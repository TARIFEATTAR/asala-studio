import assert from "node:assert/strict";
import test from "node:test";

import {
  planDispenser17415Review,
  resolveDispenser17415ApprovalState,
} from "./build-dispenser-17-415-authority-review";

const asset = (sourceId: string) => ({
  partId: sourceId.startsWith("psd-pump") ? "pump-head-and-collar" : "sprayer-head-and-collar",
  sourceId,
  cutoutPath: `/review/${sourceId}.png`,
  cutoutSha256: "a".repeat(64),
  originalFilename: `${sourceId}.psd`,
  sourceSha256: "b".repeat(64),
});

test("preserves six sprayer and three pump identities behind one exterior authority candidate", () => {
  const plan = planDispenser17415Review({
    sprayerAssets: [
      "psd-sprayer-shiny-gold",
      "psd-sprayer-matte-silver",
      "psd-sprayer-black",
      "psd-sprayer-shiny-silver",
      "psd-sprayer-red",
      "psd-sprayer-turquoise",
    ].map(asset),
    pumpAssets: [
      "psd-pump-matte-silver",
      "psd-pump-shiny-gold",
      "psd-pump-black",
    ].map(asset),
  });

  assert.equal(plan.authoritySourceId, "psd-sprayer-shiny-gold");
  assert.equal(plan.lanes.sprayer.length, 6);
  assert.equal(plan.lanes.pump.length, 3);
  assert.deepEqual(plan.lanes.sprayer.map((entry) => entry.variantKey), [
    "GLD", "MSLV", "BLK", "SSLV", "RED", "TUR",
  ]);
  assert.deepEqual(plan.lanes.pump.map((entry) => entry.variantKey), ["MSLV", "GLD", "BLK"]);
});

test("refuses to infer a missing 17-415 finish", () => {
  assert.throws(
    () => planDispenser17415Review({
      sprayerAssets: [
        "psd-sprayer-shiny-gold",
        "psd-sprayer-matte-silver",
        "psd-sprayer-black",
        "psd-sprayer-shiny-silver",
        "psd-sprayer-red",
      ].map(asset),
      pumpAssets: [
        "psd-pump-matte-silver",
        "psd-pump-shiny-gold",
        "psd-pump-black",
      ].map(asset),
    }),
    /Exact 17-415 sprayer source set is required/,
  );
});

test("earns geometry lock only from exact authority alpha plus named family-fit approval", () => {
  assert.deepEqual(resolveDispenser17415ApprovalState({
    allCandidateAlphaMatchesAuthority: true,
    namedFamilyFitApproval: true,
  }), {
    geometryLocked: true,
    completeAssemblyProductionEligible: false,
    namedFamilyFitApprovalRequired: false,
  });

  assert.equal(resolveDispenser17415ApprovalState({
    allCandidateAlphaMatchesAuthority: false,
    namedFamilyFitApproval: true,
  }).geometryLocked, false);
  assert.equal(resolveDispenser17415ApprovalState({
    allCandidateAlphaMatchesAuthority: true,
    namedFamilyFitApproval: false,
  }).geometryLocked, false);
});
