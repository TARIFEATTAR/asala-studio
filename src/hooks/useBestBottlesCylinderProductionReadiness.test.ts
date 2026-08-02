import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildCylinderProductionReadinessIndex,
  getCylinderProductionReadinessForIdentity,
  isCylinderPromotedReferenceUrl,
} from "./useBestBottlesCylinderProductionReadiness";
import * as cylinderReadiness from "./useBestBottlesCylinderProductionReadiness";
import type { CylinderProductionReadinessArtifact } from "../lib/bestBottlesCylinderProductionCutover";
import {
  buildCylinderCanonicalRosterAuthority,
  type CylinderRoleAwareReadinessArtifact,
} from "../lib/bestBottlesCylinderRoleAuthority";

const roleRosterBytesByArtifact = new WeakMap<object, Uint8Array>();

function artifact(): CylinderProductionReadinessArtifact {
  const ready = Array.from({ length: 228 }, (_, index) => ({
    canonicalIdentityKey: `WEB${index}|GRACE${index}`,
    websiteSku: `WEB${index}`,
    graceSku: `GRACE${index}`,
    status: "production-qualified" as const,
    blockers: [],
    blockerLane: null,
    canonical: {
      websiteSku: `WEB${index}`,
      graceSku: `GRACE${index}`,
      family: "Cylinder",
      productGroupSlug: "group",
      capacityMl: "9",
      canon_bodyHeightMm: "70",
      canon_widthAxisMm: "20",
      canon_secondAxisMm: "20",
      canon_heightWithCapMm: "96",
    },
    reference: {
      filename: `${index}.png`,
      sourceSha256: "a".repeat(64),
      exportSha256: "b".repeat(64),
      width: 1000,
      height: 1300,
      pixelCount: 1_300_000,
      opaque: true as const,
      capState: "assembled-cap-on",
      reviewer: "Jordan Richter",
      reviewedAt: "2026-07-13T00:00:00.000Z",
    },
  }));
  const blocked = Array.from({ length: 149 }, (_, index) => ({
    ...ready[0],
    canonicalIdentityKey: `BLOCKEDWEB${index}|BLOCKEDGRACE${index}`,
    websiteSku: `BLOCKEDWEB${index}`,
    graceSku: `BLOCKEDGRACE${index}`,
    status: "blocked" as const,
    blockers: ["missing-reference"],
    blockerLane: "evidence",
    canonical: {
      ...ready[0].canonical,
      websiteSku: `BLOCKEDWEB${index}`,
      graceSku: `BLOCKEDGRACE${index}`,
    },
    reference: null,
  }));
  return {
    version: "best-bottles-cylinder-production-readiness-v1",
    minimumReferencePixels: 1_000_000,
    provenance: {
      referenceProductionVersion: "v1",
      referenceProductionPlanVersion: "v1",
      coverageManifestSha256: "c".repeat(64),
      reviewedManifestSha256: "d".repeat(64),
    },
    summary: {
      canonicalIdentityCount: 377,
      localReferenceExportCount: 242,
      productionQualifiedCount: 228,
      belowMinimumPixelsCount: 14,
      evidenceBlockedCount: 135,
      totalBlockedCount: 149,
      externalWriteCount: 0,
    },
    rows: [...ready, ...blocked],
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function resealRoleArtifact(value: ReturnType<typeof roleAwareArtifact>): void {
  const { sha256: _ignored, ...unsigned } = value;
  value.sha256 = createHash("sha256").update(stableJson(unsigned)).digest("hex");
}

function roleAwareArtifact() {
  const unsigned = {
    version: "best-bottles-cylinder-role-aware-readiness-v2",
    generatedAt: "2026-07-14T00:00:00.000Z",
    provenance: {
      productionReadiness: {
        path: "public/data/readiness.json",
        version: "best-bottles-cylinder-production-readiness-v1",
        fileSha256: "1".repeat(64),
      },
      identityCapOn: {
        auditPath: "cap-audit.json", auditVersion: "v1", auditFileSha256: "2".repeat(64), currentAuditSeal: null,
        executionPath: "cap-execution.json", executionVersion: "v1", executionFileSha256: "3".repeat(64), executionSeal: "4".repeat(64), executionAuditSeal: null,
      },
      pdpCapOffSidecar: {
        preflightPath: "sidecar-preflight.json", preflightVersion: "v1", preflightFileSha256: "5".repeat(64), currentAuditPreflightSeal: null,
        executionPath: "sidecar-execution.json", executionVersion: "v1", executionFileSha256: "6".repeat(64), executionSeal: "7".repeat(64), executionPreflightSeal: null,
        sourceManifestPath: "sidecar.json", sourceManifestVersion: "v1", sourceManifestSha256: "8".repeat(64),
      },
      livePointerApproval: { path: "live.json", version: "v1", fileSha256: "9".repeat(64), approvalSeal: null },
      recoveryApproval: { path: "recovery.json", version: "v1", fileSha256: "a".repeat(64) },
    },
    summary: {
      canonicalIdentityCount: 377,
      identityCapOnVerifiedCount: 228,
      pdpCapOffSidecarVerifiedCount: 228,
      bothRolesVerifiedCount: 228,
      blockedIdentityCount: 149,
      standardSidecarCount: 201,
      liveSiteExceptionCount: 27,
      approvedEvidenceBlockedCount: 0,
      missingApprovedEvidenceBlockedCount: 149,
      externalWriteCount: 0,
    },
    authorization: {
      exactEvidenceIdentityCount: 228,
      generationScope: "controlled-studio-only" as const,
      generationStatus: "authorized-for-controlled-generation" as const,
      publishStatus: "not-publish-ready" as const,
      individualContentReviewStatus: "not-individually-content-approved" as const,
      requiredNextGate: "generated-output-qa-and-explicit-publish-approval" as const,
    },
    rows: Array.from({ length: 377 }, (_, index) => {
      const verified = index < 228;
      const topologyException = index >= 201 && index < 228;
      const websiteSku = `Web${index}`;
      const graceSku = `Grace${index}`;
      const canonicalIdentityKey = `WEB${index}|GRACE${index}`;
      const capOnHash = index.toString(16).padStart(64, "a");
      const sidecarHash = index.toString(16).padStart(64, "b");
      const capOnStoragePath = [
        "best-bottles",
        "production-references",
        "cylinder",
        "v1",
        capOnHash.slice(0, 2),
        `${canonicalIdentityKey.replace("|", "__")}__${capOnHash}.png`,
      ].join("/");
      const sidecarStoragePath = [
        "best-bottles",
        "production-references",
        "cylinder",
        "sidecar-v2",
        sidecarHash.slice(0, 2),
        `${canonicalIdentityKey.replace("|", "__")}__${sidecarHash}.png`,
      ].join("/");
      return {
        canonicalIdentityKey,
        websiteSku,
        graceSku,
        status: verified ? "both-roles-verified" as const : "blocked" as const,
        blockers: verified ? [] : ["missing-reviewed-role"],
        canonical: {
          websiteSku,
          graceSku,
          family: "Cylinder",
          productGroupSlug: "cylinder-9ml",
          capacityMl: "9",
          canon_bodyHeightMm: "70",
          canon_widthAxisMm: "20",
          canon_secondAxisMm: "20",
          canon_heightWithCapMm: "96",
        },
        references: {
          identityCapOn: {
            roleId: "identity-cap-on" as const,
            remoteStatus: verified ? "verified" as const : "blocked" as const,
            sourceReviewStatus: "approved" as const,
            productionStatus: verified ? "generation-authorized" as const : "blocked" as const,
            publicUrl: verified ? `https://example.supabase.co/storage/v1/object/public/reference-images/${capOnStoragePath}` : null,
            storagePath: verified ? capOnStoragePath : null,
            exportSha256: verified ? capOnHash : null,
            opaque: verified ? true as const : null,
            topology: verified ? "assembled-cap-on" as const : null,
            approvedException: null,
            blockers: verified ? [] : ["missing-reviewed-role"],
          },
          pdpCapOffSidecar: {
            roleId: "pdp-cap-off-sidecar" as const,
            remoteStatus: verified ? "verified" as const : "blocked" as const,
            sourceReviewStatus: "approved" as const,
            productionStatus: verified ? "generation-authorized" as const : "blocked" as const,
            publicUrl: verified ? `https://example.supabase.co/storage/v1/object/public/reference-images/${sidecarStoragePath}` : null,
            storagePath: verified ? sidecarStoragePath : null,
            exportSha256: verified ? sidecarHash : null,
            opaque: verified ? true as const : null,
            topology: !verified
              ? null
              : topologyException
                ? "assembled-live-site-exception" as const
                : "fitment-attached-cap-right-sidecar" as const,
            approvedException: topologyException ? "live-site-vintage-bulb" as const : null,
            blockers: verified ? [] : ["missing-reviewed-role"],
          },
        },
        approvedEvidence: { livePointer: null, recovery: null },
      };
    }),
  };
  const rosterBytes = new TextEncoder().encode(JSON.stringify({
    version: "best-bottles-cylinder-production-readiness-v1",
    summary: { canonicalIdentityCount: unsigned.rows.length },
    rows: unsigned.rows.map((entry) => ({
      canonicalIdentityKey: entry.canonicalIdentityKey,
      websiteSku: entry.websiteSku,
      graceSku: entry.graceSku,
      canonical: {
        websiteSku: entry.canonical.websiteSku,
        graceSku: entry.canonical.graceSku,
      },
    })),
  }));
  unsigned.provenance.productionReadiness.fileSha256 = createHash("sha256").update(rosterBytes).digest("hex");
  const result = {
    ...unsigned,
    sha256: createHash("sha256").update(stableJson(unsigned)).digest("hex"),
  };
  roleRosterBytesByArtifact.set(result, rosterBytes);
  return result;
}

function buildRoleAwareTestIndex<T>(
  buildIndex: (artifact: CylinderRoleAwareReadinessArtifact, roster: ReturnType<typeof buildCylinderCanonicalRosterAuthority>) => T,
  value: CylinderRoleAwareReadinessArtifact,
): T {
  const bytes = roleRosterBytesByArtifact.get(value);
  if (!bytes) throw new Error("Missing independent role test roster.");
  return buildIndex(value, buildCylinderCanonicalRosterAuthority(value, bytes));
}

describe("Cylinder production readiness UI gate", () => {
  it("wires Studio single and batch through canonical one-retrieval orchestration", () => {
    const studioSource = readFileSync(
      new URL("../components/darkroom/MastersTabPanel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(studioSource, /orchestrateCylinderStudioGeneration\(\{/);
    assert.match(studioSource, /prepareCylinderStudioGeneration\(\{/);
    assert.match(studioSource, /const verifiedCylinderPreparations = new Map<string, CylinderStudioPreparedGeneration>\(\)/);
    assert.match(studioSource, /verifiedCylinderPreparations\.set\(/);
    assert.match(studioSource, /verifiedCylinderPreparations\.get\(/);
    assert.match(studioSource, /canonicalGeometryContract: cylinderPreparation\?\.canonicalGeometryContract \?\? null/);
  });

  it("returns only exact Website + Grace SKU matches", () => {
    const index = buildCylinderProductionReadinessIndex(artifact());
    assert.equal(
      getCylinderProductionReadinessForIdentity(index, "web0", "grace0")?.status,
      "production-qualified",
    );
    assert.equal(getCylinderProductionReadinessForIdentity(index, "web0", "wrong"), null);
  });

  it("fails closed when artifact-derived readiness totals drift", () => {
    const invalid = artifact();
    invalid.summary.productionQualifiedCount = 229;
    assert.throws(() => buildCylinderProductionReadinessIndex(invalid), /artifact-derived|summary/i);
  });

  it("rejects duplicate exact identities", () => {
    const invalid = artifact();
    invalid.rows[1] = invalid.rows[0];
    assert.throws(() => buildCylinderProductionReadinessIndex(invalid), /Duplicate/);
  });

  it("accepts only the immutable public reference URL carrying the qualified export hash", () => {
    const row = artifact().rows[0];
    const hash = row.reference?.exportSha256 ?? "";
    const url = `https://example.supabase.co/storage/v1/object/public/reference-images/best-bottles/production-references/cylinder/v1/${hash.slice(0, 12)}/sku__${hash}.png`;
    assert.equal(isCylinderPromotedReferenceUrl(row, url), true);
    assert.equal(isCylinderPromotedReferenceUrl(row, url.replace(hash, "c".repeat(64))), false);
    assert.equal(isCylinderPromotedReferenceUrl(row, url.replace("/public/", "/sign/")), false);
  });

  it("routes only the exploded PDP preset to the immutable sidecar role", () => {
    const getRole = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderReferenceRoleForPreset;
    assert.equal(typeof getRole, "function");
    if (typeof getRole !== "function") return;

    assert.equal(getRole("grid-card-exploded-2000x2200"), "pdp-cap-off-sidecar");
    assert.equal(getRole("grid-card-2000x2200"), "identity-cap-on");
    assert.equal(getRole("master-angle-2080x2288"), "identity-cap-on");
  });

  it("keeps cap-on and sidecar authorities separate for one exact dual-SKU identity", () => {
    const buildIndex = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).buildCylinderRoleAwareReadinessIndex;
    const getRow = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderRoleAwareReadinessForIdentity;
    const getReference = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderReferenceForPreset;
    assert.equal(typeof buildIndex, "function");
    assert.equal(typeof getRow, "function");
    assert.equal(typeof getReference, "function");
    if (
      typeof buildIndex !== "function" ||
      typeof getRow !== "function" ||
      typeof getReference !== "function"
    ) return;

    const index = buildRoleAwareTestIndex(buildIndex, roleAwareArtifact());
    const row = getRow(index, "web0", "grace0");
    assert.equal(getRow(index, "web0", "wrong"), null);
    assert.equal(
      getReference(row, "grid-card-2000x2200")?.roleId,
      "identity-cap-on",
    );
    assert.equal(
      getReference(row, "grid-card-exploded-2000x2200")?.roleId,
      "pdp-cap-off-sidecar",
    );
  });

  it("requires the exact artifact URL, storage path, role, and export hash", () => {
    const buildIndex = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).buildCylinderRoleAwareReadinessIndex;
    const getRow = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderRoleAwareReadinessForIdentity;
    const isAuthorized = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).isCylinderReferenceAuthorizedForPreset;
    assert.equal(typeof buildIndex, "function");
    assert.equal(typeof getRow, "function");
    assert.equal(typeof isAuthorized, "function");
    if (
      typeof buildIndex !== "function" ||
      typeof getRow !== "function" ||
      typeof isAuthorized !== "function"
    ) return;

    const index = buildRoleAwareTestIndex(buildIndex, roleAwareArtifact());
    const row = getRow(index, "web0", "grace0");
    const capOnUrl = row.references.identityCapOn.publicUrl;
    const sidecarUrl = row.references.pdpCapOffSidecar.publicUrl;

    assert.equal(isAuthorized(row, "grid-card-2000x2200", capOnUrl), true);
    assert.equal(isAuthorized(row, "grid-card-2000x2200", sidecarUrl), false);
    assert.equal(isAuthorized(row, "grid-card-exploded-2000x2200", sidecarUrl), true);
    assert.equal(isAuthorized(row, "grid-card-exploded-2000x2200", capOnUrl), false);
    assert.equal(isAuthorized(row, "grid-card-exploded-2000x2200", `${sidecarUrl}?copy=1`), false);

    row.references.pdpCapOffSidecar.width = 360;
    row.references.pdpCapOffSidecar.height = 480;
    assert.equal(
      isAuthorized(row, "grid-card-exploded-2000x2200", sidecarUrl),
      true,
      "an artifact-authorized low-resolution evidence row remains eligible for controlled generation",
    );
    assert.equal(
      isAuthorized(
        row,
        "grid-card-exploded-2000x2200",
        `https://attacker.example/storage/v1/object/public/reference-images/${row.references.pdpCapOffSidecar.storagePath}`,
      ),
      false,
    );
  });

  it("rejects a verified role object borrowed from another exact identity", () => {
    const buildIndex = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).buildCylinderRoleAwareReadinessIndex;
    const getRow = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderRoleAwareReadinessForIdentity;
    const isAuthorized = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).isCylinderReferenceAuthorizedForPreset;
    assert.equal(typeof buildIndex, "function");
    assert.equal(typeof getRow, "function");
    assert.equal(typeof isAuthorized, "function");
    if (
      typeof buildIndex !== "function" ||
      typeof getRow !== "function" ||
      typeof isAuthorized !== "function"
    ) return;

    const borrowed = roleAwareArtifact();
    borrowed.rows[0].references.identityCapOn = borrowed.rows[1].references.identityCapOn;
    borrowed.rows[0].references.pdpCapOffSidecar = borrowed.rows[1].references.pdpCapOffSidecar;
    resealRoleArtifact(borrowed);
    assert.throws(() => buildRoleAwareTestIndex(buildIndex, borrowed), /immutable storage path|exact/i);
  });

  it("accepts an assembled live-site exception only when the exact sidecar role approves it", () => {
    const buildIndex = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).buildCylinderRoleAwareReadinessIndex;
    const getRow = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderRoleAwareReadinessForIdentity;
    const isAuthorized = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).isCylinderReferenceAuthorizedForPreset;
    assert.equal(typeof buildIndex, "function");
    assert.equal(typeof getRow, "function");
    assert.equal(typeof isAuthorized, "function");
    if (
      typeof buildIndex !== "function" ||
      typeof getRow !== "function" ||
      typeof isAuthorized !== "function"
    ) return;

    const approved = roleAwareArtifact();
    approved.rows[0].references.pdpCapOffSidecar.topology = "assembled-live-site-exception";
    approved.rows[0].references.pdpCapOffSidecar.approvedException = "live-site-vintage-bulb";
    approved.summary.standardSidecarCount -= 1;
    approved.summary.liveSiteExceptionCount += 1;
    resealRoleArtifact(approved);
    let index = buildRoleAwareTestIndex(buildIndex, approved);
    let row = getRow(index, "web0", "grace0");
    assert.equal(
      isAuthorized(
        row,
        "grid-card-exploded-2000x2200",
        row.references.pdpCapOffSidecar.publicUrl,
      ),
      true,
    );

    const inferredOnly = roleAwareArtifact();
    inferredOnly.rows[0].references.pdpCapOffSidecar.topology = "assembled-live-site-exception";
    resealRoleArtifact(inferredOnly);
    assert.throws(() => buildRoleAwareTestIndex(buildIndex, inferredOnly), /invalid topology/i);
  });

  it("preserves the artifact-approved topology instead of forcing every sidecar preset detached", () => {
    const buildIndex = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).buildCylinderRoleAwareReadinessIndex;
    const getRow = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderRoleAwareReadinessForIdentity;
    const getGenerationTopology = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderGenerationTopologyForPreset;
    assert.equal(typeof buildIndex, "function");
    assert.equal(typeof getRow, "function");
    assert.equal(typeof getGenerationTopology, "function");
    if (
      typeof buildIndex !== "function" ||
      typeof getRow !== "function" ||
      typeof getGenerationTopology !== "function"
    ) return;

    let index = buildRoleAwareTestIndex(buildIndex, roleAwareArtifact());
    let row = getRow(index, "web0", "grace0");
    assert.deepEqual(getGenerationTopology(row, "grid-card-exploded-2000x2200"), {
      capState: "detached",
      mode: "cap-off",
      componentTopology: "fitment-attached-cap-right-sidecar",
      requiresCapOffReference: true,
    });
    assert.deepEqual(getGenerationTopology(row, "grid-card-2000x2200"), {
      capState: "assembled",
      mode: "cap-on",
      componentTopology: "assembled",
      requiresCapOffReference: false,
    });

    const exception = roleAwareArtifact();
    exception.rows[0].references.pdpCapOffSidecar.topology = "assembled-live-site-exception";
    exception.rows[0].references.pdpCapOffSidecar.approvedException = "live-site-vintage-bulb";
    exception.summary.standardSidecarCount -= 1;
    exception.summary.liveSiteExceptionCount += 1;
    resealRoleArtifact(exception);
    index = buildRoleAwareTestIndex(buildIndex, exception);
    row = getRow(index, "web0", "grace0");
    assert.deepEqual(getGenerationTopology(row, "grid-card-exploded-2000x2200"), {
      capState: "assembled",
      mode: "cap-on",
      componentTopology: "assembled-live-site-exception",
      requiresCapOffReference: false,
    });
  });

  it("fails closed on role blockers, duplicate identities, and artifact contract drift", () => {
    const buildIndex = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).buildCylinderRoleAwareReadinessIndex;
    const getRow = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderRoleAwareReadinessForIdentity;
    const isAuthorized = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).isCylinderReferenceAuthorizedForPreset;
    assert.equal(typeof buildIndex, "function");
    assert.equal(typeof getRow, "function");
    assert.equal(typeof isAuthorized, "function");
    if (
      typeof buildIndex !== "function" ||
      typeof getRow !== "function" ||
      typeof isAuthorized !== "function"
    ) return;

    const blocked = roleAwareArtifact();
    blocked.rows[0].references.pdpCapOffSidecar.productionStatus = "blocked";
    blocked.rows[0].references.pdpCapOffSidecar.blockers = ["sidecar-evidence-missing"];
    resealRoleArtifact(blocked);
    assert.throws(() => buildRoleAwareTestIndex(buildIndex, blocked), /status|summary|derived/i);

    const duplicate = roleAwareArtifact();
    duplicate.rows[1] = duplicate.rows[0];
    resealRoleArtifact(duplicate);
    assert.throws(() => buildRoleAwareTestIndex(buildIndex, duplicate), /Duplicate/);

    const externalWrite = roleAwareArtifact();
    externalWrite.summary.externalWriteCount = 1;
    resealRoleArtifact(externalWrite);
    assert.throws(() => buildRoleAwareTestIndex(buildIndex, externalWrite), /zero external writes/i);

    const publishReady = roleAwareArtifact();
    publishReady.authorization.publishStatus = "publish-ready" as never;
    resealRoleArtifact(publishReady);
    assert.throws(() => buildRoleAwareTestIndex(buildIndex, publishReady), /invalid authorization state/i);
  });

  it("rejects an otherwise exact role when its immutable path is outside the role root", () => {
    const buildIndex = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).buildCylinderRoleAwareReadinessIndex;
    const getRow = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).getCylinderRoleAwareReadinessForIdentity;
    const isAuthorized = (
      cylinderReadiness as unknown as Record<string, unknown>
    ).isCylinderReferenceAuthorizedForPreset;
    assert.equal(typeof buildIndex, "function");
    assert.equal(typeof getRow, "function");
    assert.equal(typeof isAuthorized, "function");
    if (
      typeof buildIndex !== "function" ||
      typeof getRow !== "function" ||
      typeof isAuthorized !== "function"
    ) return;

    const prefixed = roleAwareArtifact();
    const role = prefixed.rows[0].references.pdpCapOffSidecar;
    role.storagePath = `untrusted-prefix/${role.storagePath}`;
    role.publicUrl = `https://example.supabase.co/storage/v1/object/public/reference-images/${role.storagePath}`;
    resealRoleArtifact(prefixed);
    assert.throws(() => buildRoleAwareTestIndex(buildIndex, prefixed), /immutable storage path/i);
  });
});
