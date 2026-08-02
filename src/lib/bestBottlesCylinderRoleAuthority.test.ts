import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildCylinderRoleAwareReadinessIndex,
  buildCylinderCanonicalRosterAuthority,
  buildCylinderRoleGenerationAuthority,
  invokeWithCylinderVerifiedReference,
  resolveCylinderImmutableReferenceForPreset,
  verifyCylinderImmutableReferenceBytesForPreset,
  type CylinderRoleAwareReadinessArtifact,
  type CylinderRoleAwareReadinessRow,
} from "./bestBottlesCylinderRoleAuthority";

const capHash = "a".repeat(64);
const sidecarHash = "b".repeat(64);
const rosterBytesByArtifact = new WeakMap<CylinderRoleAwareReadinessArtifact, Uint8Array>();

function pngBytes(width = 1000, height = 1300, marker = 0): Uint8Array {
  const bytes = new Uint8Array(25);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = marker;
  return bytes;
}

function rolePath(role: "identity-cap-on" | "pdp-cap-off-sidecar", hash: string): string {
  const root = role === "identity-cap-on"
    ? "best-bottles/production-references/cylinder/v1"
    : "best-bottles/production-references/cylinder/sidecar-v2";
  return `${root}/${hash.slice(0, 2)}/WEB__GRACE__${hash}.png`;
}

