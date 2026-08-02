import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCylinderProductionReadiness,
  type CylinderReferenceBlockerArtifact,
  type CylinderReferenceProductionArtifact,
} from "./bestBottlesCylinderProductionCutover";

const canonical = (websiteSku: string, graceSku: string) => ({
  websiteSku,
  graceSku,
  family: "Cylinder",
  productGroupSlug: "cylinder-9ml-clear-17-415",
  capacityMl: "9",
  canon_bodyHeightMm: "70.0",
  canon_widthAxisMm: "20.0",
  canon_secondAxisMm: "20.0",
  canon_heightWithCapMm: "96.0",
});

function productionArtifact(): CylinderReferenceProductionArtifact {
  return {
    version: "best-bottles-cylinder-reference-production-artifacts-v2",
    provenance: {
      inputs: {
        coverageManifest: { path: "/private/coverage.json", sha256: "a".repeat(64) },
        reviewedManifest: { path: "/private/reviewed.json", sha256: "b".repeat(64) },
      },
    },
    summary: {
      canonicalIdentityCount: 3,
      exportQualifiedCount: 2,
      blockedIdentityCount: 1,
      externalWriteCount: 0,
    },
    planVersion: "best-bottles-cylinder-reference-production-plan-v1",
    exports: [
      {
        canonicalIdentityKey: "WEBREADY|GRACEREADY",
        canonical: canonical("WebReady", "Grace-Ready"),
        source: {
          sourcePath: "/private/source-ready.psd",
          sourceRelativePath: "Cylinder/source-ready.psd",
          sourceSha256: "c".repeat(64),
          reviewer: "Reviewer",
          reviewedAt: "2026-07-13T00:00:00.000Z",
          capState: "assembled-cap-on",
        },
        output: {
          path: "/private/output-ready.png",
          filename: "WEBREADY__GRACEREADY__cccccccccccc.png",
          sha256: "d".repeat(64),
          bytes: 100,
          format: "PNG",
          width: 1000,
          height: 1300,
          opaque: true,
          colorspace: "sRGB",
          primaryBounds: { left: 10, top: 20, width: 500, height: 900 },
        },
      },
      {
        canonicalIdentityKey: "WEBLOW|GRACELOW",
        canonical: canonical("WebLow", "Grace-Low"),
        source: {
          sourcePath: "/private/source-low.psd",
          sourceRelativePath: "Cylinder/source-low.psd",
          sourceSha256: "e".repeat(64),
          reviewer: "Reviewer",
          reviewedAt: "2026-07-13T00:00:00.000Z",
          capState: "assembled-cap-on",
        },
        output: {
          path: "/private/output-low.png",
          filename: "WEBLOW__GRACELOW__eeeeeeeeeeee.png",
          sha256: "f".repeat(64),
          bytes: 100,
          format: "PNG",
          width: 591,
          height: 945,
          opaque: true,
          colorspace: "sRGB",
          primaryBounds: { left: 10, top: 20, width: 250, height: 588 },
        },
      },
    ],
  };
}

function blockerArtifact(): CylinderReferenceBlockerArtifact {
  return {
    version: "best-bottles-cylinder-reference-production-artifacts-v2",
    provenance: productionArtifact().provenance,
    summary: productionArtifact().summary,
    planVersion: "best-bottles-cylinder-reference-production-plan-v1",
    blockedIdentities: [
      {
        canonicalIdentityKey: "WEBBLOCKED|GRACEBLOCKED",
        canonical: canonical("WebBlocked", "Grace-Blocked"),
        blockers: ["no-approved-exact-reference"],
        lane: "source-evidence",
        approvedReferenceCount: 0,
        primaryReference: null,
      },
    ],
  };
}

describe("Cylinder production cutover readiness", () => {
  it("separates production-qualified, low-resolution, and evidence-blocked identities", () => {
    const artifact = buildCylinderProductionReadiness({
      productionArtifact: productionArtifact(),
      blockerArtifact: blockerArtifact(),
    });

    assert.deepEqual(artifact.summary, {
      canonicalIdentityCount: 3,
      localReferenceExportCount: 2,
      productionQualifiedCount: 1,
      belowMinimumPixelsCount: 1,
      evidenceBlockedCount: 1,
      totalBlockedCount: 2,
      externalWriteCount: 0,
    });
    assert.deepEqual(
      artifact.rows.map((row) => [row.graceSku, row.status, row.blockers]),
      [
        ["Grace-Blocked", "blocked", ["no-approved-exact-reference"]],
        ["Grace-Low", "blocked", ["reference-below-minimum-pixels"]],
        ["Grace-Ready", "production-qualified", []],
      ],
    );
  });

  it("publishes hashes and canonical axes without leaking absolute source paths", () => {
    const artifact = buildCylinderProductionReadiness({
      productionArtifact: productionArtifact(),
      blockerArtifact: blockerArtifact(),
    });
    const ready = artifact.rows.find((row) => row.status === "production-qualified");
    assert.equal(ready?.reference?.sourceSha256, "c".repeat(64));
    assert.equal(ready?.reference?.exportSha256, "d".repeat(64));
    assert.equal(ready?.canonical.canon_bodyHeightMm, "70.0");
    assert.equal(JSON.stringify(artifact).includes("/private/"), false);
    assert.equal(JSON.stringify(artifact).includes("sourceRelativePath"), false);
  });

  it("fails closed on duplicate or overlapping canonical identities", () => {
    const blockers = blockerArtifact();
    blockers.blockedIdentities[0].canonicalIdentityKey = "WEBREADY|GRACEREADY";
    blockers.blockedIdentities[0].canonical = canonical("WebReady", "Grace-Ready");
    assert.throws(
      () => buildCylinderProductionReadiness({
        productionArtifact: productionArtifact(),
        blockerArtifact: blockers,
      }),
      /duplicate canonical identity/i,
    );
  });
});
