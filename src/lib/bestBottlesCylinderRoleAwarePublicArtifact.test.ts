import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  buildCylinderCanonicalRosterAuthority,
  buildCylinderRoleAwareReadinessIndex,
  type CylinderRoleAwareReadinessArtifact,
} from "./bestBottlesCylinderRoleAuthority";

const PRODUCTION_READINESS_PATH = resolve(
  process.cwd(),
  "public/data/best-bottles-cylinder-production-readiness.json",
);
const ROLE_ARTIFACT_PATH = resolve(
  process.cwd(),
  "public/data/best-bottles-cylinder-sidecar-promotion.json",
);

function loadPublicArtifacts(): {
  productionReadinessBytes: Uint8Array;
  roleArtifact: CylinderRoleAwareReadinessArtifact;
} {
  const productionReadinessBytes = readFileSync(PRODUCTION_READINESS_PATH);
  const roleArtifact = JSON.parse(
    readFileSync(ROLE_ARTIFACT_PATH, "utf8"),
  ) as CylinderRoleAwareReadinessArtifact;
  return { productionReadinessBytes, roleArtifact };
}

describe("Best Bottles Cylinder public role artifact", () => {
  it("validates the actual public production roster and role artifact, including the approved 3 mL lanes", () => {
    const { productionReadinessBytes, roleArtifact } = loadPublicArtifacts();
    const canonicalRoster = buildCylinderCanonicalRosterAuthority(
      roleArtifact,
      productionReadinessBytes,
    );
    const index = buildCylinderRoleAwareReadinessIndex(
      roleArtifact,
      canonicalRoster,
    );
    const row = index.get("GBSPRY3MLCLBLK|GBSPRCLR3MLBLK");

    assert.ok(row);
    assert.equal(
      row.references.identityCapOn.exportSha256,
      "30219a2e8a6034fb4b55bcbcbcd76d8ed0bd0c60f02cc5bd1071a5286759cb3a",
    );
    assert.equal(
      row.references.pdpCapOffSidecar.exportSha256,
      "cb57723673c9389aab618be65980117137b6b77c8146e9b998e7abd325719ef5",
    );
    assert.equal(
      row.references.pdpCapOffSidecar.reviewedOutputSha256,
      row.references.pdpCapOffSidecar.exportSha256,
    );
  });
});