function row(): CylinderRoleAwareReadinessRow {
  const capPath = rolePath("identity-cap-on", capHash);
  const sidecarPath = rolePath("pdp-cap-off-sidecar", sidecarHash);
  return {
    canonicalIdentityKey: "WEB|GRACE",
    websiteSku: "Web",
    graceSku: "Grace",
    status: "both-roles-verified",
    blockers: [],
    canonical: {
      websiteSku: "Web",
      graceSku: "Grace",
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
        roleId: "identity-cap-on",
        remoteStatus: "verified",
        sourceReviewStatus: "approved",
        sourceRoute: "production-readiness-cap-on",
        productionStatus: "generation-authorized",
        publicUrl: `https://example.supabase.co/storage/v1/object/public/reference-images/${capPath}`,
        storagePath: capPath,
        exportSha256: capHash,
        topology: "assembled-cap-on",
        approvedException: null,
        blockers: [],
        opaque: true,
      },
      pdpCapOffSidecar: {
        roleId: "pdp-cap-off-sidecar",
        remoteStatus: "verified",
        sourceReviewStatus: "approved",
        sourceRoute: "reviewed-immutable-sidecar-remediation",
        productionStatus: "generation-authorized",
        publicUrl: `https://example.supabase.co/storage/v1/object/public/reference-images/${sidecarPath}`,
        storagePath: sidecarPath,
        exportSha256: sidecarHash,
        reviewedOutputSha256: sidecarHash,
        topology: "fitment-attached-cap-right-sidecar",
        approvedException: null,
        blockers: [],
        opaque: true,
      },
    },
    approvedEvidence: { livePointer: null, recovery: null },
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

function seal<T extends Omit<CylinderRoleAwareReadinessArtifact, "sha256">>(unsigned: T): CylinderRoleAwareReadinessArtifact {
  return {
    ...unsigned,
    sha256: createHash("sha256").update(stableJson(unsigned)).digest("hex"),
  } as CylinderRoleAwareReadinessArtifact;
}

function artifact(rows = [row()]): CylinderRoleAwareReadinessArtifact {
  const productionRosterBytes = new TextEncoder().encode(JSON.stringify({
    version: "best-bottles-cylinder-production-readiness-v1",
    summary: { canonicalIdentityCount: rows.length },
    rows: rows.map((entry) => ({
      canonicalIdentityKey: entry.canonicalIdentityKey,
      websiteSku: entry.websiteSku,
      graceSku: entry.graceSku,
      canonical: {
        websiteSku: entry.canonical.websiteSku,
        graceSku: entry.canonical.graceSku,
      },
    })),
  }));
  const result = seal({
    version: "best-bottles-cylinder-role-aware-readiness-v2",
    generatedAt: "2026-07-14T00:00:00.000Z",
    provenance: {
      productionReadiness: {
        path: "public/data/readiness.json",
        version: "best-bottles-cylinder-production-readiness-v1",
        fileSha256: createHash("sha256").update(productionRosterBytes).digest("hex"),
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
      canonicalIdentityCount: rows.length,
      identityCapOnVerifiedCount: rows.length,
      pdpCapOffSidecarVerifiedCount: rows.length,
      bothRolesVerifiedCount: rows.length,
      blockedIdentityCount: 0,
      standardSidecarCount: rows.length,
      liveSiteExceptionCount: 0,
      approvedEvidenceBlockedCount: 0,
      missingApprovedEvidenceBlockedCount: 0,
      externalWriteCount: 0,
    },
    authorization: {
      exactEvidenceIdentityCount: rows.length,
      generationScope: "controlled-studio-only",
      generationStatus: "authorized-for-controlled-generation",
      publishStatus: "not-publish-ready",
      individualContentReviewStatus: "not-individually-content-approved",
      requiredNextGate: "generated-output-qa-and-explicit-publish-approval",
    },
    rows,
  });
  rosterBytesByArtifact.set(result, productionRosterBytes);
  return result;
}

function buildTestIndex(value: CylinderRoleAwareReadinessArtifact) {
  const bytes = rosterBytesByArtifact.get(value);
  if (!bytes) throw new Error("Missing independent test roster bytes.");
  return buildCylinderRoleAwareReadinessIndex(
    value,
    buildCylinderCanonicalRosterAuthority(value, bytes),
  );
}

function reseal(value: CylinderRoleAwareReadinessArtifact): void {
  const { sha256: _ignored, ...unsigned } = value;
  value.sha256 = createHash("sha256").update(stableJson(unsigned)).digest("hex");
}

describe("Cylinder immutable role authority", () => {
  it("derives totals from the artifact and selects the same exact role URL and SHA by preset", () => {
    const index = buildTestIndex(artifact());
    const exact = index.get("WEB|GRACE");
    const capOn = resolveCylinderImmutableReferenceForPreset(exact, "grid-card-2000x2200");
    const sidecar = resolveCylinderImmutableReferenceForPreset(exact, "grid-card-exploded-2000x2200");

    assert.deepEqual(
      { role: capOn?.roleId, url: capOn?.publicUrl, sha: capOn?.exportSha256 },
      { role: "identity-cap-on", url: exact?.references.identityCapOn.publicUrl, sha: capHash },
    );
    assert.deepEqual(
      { role: sidecar?.roleId, url: sidecar?.publicUrl, sha: sidecar?.exportSha256 },
      { role: "pdp-cap-off-sidecar", url: exact?.references.pdpCapOffSidecar.publicUrl, sha: sidecarHash },
    );
  });

  it("fails closed when artifact-derived totals do not match the rows", () => {
    const invalid = artifact();
    invalid.summary.bothRolesVerifiedCount = 2;
    reseal(invalid);
    assert.throws(() => buildTestIndex(invalid), /summary|derived/i);
  });

  it("fails closed when rows are missing or the producer seal is tampered", () => {
    const missing = artifact();
    missing.rows = [];
    missing.summary.canonicalIdentityCount = 0;
    missing.summary.identityCapOnVerifiedCount = 0;
    missing.summary.pdpCapOffSidecarVerifiedCount = 0;
    missing.summary.bothRolesVerifiedCount = 0;
    missing.summary.blockedIdentityCount = 0;
    missing.summary.standardSidecarCount = 0;
    missing.authorization.exactEvidenceIdentityCount = 0;
    reseal(missing);
    assert.throws(() => buildTestIndex(missing), /canonical production roster|incomplete/i);

    const tampered = artifact();
    tampered.summary.approvedEvidenceBlockedCount = 99;
    assert.throws(() => buildTestIndex(tampered), /seal/i);
  });

  it("validates all blocked-evidence summary fields from rows", () => {
    const blockedRow = row();
    blockedRow.status = "blocked";
    blockedRow.references.pdpCapOffSidecar.remoteStatus = "unverified";
    blockedRow.references.pdpCapOffSidecar.productionStatus = "blocked";
    blockedRow.references.pdpCapOffSidecar.blockers = ["blocked"];
    blockedRow.approvedEvidence.livePointer = { identityDecision: "approved" };
    const invalid = artifact([blockedRow]);
    invalid.summary.pdpCapOffSidecarVerifiedCount = 0;
    invalid.summary.bothRolesVerifiedCount = 0;
    invalid.summary.blockedIdentityCount = 1;
    invalid.summary.standardSidecarCount = 0;
    invalid.summary.approvedEvidenceBlockedCount = 0;
    invalid.authorization.exactEvidenceIdentityCount = 0;
    reseal(invalid);
    assert.throws(() => buildTestIndex(invalid), /approvedEvidenceBlockedCount|summary/i);
  });

  it("rejects raw exact-live-pdp-sidecar evidence even when marked verified", () => {
    const invalid = artifact();
    invalid.rows[0].references.pdpCapOffSidecar.sourceRoute = "exact-live-pdp-sidecar";
    reseal(invalid);
    assert.throws(() => buildTestIndex(invalid), /live-pdp|remediation/i);
  });

  it("accepts reviewed immutable remediation only when reviewed output and immutable role SHA match", () => {
    const invalid = artifact();
    invalid.rows[0].references.pdpCapOffSidecar.reviewedOutputSha256 = "c".repeat(64);
    reseal(invalid);
    assert.throws(() => buildTestIndex(invalid), /reviewed output|sha/i);
  });

  it("rejects reviewed remediation whose final review state is still pending", () => {
    const invalid = artifact();
    invalid.rows[0].references.pdpCapOffSidecar.sourceReviewStatus = "pending";
    reseal(invalid);
    assert.throws(() => buildTestIndex(invalid), /approved|reviewed|final state/i);
  });

  it("requires the fetched generation input bytes to match the selected immutable role SHA", () => {
    const exact = buildTestIndex(artifact()).get("WEB|GRACE");
    assert.throws(
      () => buildCylinderRoleGenerationAuthority(exact, "grid-card-exploded-2000x2200", "c".repeat(64)),
      /actual input|hash mismatch/i,
    );
    const authority = buildCylinderRoleGenerationAuthority(
      exact,
      "grid-card-exploded-2000x2200",
      sidecarHash,
    );
    assert.equal(authority.referenceRoleId, "pdp-cap-off-sidecar");
    assert.equal(authority.componentTopology, "fitment-attached-cap-right-sidecar");
  });

  it("fetches and hashes the actual immutable bytes before authorizing Studio generation", async () => {
    const bytes = pngBytes(1000, 1300, 1);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const valid = artifact();
    const reference = valid.rows[0].references.pdpCapOffSidecar;
    const path = rolePath("pdp-cap-off-sidecar", hash);
    reference.exportSha256 = hash;
    reference.reviewedOutputSha256 = hash;
    reference.storagePath = path;
    reference.publicUrl = `https://example.supabase.co/storage/v1/object/public/reference-images/${path}`;
    reseal(valid);
    const exact = buildTestIndex(valid).get("WEB|GRACE");
    let fetchCalls = 0;
    const verified = await verifyCylinderImmutableReferenceBytesForPreset(
      exact,
      "grid-card-exploded-2000x2200",
      reference.publicUrl,
      async () => {
        fetchCalls += 1;
        return new Response(bytes, { status: 200 });
      },
    );
    assert.equal(fetchCalls, 1, "the authorized generation payload must come from one exact byte fetch");
    assert.equal(verified.sha256, hash);
    assert.deepEqual({ width: verified.width, height: verified.height }, { width: 1000, height: 1300 });
    assert.equal(verified.lineageUrl, reference.publicUrl);
    assert.deepEqual(
      Buffer.from(verified.dataUrl.split(",")[1], "base64"),
      Buffer.from(bytes),
      "the generation data URL must contain the exact bytes that were hash-verified",
    );
    await assert.rejects(
      verifyCylinderImmutableReferenceBytesForPreset(
        exact,
        "grid-card-exploded-2000x2200",
        reference.publicUrl,
        async () => new Response("different", { status: 200 }),
      ),
      /hash mismatch/i,
    );
  });

  it("passes the exact verifier-produced payload object to generation after verification", async () => {
    const bytes = pngBytes(1000, 1300, 2);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const valid = artifact();
    const reference = valid.rows[0].references.pdpCapOffSidecar;
    const path = rolePath("pdp-cap-off-sidecar", hash);
    reference.exportSha256 = hash;
    reference.reviewedOutputSha256 = hash;
    reference.storagePath = path;
    reference.publicUrl = `https://example.supabase.co/storage/v1/object/public/reference-images/${path}`;
    reseal(valid);
    const exact = buildTestIndex(valid).get("WEB|GRACE");
    const verified = await verifyCylinderImmutableReferenceBytesForPreset(
      exact,
      "grid-card-exploded-2000x2200",
      reference.publicUrl,
      async () => new Response(bytes, { status: 200 }),
    );
    const events: string[] = [];
    const result = await invokeWithCylinderVerifiedReference({
      row: exact,
      presetId: "grid-card-exploded-2000x2200",
      referenceUrl: reference.publicUrl,
      verifyReference: async () => {
        events.push("verify");
        return verified;
      },
      invoke: async (received) => {
        events.push("invoke");
        assert.strictEqual(received, verified, "generation must receive the verifier's exact object");
        assert.strictEqual(received.dataUrl, verified.dataUrl);
        return received.dataUrl;
      },
    });
    assert.deepEqual(events, ["verify", "invoke"]);
    assert.strictEqual(result, verified.dataUrl);
  });

  it("reuses a batch-preverified payload without a second fetch or object replacement", async () => {
    const bytes = pngBytes(1000, 1300, 3);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const valid = artifact();
    const reference = valid.rows[0].references.pdpCapOffSidecar;
    const path = rolePath("pdp-cap-off-sidecar", hash);
    reference.exportSha256 = hash;
    reference.reviewedOutputSha256 = hash;
    reference.storagePath = path;
    reference.publicUrl = `https://example.supabase.co/storage/v1/object/public/reference-images/${path}`;
    reseal(valid);
    const exact = buildTestIndex(valid).get("WEB|GRACE");
    const verified = await verifyCylinderImmutableReferenceBytesForPreset(
      exact,
      "grid-card-exploded-2000x2200",
      reference.publicUrl,
      async () => new Response(bytes, { status: 200 }),
    );
    let verifierCalls = 0;
    const received = await invokeWithCylinderVerifiedReference({
      row: exact,
      presetId: "grid-card-exploded-2000x2200",
      referenceUrl: reference.publicUrl,
      preverified: verified,
      verifyReference: async () => {
        verifierCalls += 1;
        throw new Error("batch generation must not refetch a preverified payload");
      },
      invoke: async (payload) => payload,
    });
    assert.equal(verifierCalls, 0);
    assert.strictEqual(received, verified);
  });

  it("rejects malformed immutable paths and non-opaque authorized references", () => {
    const malformed = artifact();
    malformed.rows[0].references.identityCapOn.storagePath = "mutable/latest.png";
    reseal(malformed);
    assert.throws(() => buildTestIndex(malformed), /immutable|storage path/i);

    const transparent = artifact();
    transparent.rows[0].references.pdpCapOffSidecar.opaque = null;
    reseal(transparent);
    assert.throws(() => buildTestIndex(transparent), /opaque/i);
  });
});
