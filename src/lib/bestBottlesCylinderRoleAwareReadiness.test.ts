import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION,
  composeCylinderRoleAwareReadiness,
  type CylinderRoleAwareReadinessInput,
} from "./bestBottlesCylinderRoleAwareReadiness";

const sha = (character: string): string => character.repeat(64);

function canonical(websiteSku: string, graceSku: string) {
  return {
    websiteSku,
    graceSku,
    family: "Cylinder",
    productGroupSlug: "cylinder-9ml-clear-17-415",
    capacityMl: "9",
    canon_bodyHeightMm: "70.0",
    canon_widthAxisMm: "20.0",
    canon_secondAxisMm: "20.0",
    canon_heightWithCapMm: "96.0",
  };
}

function promotionPlanRow(input: {
  websiteSku: string;
  graceSku: string;
  hash: string;
  rolePath: string;
}) {
  const canonicalIdentityKey = `${input.websiteSku.toUpperCase()}|${input.graceSku.toUpperCase().replace(/-/g, "")}`;
  const storagePath = `best-bottles/production-references/cylinder/${input.rolePath}/${input.hash}.png`;
  const publicUrl = `https://example.supabase.co/storage/v1/object/public/reference-images/${storagePath}`;
  return {
    canonicalIdentityKey,
    websiteSku: input.websiteSku,
    graceSku: input.graceSku,
    canonical: canonical(input.websiteSku, input.graceSku),
    exportSha256: input.hash,
    bytes: 1234,
    width: 1000,
    height: 1300,
    opaque: true,
    storage: { bucket: "reference-images", path: storagePath, publicUrl },
    remote: { status: "exact-match", sha256: input.hash, bytes: 1234 },
    pipeline: {
      status: "already-target",
      exactJobCount: 1,
      jobId: `${input.rolePath}-job`,
      currentReferencePath: publicUrl,
    },
    blockers: [],
    decision: "ready-to-reuse",
  };
}

function executionRow(planRow: ReturnType<typeof promotionPlanRow>) {
  return {
    canonicalIdentityKey: planRow.canonicalIdentityKey,
    storagePath: planRow.storage.path,
    publicUrl: planRow.storage.publicUrl,
    exportSha256: planRow.exportSha256,
    uploadDisposition: "reused",
    jobDisposition: "already-repointed",
  };
}

