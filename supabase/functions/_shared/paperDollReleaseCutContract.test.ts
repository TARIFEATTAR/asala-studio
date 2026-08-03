import assert from "node:assert/strict";
import test from "node:test";

import { parseReleaseCutRequest } from "./paperDollReleaseCutContract.ts";

const uuid = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

test("Edge release-cut parser preserves exact IDs and named approval", () => {
  const result = parseReleaseCutRequest({
    organizationId: uuid("1"), familyKey: "CYL-9ML", expectedCurrentReleaseId: uuid("2"),
    releaseVersion: "1.1.0-rollon-pair.1",
    selectedComponents: [{ componentVersionId: uuid("3"), slot: "roller", variantKey: "PLASTIC", placementVersionId: uuid("4") }],
    compatibleBodyComponentVersionIds: [uuid("5"), uuid("6"), uuid("7"), uuid("8"), uuid("9")],
    approverDisplayName: "Jordan Richter", approvalNote: "Approved across five plates.",
    sourceGitCommit: "e63eeaf", rendererVersion: "paper-doll-release-cut-v1",
  });
  assert.equal(result.selectedComponents[0].placementVersionId, uuid("4"));
  assert.equal(result.approverDisplayName, "Jordan Richter");
});

test("Edge release-cut parser rejects duplicate membership", () => {
  const body = uuid("5");
  assert.throws(() => parseReleaseCutRequest({
    organizationId: uuid("1"), familyKey: "CYL-9ML", expectedCurrentReleaseId: uuid("2"), releaseVersion: "1.1.0",
    selectedComponents: [
      { componentVersionId: uuid("3"), slot: "roller", variantKey: "PLASTIC" },
      { componentVersionId: uuid("4"), slot: "roller", variantKey: "PLASTIC" },
    ],
    compatibleBodyComponentVersionIds: [body, body, uuid("7"), uuid("8"), uuid("9")],
    approverDisplayName: "Jordan", approvalNote: "Approved", sourceGitCommit: "e63eeaf", rendererVersion: "v1",
  }), /slot and variant/i);
});
