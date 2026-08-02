import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import type { CylinderRoleAwareReadinessArtifact } from "../../src/lib/bestBottlesCylinderRoleAwareReadiness";

const ARTIFACT_URL = new URL(
  "../../public/data/best-bottles-cylinder-sidecar-promotion.json",
  import.meta.url,
);

describe("Cylinder role-aware readiness public artifact", () => {
  it("publishes exact immutable role pointers for the complete canonical Cylinder set", async () => {
    const serialized = await readFile(ARTIFACT_URL, "utf8");
    const artifact = JSON.parse(serialized) as CylinderRoleAwareReadinessArtifact;

    assert.equal(artifact.version, "best-bottles-cylinder-role-aware-readiness-v2");
    assert.equal(artifact.rows.length, 377);
    assert.deepEqual(artifact.summary, {
      canonicalIdentityCount: 377,
      identityCapOnVerifiedCount: 369,
      pdpCapOffSidecarVerifiedCount: 371,
      bothRolesVerifiedCount: 369,
      blockedIdentityCount: 8,
      standardSidecarCount: 334,
      liveSiteExceptionCount: 37,
      approvedEvidenceBlockedCount: 6,
      missingApprovedEvidenceBlockedCount: 2,
      externalWriteCount: 0,
    });
    assert.deepEqual(artifact.authorization, {
      exactEvidenceIdentityCount: 369,
      generationScope: "controlled-studio-only",
      generationStatus: "authorized-for-controlled-generation",
      publishStatus: "not-publish-ready",
      individualContentReviewStatus: "not-individually-content-approved",
      requiredNextGate: "generated-output-qa-and-explicit-publish-approval",
    });

    const identities = new Set<string>();
    let pendingSidecarSourceReviewCount = 0;
    let lowResolutionSidecarCount = 0;
    const sidecarRoutes = new Map<string, number>();
    for (const row of artifact.rows) {
      assert.equal(
        row.canonicalIdentityKey,
        `${row.websiteSku.toUpperCase().replace(/[^A-Z0-9]/g, "")}|${row.graceSku.toUpperCase().replace(/[^A-Z0-9]/g, "")}`,
      );
      assert.equal(identities.has(row.canonicalIdentityKey), false);
      identities.add(row.canonicalIdentityKey);
      assert.equal(row.references.identityCapOn.roleId, "identity-cap-on");
      assert.equal(row.references.pdpCapOffSidecar.roleId, "pdp-cap-off-sidecar");

      if (row.status === "both-roles-verified") {
        const capOn = row.references.identityCapOn;
        const sidecar = row.references.pdpCapOffSidecar;
        for (const role of [capOn, sidecar]) {
          assert.equal(role.status, "verified");
          assert.equal(role.remoteStatus, "verified");
          assert.equal(role.productionStatus, "generation-authorized");
          assert.match(role.publicUrl ?? "", /^https:\/\//);
          assert.match(role.exportSha256 ?? "", /^[a-f0-9]{64}$/);
          assert.ok(role.storagePath?.startsWith("best-bottles/production-references/cylinder/"));
          assert.deepEqual(role.blockers, []);
        }
        assert.notEqual(capOn.publicUrl, sidecar.publicUrl);
        assert.notEqual(capOn.exportSha256, sidecar.exportSha256);
        assert.ok(["production-readiness-cap-on", "reviewed-bbuat-studio-capped"].includes(capOn.sourceRoute ?? ""));
        if (capOn.sourceRoute === "production-readiness-cap-on") assert.equal(capOn.resolutionStatus, "high-resolution");
        assert.equal(capOn.pixelCount, (capOn.width ?? 0) * (capOn.height ?? 0));
        if (sidecar.sourceReviewStatus === "pending") pendingSidecarSourceReviewCount += 1;
        if (sidecar.resolutionStatus === "low-resolution") lowResolutionSidecarCount += 1;
        assert.equal(sidecar.pixelCount, (sidecar.width ?? 0) * (sidecar.height ?? 0));
        assert.notEqual(sidecar.sourceRoute, "exact-live-pdp-sidecar");
        if (sidecar.sourceRoute === "reviewed-immutable-sidecar-remediation") {
          assert.equal(sidecar.sourceReviewStatus, "approved");
          assert.equal(sidecar.reviewedOutputSha256, sidecar.exportSha256);
        }
        sidecarRoutes.set(sidecar.sourceRoute ?? "missing", (sidecarRoutes.get(sidecar.sourceRoute ?? "missing") ?? 0) + 1);
        if (sidecar.topology === "assembled-live-site-exception") {
          assert.ok(["live-site-vintage-bulb", "live-site-genuine-two-piece"].includes(sidecar.approvedException ?? ""));
        } else {
          assert.equal(sidecar.topology, "fitment-attached-cap-right-sidecar");
          assert.equal(sidecar.approvedException, null);
        }
      } else {
        assert.ok(
          row.references.identityCapOn.status === "blocked"
          || row.references.pdpCapOffSidecar.status === "blocked",
        );
        assert.ok(row.blockers.length > 0);
      }
    }

    assert.equal(identities.size, 377);
    assert.equal(pendingSidecarSourceReviewCount, 172);
    assert.equal(lowResolutionSidecarCount, 156);
    assert.deepEqual(Object.fromEntries(sidecarRoutes), {
      "exact-psd-sidecar": 145,
      // 54 review-sheet approvals (2026-07-16) + 113 BBUAT studio uncapped
      // references approved 2026-07-17 filling previously blocked lanes.
      "reviewed-immutable-sidecar-remediation": 197,
      "live-topology-exception": 27,
    });
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
    assert.equal(serialized.includes("/Users/"), false);
    assert.equal(serialized.includes("best_reference_candidate_path"), false);
  });
});