function fixture(): CylinderRoleAwareReadinessInput {
  const readyCanonical = canonical("WebReady", "Grace-Ready");
  const blockedCanonical = canonical("WebBlocked", "Grace-Blocked");
  const capOnPlan = promotionPlanRow({
    websiteSku: "WebReady",
    graceSku: "Grace-Ready",
    hash: sha("a"),
    rolePath: "v1",
  });
  const sidecarPlan = promotionPlanRow({
    websiteSku: "WebReady",
    graceSku: "Grace-Ready",
    hash: sha("b"),
    rolePath: "sidecar-v2",
  });

  return {
    generatedAt: "2026-07-14T21:00:00.000Z",
    sources: {
      productionReadiness: {
        path: "public/data/best-bottles-cylinder-production-readiness.json",
        fileSha256: sha("1"),
        data: {
          version: "best-bottles-cylinder-production-readiness-v1",
          minimumReferencePixels: 1_000_000,
          summary: {
            canonicalIdentityCount: 2,
            productionQualifiedCount: 1,
            totalBlockedCount: 1,
          },
          rows: [
            {
              canonicalIdentityKey: "WEBREADY|GRACEREADY",
              websiteSku: "WebReady",
              graceSku: "Grace-Ready",
              status: "production-qualified",
              blockers: [],
              blockerLane: null,
              canonical: readyCanonical,
              reference: {
                filename: "WEBREADY__GRACEREADY.png",
                sourceSha256: sha("c"),
                exportSha256: sha("a"),
                width: 1000,
                height: 1300,
                pixelCount: 1_300_000,
                opaque: true,
                capState: "assembled-cap-on",
                reviewer: "Jordan Richter",
                reviewedAt: "2026-07-13T00:00:00.000Z",
              },
            },
            {
              canonicalIdentityKey: "WEBBLOCKED|GRACEBLOCKED",
              websiteSku: "WebBlocked",
              graceSku: "Grace-Blocked",
              status: "blocked",
              blockers: ["no-approved-exact-reference"],
              blockerLane: "source-evidence",
              canonical: blockedCanonical,
              reference: null,
            },
          ],
        },
      },
      identityCapOnAudit: {
        path: "tmp/cap-on-audit.json",
        fileSha256: sha("2"),
        data: {
          version: "best-bottles-cylinder-reference-promotion-preflight-artifact-v1",
          manifestSha256: sha("d"),
          plan: {
            version: "best-bottles-cylinder-reference-promotion-preflight-v1",
            summary: { qualifiedIdentityCount: 1, blockedCount: 0 },
            rows: [capOnPlan],
          },
        },
      },
      identityCapOnExecution: {
        path: "tmp/cap-on-execution.json",
        fileSha256: sha("3"),
        data: {
          version: "best-bottles-cylinder-reference-promotion-execution-artifact-v1",
          manifestSha256: sha("e"),
          executionSha256: sha("f"),
          result: {
            version: "best-bottles-cylinder-reference-promotion-execution-v1",
            summary: { identityCount: 1, verifiedCount: 1, failedCount: 0 },
            rows: [executionRow(capOnPlan)],
          },
        },
      },
      pdpCapOffSidecarPreflight: {
        path: "tmp/sidecar-preflight.json",
        fileSha256: sha("4"),
        data: {
          version: "best-bottles-cylinder-sidecar-promotion-preflight-v2",
          sourceManifestSha256: sha("6"),
          preflightSha256: sha("7"),
          plan: {
            version: "best-bottles-cylinder-reference-promotion-preflight-v1",
            summary: { qualifiedIdentityCount: 1, blockedCount: 0 },
            rows: [sidecarPlan],
          },
        },
      },
      pdpCapOffSidecarExecution: {
        path: "tmp/sidecar-execution.json",
        fileSha256: sha("5"),
        data: {
          version: "best-bottles-cylinder-sidecar-promotion-execution-v2",
          sourceManifestSha256: sha("6"),
          preflightSha256: sha("8"),
          executionSha256: sha("9"),
          result: {
            version: "best-bottles-cylinder-reference-promotion-execution-v1",
            summary: { identityCount: 1, verifiedCount: 1, failedCount: 0 },
            rows: [executionRow(sidecarPlan)],
          },
        },
      },
      pdpCapOffSidecarManifest: {
        path: "tmp/sidecar-manifest.json",
        fileSha256: sha("6"),
        data: {
          version: "best-bottles-cylinder-sidecar-reconciliation-v2",
          summary: { targetCount: 1, blockedCount: 0 },
          records: [
            {
              canonicalIdentityKey: "WEBREADY|GRACEREADY",
              websiteSku: "WebReady",
              graceSku: "Grace-Ready",
              route: "exact-psd-sidecar",
              requiredOutputTopology: "fitment-attached-cap-right-sidecar",
              blockers: [],
              source: {
                reviewStatus: "pending-human-review",
                canonicalReviewMetadata: {
                  applicator: "Metal Roller Ball",
                  assemblyType: "3-part",
                },
              },
              output: {
                sha256: sha("b"),
                width: 1000,
                height: 1300,
                opaque: true,
              },
            },
          ],
        },
      },
      livePointerApproval: {
        path: "docs/live-pointer.json",
        fileSha256: sha("a"),
        data: {
          version: "best-bottles-cylinder-live-pointer-approval-v1",
          sha256: sha("b"),
          decisions: [
            {
              canonicalIdentityKey: "WEBBLOCKED|GRACEBLOCKED",
              websiteSku: "WebBlocked",
              graceSku: "Grace-Blocked",
              identityDecision: "approved-exact-live-pointer-reference",
              componentTopology: "bottle-primary-with-detached-cap-or-overcap-sidecar",
              resolutionStatus: "low-resolution-generation-reference",
              productionDisposition: "generation-reference-approved-remediation-required",
              approvedReference: { sha256: sha("d"), width: 360, height: 480 },
            },
          ],
        },
      },
      recoveryApproval: {
        path: "docs/recovery.json",
        fileSha256: sha("e"),
        data: {
          version: "best-bottles-cylinder-recovery-approval-v1",
          decisions: [],
        },
      },
    },
  } as CylinderRoleAwareReadinessInput;
}

