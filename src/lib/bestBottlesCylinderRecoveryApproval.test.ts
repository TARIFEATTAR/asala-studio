import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCylinderRecoveryApproval,
  buildCylinderRecoveryReviewDecisions,
  classifyApprovedCylinderReference,
  sourceTokenFromRelativePath,
} from "./bestBottlesCylinderRecoveryApproval";

describe("Cylinder recovery approval", () => {
  it("extracts the archive token without numeric filename prefixes", () => {
    assert.equal(
      sourceTokenFromRelativePath("Folder/2.  GBCyl28RollWht.psd"),
      "GBCyl28RollWht",
    );
  });

  it("records reviewed topology without pretending sidecar references are assembled", () => {
    assert.equal(classifyApprovedCylinderReference("GBCyl100AnSpBlk"), "assembled-cap-on");
    assert.equal(classifyApprovedCylinderReference("GBCyl50RdcrMtSl"), "assembled-cap-on");
    assert.equal(classifyApprovedCylinderReference("GBCyl5WhtSht"), "assembled-cap-on");
    assert.equal(classifyApprovedCylinderReference("GBTallCyl9SpryBlkMatt"), "detached-cap-or-sidecar");
    assert.equal(classifyApprovedCylinderReference("GBCyl5MtlRollBlkDot"), "detached-cap-or-sidecar");
  });

  it("approves identity evidence while keeping low-resolution and sidecar production blockers explicit", () => {
    const approval = buildCylinderRecoveryApproval({
      reviewer: "Jordan Richter",
      reviewedAt: "2026-07-14T16:00:00.000Z",
      approvalStatement: "All of these sheets and images are accurate and ready to go.",
      minimumPixels: 1_000_000,
      sheets: [{
        cohort: "exact-high-resolution",
        path: "/tmp/exact-high.png",
        sha256: "a".repeat(64),
      }, {
        cohort: "legacy-alias-low-resolution",
        path: "/tmp/alias-low.png",
        sha256: "b".repeat(64),
      }],
      exactExports: [{
        websiteSku: "GBCyl100AnSpBlk",
        graceSku: "GB-CYL-CLR-100ML-ASP-BLK",
        sourcePath: "/archive/GBCyl100AnSpBlk.psd",
        sourceRelativePath: "GBCyl100AnSpBlk.psd",
        sourceSha256: "c".repeat(64),
        outputPath: "/tmp/assembled.png",
        outputSha256: "d".repeat(64),
        width: 1200,
        height: 1200,
      }],
      aliasExports: [{
        targetWebsiteSku: "GBCyl5MtlRollBlkDot",
        targetGraceSku: "GB-CYL-CLR-5ML-MRL-BKDT",
        sourcePath: "/archive/GBCyl5RollMtlBlkDot.psd",
        sourceRelativePath: "26. GBCyl5RollMtlBlkDot.psd",
        sourceSha256: "e".repeat(64),
        outputPath: "/tmp/sidecar.png",
        outputSha256: "f".repeat(64),
        sourceCompositeWidth: 600,
        sourceCompositeHeight: 975,
      }],
    });

    assert.deepEqual(approval.summary, {
      approvedIdentityCount: 2,
      approvedAliasCount: 1,
      highResolutionCount: 1,
      lowResolutionCount: 1,
      assembledCapOnCount: 1,
      detachedCapOrSidecarCount: 1,
      productionGateCandidateCount: 1,
      regenerationRequiredCount: 1,
    });
    assert.equal(approval.decisions[0].productionDisposition, "production-gate-candidate");
    assert.equal(approval.decisions[1].productionDisposition, "regeneration-required-low-resolution");
    assert.deepEqual(approval.aliases, [{
      sourceToken: "GBCyl5RollMtlBlkDot",
      websiteSku: "GBCyl5MtlRollBlkDot",
      graceSku: "GB-CYL-CLR-5ML-MRL-BKDT",
      reviewedBy: "Jordan Richter",
      reviewedAt: "2026-07-14T16:00:00.000Z",
    }]);

    const reviewDecisions = buildCylinderRecoveryReviewDecisions({
      approval,
      reviewUnits: [{
        reviewUnitKey: `${"c".repeat(64)}|GBCYL100ANSPBLK|GBCYLCLR100MLASPBLK`,
        sourceSha256: "c".repeat(64),
        websiteSku: "GBCyl100AnSpBlk",
        graceSku: "GB-CYL-CLR-100ML-ASP-BLK",
      }, {
        reviewUnitKey: `${"e".repeat(64)}|GBCYL5MTLROLLBLKDOT|GBCYLCLR5MLMRLBKDT`,
        sourceSha256: "e".repeat(64),
        websiteSku: "GBCyl5MtlRollBlkDot",
        graceSku: "GB-CYL-CLR-5ML-MRL-BKDT",
      }],
    });
    assert.equal(reviewDecisions.length, 2);
    assert.equal(reviewDecisions[0].decision, "assembled-cap-on");
    assert.match(reviewDecisions[1].notes, /low-resolution.*regeneration/i);
  });
});