describe("Cylinder role-aware readiness", () => {
  it("preserves immutable cap-on and sidecar references as distinct semantic roles", () => {
    const artifact = composeCylinderRoleAwareReadiness(fixture());
    const ready = artifact.rows.find((row) => row.graceSku === "Grace-Ready");

    assert.equal(artifact.version, BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION);
    assert.equal(ready?.status, "both-roles-verified");
    assert.equal(ready?.references.identityCapOn.roleId, "identity-cap-on");
    assert.equal(ready?.references.identityCapOn.status, "verified");
    assert.equal(ready?.references.identityCapOn.productionStatus, "generation-authorized");
    assert.equal(ready?.references.identityCapOn.sourceRoute, "production-readiness-cap-on");
    assert.equal(ready?.references.identityCapOn.resolutionStatus, "high-resolution");
    assert.equal(ready?.references.pdpCapOffSidecar.roleId, "pdp-cap-off-sidecar");
    assert.equal(ready?.references.pdpCapOffSidecar.status, "verified");
    assert.equal(ready?.references.pdpCapOffSidecar.remoteStatus, "verified");
    assert.equal(ready?.references.pdpCapOffSidecar.sourceReviewStatus, "pending");
    assert.equal(ready?.references.pdpCapOffSidecar.sourceRoute, "exact-psd-sidecar");
    assert.equal(ready?.references.pdpCapOffSidecar.resolutionStatus, "high-resolution");
    assert.equal(
      ready?.references.pdpCapOffSidecar.topology,
      "fitment-attached-cap-right-sidecar",
    );
    assert.notEqual(
      ready?.references.identityCapOn.publicUrl,
      ready?.references.pdpCapOffSidecar.publicUrl,
    );
    assert.deepEqual(artifact.summary, {
      canonicalIdentityCount: 2,
      identityCapOnVerifiedCount: 1,
      pdpCapOffSidecarVerifiedCount: 1,
      bothRolesVerifiedCount: 1,
      blockedIdentityCount: 1,
      standardSidecarCount: 1,
      liveSiteExceptionCount: 0,
      approvedEvidenceBlockedCount: 1,
      missingApprovedEvidenceBlockedCount: 0,
      externalWriteCount: 0,
    });
    assert.deepEqual(artifact.authorization, {
      exactEvidenceIdentityCount: 1,
      generationScope: "controlled-studio-only",
      generationStatus: "authorized-for-controlled-generation",
      publishStatus: "not-publish-ready",
      individualContentReviewStatus: "not-individually-content-approved",
      requiredNextGate: "generated-output-qa-and-explicit-publish-approval",
    });
  });

  it("keeps approved low-resolution remediation evidence blocked instead of promoting it", () => {
    const input = fixture();
    input.sources.productionReadiness.data.rows[1].reference = {
      filename: "WEBBLOCKED__GRACEBLOCKED.png",
      sourceSha256: sha("c"),
      exportSha256: sha("d"),
      width: 360,
      height: 480,
      pixelCount: 172_800,
      opaque: true,
      capState: "assembled-cap-on",
      reviewer: "Jordan Richter",
      reviewedAt: "2026-07-13T00:00:00.000Z",
    };
    const artifact = composeCylinderRoleAwareReadiness(input);
    const blocked = artifact.rows.find((row) => row.graceSku === "Grace-Blocked");

    assert.equal(blocked?.status, "blocked");
    assert.equal(blocked?.references.identityCapOn.status, "blocked");
    assert.equal(blocked?.references.pdpCapOffSidecar.status, "blocked");
    assert.equal(blocked?.approvedEvidence.livePointer?.productionDisposition,
      "generation-reference-approved-remediation-required");
    assert.equal(blocked?.references.identityCapOn.sourceRoute, "production-readiness-cap-on");
    assert.equal(blocked?.references.identityCapOn.resolutionStatus, "low-resolution");
    assert.equal(blocked?.references.identityCapOn.pixelCount, 172_800);
    assert.match(blocked?.references.pdpCapOffSidecar.blockers.join(" ") ?? "", /not-promoted/i);
  });

  it("blocks a missing exact execution role without discarding the other verified role", () => {
    const input = fixture();
    input.sources.pdpCapOffSidecarExecution.data.result.rows = [];
    const artifact = composeCylinderRoleAwareReadiness(input);
    const ready = artifact.rows.find((row) => row.graceSku === "Grace-Ready");

    assert.equal(ready?.references.identityCapOn.status, "verified");
    assert.equal(ready?.references.pdpCapOffSidecar.status, "blocked");
    assert.match(
      ready?.references.pdpCapOffSidecar.blockers.join(" ") ?? "",
      /missing exact sidecar execution/i,
    );
  });

  it("blocks raw live-PDP sidecars until reviewed immutable remediation is bound", () => {
    const input = fixture();
    const manifestRecord = input.sources.pdpCapOffSidecarManifest.data.records[0];
    manifestRecord.route = "exact-live-pdp-sidecar";
    const artifact = composeCylinderRoleAwareReadiness(input);
    const ready = artifact.rows.find((row) => row.graceSku === "Grace-Ready");

    assert.equal(ready?.references.identityCapOn.status, "verified");
    assert.equal(ready?.references.pdpCapOffSidecar.status, "blocked");
    assert.equal(ready?.references.pdpCapOffSidecar.remoteStatus, "unverified");
    assert.equal(ready?.references.pdpCapOffSidecar.productionStatus, "blocked");
    assert.equal(ready?.references.pdpCapOffSidecar.sourceRoute, null);
    assert.match(
      ready?.references.pdpCapOffSidecar.blockers.join(" ") ?? "",
      /raw live-PDP sidecar requires reviewed immutable remediation/i,
    );
  });

  it("preserves an explicitly approved exact live-PDP sidecar only when its export hash is reviewed", () => {
    const input = fixture();
    const manifestRecord = input.sources.pdpCapOffSidecarManifest.data.records[0];
    manifestRecord.route = "exact-live-pdp-sidecar";
    Reflect.set(input.sources, "reviewedRoleApprovals", {
      path: "docs/cylinder-reviewed-role-approvals.json",
      fileSha256: sha("f"),
      data: {
        version: "best-bottles-cylinder-reviewed-role-approvals-v1",
        decisions: [{
          canonicalIdentityKey: "WEBREADY|GRACEREADY",
          websiteSku: "WebReady",
          graceSku: "Grace-Ready",
          roleId: "pdp-cap-off-sidecar",
          sourceSha256: sha("b"),
          reviewedOutputSha256: sha("b"),
          decision: "preserve-exact-local-reference",
        }],
      },
    });
    const artifact = composeCylinderRoleAwareReadiness(input);
    const ready = artifact.rows.find((row) => row.graceSku === "Grace-Ready");

    assert.equal(ready?.references.pdpCapOffSidecar.status, "verified");
    assert.equal(
      ready?.references.pdpCapOffSidecar.sourceRoute,
      "reviewed-immutable-sidecar-remediation",
    );
    assert.equal(ready?.references.pdpCapOffSidecar.sourceReviewStatus, "approved");
    assert.equal(
      (ready?.references.pdpCapOffSidecar as { reviewedOutputSha256?: string }).reviewedOutputSha256,
      sha("b"),
    );
  });

  it("requires explicit approved exception evidence for assembled live-site sidecar-role outputs", () => {
    const approved = fixture();
    const manifestRecord = approved.sources.pdpCapOffSidecarManifest.data.records[0];
    manifestRecord.route = "live-topology-exception";
    manifestRecord.requiredOutputTopology = "assembled-live-site-exception";
    manifestRecord.source.canonicalReviewMetadata.applicator = "Vintage Bulb Sprayer";
    manifestRecord.source.canonicalReviewMetadata.assemblyType = "2-part";
    const accepted = composeCylinderRoleAwareReadiness(approved).rows.find(
      (row) => row.graceSku === "Grace-Ready",
    );
    assert.equal(
      accepted?.references.pdpCapOffSidecar.approvedException,
      "live-site-vintage-bulb",
    );

    const unapproved = fixture();
    const badRecord = unapproved.sources.pdpCapOffSidecarManifest.data.records[0];
    badRecord.route = "live-topology-exception";
    badRecord.requiredOutputTopology = "assembled-live-site-exception";
    badRecord.source.canonicalReviewMetadata.applicator = null;
    badRecord.source.canonicalReviewMetadata.assemblyType = null;
    const rejected = composeCylinderRoleAwareReadiness(unapproved).rows.find(
      (row) => row.graceSku === "Grace-Ready",
    );
    assert.equal(rejected?.references.pdpCapOffSidecar.status, "blocked");
    assert.match(
      rejected?.references.pdpCapOffSidecar.blockers.join(" ") ?? "",
      /unapproved live-site topology exception/i,
    );
  });

  it("fails closed on a malformed dual-SKU identity instead of substituting by one SKU", () => {
    const input = fixture();
    input.sources.pdpCapOffSidecarExecution.data.result.rows[0].canonicalIdentityKey =
      "WEBREADY|WRONGGRACE";
    assert.throws(
      () => composeCylinderRoleAwareReadiness(input),
      /does not match exact Website \+ Grace SKU/i,
    );
  });
});
