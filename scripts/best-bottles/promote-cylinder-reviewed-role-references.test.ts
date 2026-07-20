import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import sharp from "sharp";

import type { CylinderRoleAwareReadinessArtifact } from "../../src/lib/bestBottlesCylinderRoleAuthority";
import type { CylinderCanonicalRosterAuthority } from "../../src/lib/bestBottlesCylinderRoleAuthority";
import {
  buildCylinderCanonicalRosterAuthority,
  buildCylinderRoleAwareReadinessIndex,
} from "../../src/lib/bestBottlesCylinderRoleAuthority";
import { computeCanonicalGeometrySha256 } from "../../src/lib/bestBottlesCylinderDualRoleRunner";
import {
  buildReviewedCylinderRolePromotionPlan,
  executeReviewedCylinderRolePromotion,
  parseReviewedCylinderRolePromotionArgs,
  type ReviewedCylinderRoleCandidate,
} from "./promote-cylinder-reviewed-role-references.ts";

const WEBSITE_SKU = "GBCyl9SpryGl";
const GRACE_SKU = "GB-CYL-CLR-9ML-SPR-GLD";
const IDENTITY = "GBCYL9SPRYGL|GBCYLCLR9MLSPRGLD";
const SOURCE_SHA = "a".repeat(64);
const SIDE_SOURCE_SHA = "e".repeat(64);
const execFileAsync = promisify(execFile);

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(record[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

const OPAQUE_PNG = new Uint8Array(await sharp({
  create: { width: 2080, height: 2288, channels: 4, background: { r: 245, g: 243, b: 239, alpha: 1 } },
}).png().toBuffer());
const OUTPUT_SHA = sha256(OPAQUE_PNG);

function artifact(): CylinderRoleAwareReadinessArtifact {
  const unsigned = {
    version: "best-bottles-cylinder-role-aware-readiness-v2" as const,
    generatedAt: "2026-07-14T12:00:00.000Z",
    provenance: {
      productionReadiness: { path: "roster.json", version: "best-bottles-cylinder-production-readiness-v1", fileSha256: "1".repeat(64) },
      identityCapOn: {
        auditPath: "cap-audit.json", auditVersion: "v1", auditFileSha256: "2".repeat(64), currentAuditSeal: null,
        executionPath: "cap-execution.json", executionVersion: "v1", executionFileSha256: "3".repeat(64), executionSeal: "4".repeat(64), executionAuditSeal: null,
      },
      pdpCapOffSidecar: {
        preflightPath: "sidecar-preflight.json", preflightVersion: "v1", preflightFileSha256: "5".repeat(64), currentAuditPreflightSeal: null,
        executionPath: "sidecar-execution.json", executionVersion: "v1", executionFileSha256: "6".repeat(64), executionSeal: "7".repeat(64), executionPreflightSeal: null,
        sourceManifestPath: "sidecar-source.json", sourceManifestVersion: "v1", sourceManifestSha256: "8".repeat(64),
      },
      livePointerApproval: { path: "live.json", version: "v1", fileSha256: "9".repeat(64), approvalSeal: null },
      recoveryApproval: { path: "recovery.json", version: "v1", fileSha256: "c".repeat(64) },
    },
    authorization: {
      exactEvidenceIdentityCount: 0,
      generationScope: "controlled-studio-only" as const,
      generationStatus: "authorized-for-controlled-generation" as const,
      publishStatus: "not-publish-ready" as const,
      individualContentReviewStatus: "not-individually-content-approved" as const,
      requiredNextGate: "generated-output-qa-and-explicit-publish-approval" as const,
    },
    summary: {
      canonicalIdentityCount: 1,
      identityCapOnVerifiedCount: 0,
      pdpCapOffSidecarVerifiedCount: 0,
      bothRolesVerifiedCount: 0,
      blockedIdentityCount: 1,
      standardSidecarCount: 0,
      liveSiteExceptionCount: 0,
      approvedEvidenceBlockedCount: 0,
      missingApprovedEvidenceBlockedCount: 1,
      externalWriteCount: 0,
    },
    rows: [{
      canonicalIdentityKey: IDENTITY,
      websiteSku: WEBSITE_SKU,
      graceSku: GRACE_SKU,
      status: "blocked",
      blockers: ["roles not promoted"],
      canonical: {
        websiteSku: WEBSITE_SKU,
        graceSku: GRACE_SKU,
        family: "Cylinder",
        capacityMl: "9",
        canon_bodyHeightMm: "70",
        canon_heightWithCapMm: "94",
        canon_widthAxisMm: "20",
        canon_secondAxisMm: "20",
      },
      references: {
        identityCapOn: blockedRole("identity-cap-on", "assembled-cap-on"),
        pdpCapOffSidecar: blockedRole("pdp-cap-off-sidecar", "fitment-attached-cap-right-sidecar"),
      },
      approvedEvidence: { livePointer: null, recovery: null },
    }],
  };
  return { ...unsigned, sha256: sha256(stableJson(unsigned)) };
}

function blockedRole(roleId: "identity-cap-on" | "pdp-cap-off-sidecar", topology: string) {
  return {
    roleId,
    status: "blocked" as const,
    remoteStatus: "blocked" as const,
    sourceReviewStatus: "missing",
    sourceRoute: null,
    productionStatus: "blocked" as const,
    publicUrl: null,
    storagePath: null,
    exportSha256: roleId === "identity-cap-on" ? SOURCE_SHA : SIDE_SOURCE_SHA,
    topology,
    approvedException: null,
    blockers: ["not promoted"],
    width: null,
    height: null,
    opaque: null,
  };
}

function canonicalRoster(): CylinderCanonicalRosterAuthority {
  return {
    version: "best-bottles-cylinder-canonical-roster-v1",
    sourceFileSha256: "1".repeat(64),
    identities: new Set([IDENTITY]),
  };
}

function candidate(overrides: Partial<ReviewedCylinderRoleCandidate> = {}): ReviewedCylinderRoleCandidate {
  const canonical = artifact().rows[0].canonical;
  const roleId = overrides.roleId ?? "identity-cap-on";
  return {
    canonicalIdentityKey: IDENTITY,
    websiteSku: WEBSITE_SKU,
    graceSku: GRACE_SKU,
    roleId,
    source: {
      canonicalIdentityKey: IDENTITY,
      roleId,
      sha256: SOURCE_SHA,
    },
    output: {
      path: "/tmp/reviewed.png",
      sha256: OUTPUT_SHA,
      bytes: OPAQUE_PNG.length,
      width: 2080,
      height: 2288,
      opaque: true,
      canonicalGeometrySha256: computeCanonicalGeometrySha256(canonical),
    },
    review: {
      finalStatus: "approved",
      reviewerId: "reviewer-1",
      reviewedAt: "2026-07-14T13:00:00.000Z",
      canonicalIdentityKey: IDENTITY,
      roleId,
      sourceSha256: SOURCE_SHA,
      outputSha256: OUTPUT_SHA,
      canonicalGeometrySha256: computeCanonicalGeometrySha256(canonical),
      reviewedException: null,
    },
    topology: roleId === "identity-cap-on"
      ? "assembled-cap-on"
      : "fitment-attached-cap-right-sidecar",
    approvedException: null,
    ...overrides,
  };
}

async function build(
  candidates: ReviewedCylinderRoleCandidate[],
  remoteObjects: Array<{ path: string; status: "absent" | "present"; sha256?: string; bytes?: number }> = [],
  localBytes: Uint8Array = OPAQUE_PNG,
) {
  return buildReviewedCylinderRolePromotionPlan({
    roleAwareArtifact: artifact(),
    canonicalRoster: canonicalRoster(),
    candidates,
    remoteObjects,
    bucket: "reference-images",
    supabaseUrl: "https://project.supabase.co",
    generatedAt: "2026-07-14T14:00:00.000Z",
    readLocalFile: async () => localBytes,
  });
}

describe("reviewed Cylinder role promotion", () => {
  it("is dry-run by default and requires an explicit --execute flag", () => {
    assert.equal(parseReviewedCylinderRolePromotionArgs([]).mode, "dry-run");
    assert.equal(parseReviewedCylinderRolePromotionArgs(["--execute"]).mode, "execute");
    assert.throws(() => parseReviewedCylinderRolePromotionArgs(["--apply"]), /unknown argument/i);
  });

  it("executes its CLI entry point and fails closed when required reviewed inputs are absent", async () => {
    await assert.rejects(
      execFileAsync(process.execPath, [
        "--import", "tsx",
        fileURLToPath(new URL("./promote-cylinder-reviewed-role-references.ts", import.meta.url)),
      ]),
      /--candidates, --role-artifact, and --canonical-roster are required/i,
    );
  });

  it("rejects review-pending and normalized-shadow-review-required final states", async () => {
    for (const finalStatus of ["review-pending", "normalized-shadow-review-required"]) {
      const value = candidate();
      value.review.finalStatus = finalStatus;
      await assert.rejects(build([value]), /final approved or reviewed state/i);
    }
  });

  it("rejects cross-role review records and canonical-geometry hash drift", async () => {
    const crossed = candidate();
    crossed.review.roleId = "pdp-cap-off-sidecar";
    await assert.rejects(build([crossed]), /role.*disagrees/i);

    const staleGeometry = candidate();
    staleGeometry.review.canonicalGeometrySha256 = "d".repeat(64);
    await assert.rejects(build([staleGeometry]), /canonical geometry/i);
  });

  it("rejects arbitrary and stale source hashes even when candidate and review agree", async () => {
    const arbitrary = candidate();
    arbitrary.source.sha256 = "d".repeat(64);
    arbitrary.review.sourceSha256 = "d".repeat(64);
    await assert.rejects(build([arbitrary]), /sealed selected source role hash/i);

    const crossRole = candidate();
    crossRole.source.sha256 = SIDE_SOURCE_SHA;
    crossRole.review.sourceSha256 = SIDE_SOURCE_SHA;
    await assert.rejects(build([crossRole]), /sealed selected source role hash/i);
  });

  it("fails closed on an occupied immutable path with different bytes", async () => {
    const initial = await build([candidate()]);
    const path = initial.rows[0].storage.path;
    const plan = await build([candidate()], [{
      path,
      status: "present",
      sha256: "f".repeat(64),
      bytes: 99,
    }]);
    assert.equal(plan.rows[0].decision, "blocked");
    assert.deepEqual(plan.rows[0].blockers, ["immutable-path-byte-collision"]);
  });

  it("reuses exact immutable bytes without uploading and rebuilds only the reviewed role", async () => {
    const bytes = OPAQUE_PNG;
    const reviewed = candidate({
      output: {
        ...candidate().output,
        sha256: sha256(bytes),
        bytes: bytes.length,
      },
      review: {
        ...candidate().review,
        outputSha256: sha256(bytes),
      },
    });
    const initial = await build([reviewed], [], bytes);
    const path = initial.rows[0].storage.path;
    const plan = await build([reviewed], [{ path, status: "present", sha256: sha256(bytes), bytes: bytes.length }], bytes);
    let uploadCount = 0;
    const result = await executeReviewedCylinderRolePromotion(plan, {
      readLocalFile: async () => bytes,
      inspectRemote: async () => ({ status: "present", bytes }),
      uploadImmutable: async () => { uploadCount += 1; },
    });

    assert.equal(uploadCount, 0);
    assert.equal(result.summary.reusedCount, 1);
    const row = result.roleAwareArtifact.rows[0];
    assert.equal(row.references.identityCapOn.roleId, "identity-cap-on");
    assert.equal(row.references.identityCapOn.exportSha256, sha256(bytes));
    assert.equal(row.references.pdpCapOffSidecar.productionStatus, "blocked");
    assert.equal(row.status, "blocked");
  });

  it("uploads absent objects with immutable no-upsert semantics and verifies exact readback", async () => {
    const bytes = OPAQUE_PNG;
    const reviewed = candidate({
      output: { ...candidate().output, sha256: sha256(bytes), bytes: bytes.length },
      review: { ...candidate().review, outputSha256: sha256(bytes) },
    });
    const plan = await build([reviewed], [], bytes);
    let present = false;
    let uploadOptions: unknown = null;
    const result = await executeReviewedCylinderRolePromotion(plan, {
      readLocalFile: async () => bytes,
      inspectRemote: async () => present ? { status: "present", bytes } : { status: "absent" },
      uploadImmutable: async (_bucket, _path, uploaded, options) => {
        assert.deepEqual(uploaded, bytes);
        uploadOptions = options;
        present = true;
      },
    });
    assert.deepEqual(uploadOptions, { contentType: "image/png", upsert: false });
    assert.equal(result.summary.uploadedCount, 1);
  });

  it("derives PNG format, opacity, and exact dimensions from local bytes", async () => {
    const jpeg = new Uint8Array(await sharp({
      create: { width: 2080, height: 2288, channels: 3, background: "white" },
    }).jpeg().toBuffer());
    const transparent = new Uint8Array(await sharp({
      create: { width: 2080, height: 2288, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer());
    const wrongSize = new Uint8Array(await sharp({
      create: { width: 1000, height: 1300, channels: 4, background: { r: 245, g: 243, b: 239, alpha: 1 } },
    }).png().toBuffer());
    for (const [label, bytes, expected] of [
      ["JPEG", jpeg, /PNG/i],
      ["transparent PNG", transparent, /opaque/i],
      ["wrong-size PNG", wrongSize, /2080x2288/i],
    ] as const) {
      const value = candidate();
      value.output.sha256 = sha256(bytes);
      value.output.bytes = bytes.length;
      value.review.outputSha256 = sha256(bytes);
      await assert.rejects(build([value], [], bytes), expected, label);
    }
  });

  it("requires a separately final-reviewed, hash-bound topology exception", async () => {
    const sidecar = candidate({
      roleId: "pdp-cap-off-sidecar",
      source: { canonicalIdentityKey: IDENTITY, roleId: "pdp-cap-off-sidecar", sha256: SIDE_SOURCE_SHA },
      review: {
        ...candidate().review,
        roleId: "pdp-cap-off-sidecar",
        sourceSha256: SIDE_SOURCE_SHA,
        reviewedException: null,
      },
      topology: "assembled-live-site-exception",
      approvedException: "live-site-vintage-bulb",
    });
    await assert.rejects(build([sidecar]), /separately.*reviewed exception/i);

    sidecar.review.reviewedException = {
      status: "approved",
      approvedException: "live-site-genuine-two-piece",
      reviewerId: "exception-reviewer",
      reviewedAt: "2026-07-14T13:30:00.000Z",
      sourceSha256: SIDE_SOURCE_SHA,
      outputSha256: OUTPUT_SHA,
      canonicalGeometrySha256: sidecar.output.canonicalGeometrySha256,
    };
    await assert.rejects(build([sidecar]), /exception enum/i);
    sidecar.review.reviewedException.approvedException = "live-site-vintage-bulb";
    sidecar.review.reviewedException.status = "review-pending" as never;
    await assert.rejects(build([sidecar]), /reviewed exception is not approved/i);
  });

  it("can replace a raw live-PDP role in the sealed current artifact without authorizing that raw role", async () => {
    const published = JSON.parse(await readFile(
      new URL("../../public/data/best-bottles-cylinder-sidecar-promotion.json", import.meta.url),
      "utf8",
    )) as CylinderRoleAwareReadinessArtifact;
    const rosterBytes = await readFile(new URL(
      "../../public/data/best-bottles-cylinder-production-readiness.json",
      import.meta.url,
    ));
    // The published artifact no longer carries raw live-PDP routes: unreviewed
    // rows are blocked and the reviewed 3 mL lane rides
    // reviewed-immutable-sidecar-remediation. Reconstruct the pre-review state
    // of that lane (raw route, pending review) and reseal, so this test keeps
    // proving the raw -> reviewed replacement flow end to end.
    const reviewedRow = published.rows.find((row) => (
      row.references.pdpCapOffSidecar.sourceRoute === "reviewed-immutable-sidecar-remediation"
    ));
    assert.ok(reviewedRow, "published artifact must carry the reviewed 3 mL sidecar lane");
    reviewedRow.references.pdpCapOffSidecar.sourceRoute = "exact-live-pdp-sidecar";
    reviewedRow.references.pdpCapOffSidecar.sourceReviewStatus = "pending";
    delete (reviewedRow.references.pdpCapOffSidecar as { reviewedOutputSha256?: string | null }).reviewedOutputSha256;
    const { sha256: _publishedSeal, ...unsignedCurrent } = published;
    const current = {
      ...unsignedCurrent,
      sha256: sha256(stableJson(unsignedCurrent)),
    } as CylinderRoleAwareReadinessArtifact;
    const roster = buildCylinderCanonicalRosterAuthority(current, rosterBytes);
    const raw = current.rows.find((row) => row.references.pdpCapOffSidecar.sourceRoute === "exact-live-pdp-sidecar");
    assert.ok(raw, "reconstructed artifact must expose the raw live-PDP remediation lane");
    const geometrySha = computeCanonicalGeometrySha256(raw.canonical);
    const reviewedBytes = OPAQUE_PNG;
    const reviewedSha = sha256(reviewedBytes);
    assert.ok(raw.references.pdpCapOffSidecar.exportSha256);
    const rawSourceSha = raw.references.pdpCapOffSidecar.exportSha256;
    const reviewed: ReviewedCylinderRoleCandidate = {
      canonicalIdentityKey: raw.canonicalIdentityKey,
      websiteSku: raw.websiteSku,
      graceSku: raw.graceSku,
      roleId: "pdp-cap-off-sidecar",
      source: { canonicalIdentityKey: raw.canonicalIdentityKey, roleId: "pdp-cap-off-sidecar", sha256: rawSourceSha },
      output: { path: "/tmp/reviewed-sidecar.png", sha256: reviewedSha, bytes: reviewedBytes.length, width: 2080, height: 2288, opaque: true, canonicalGeometrySha256: geometrySha },
      review: {
        finalStatus: "approved", reviewerId: "reviewer-1", reviewedAt: "2026-07-14T13:00:00.000Z",
        canonicalIdentityKey: raw.canonicalIdentityKey, roleId: "pdp-cap-off-sidecar",
        sourceSha256: rawSourceSha, outputSha256: reviewedSha, canonicalGeometrySha256: geometrySha,
        reviewedException: null,
      },
      topology: "fitment-attached-cap-right-sidecar",
      approvedException: null,
    };
    const plan = await buildReviewedCylinderRolePromotionPlan({
      roleAwareArtifact: current,
      canonicalRoster: roster,
      candidates: [reviewed],
      remoteObjects: [],
      bucket: "reference-images",
      supabaseUrl: "https://project.supabase.co",
      generatedAt: "2026-07-14T14:00:00.000Z",
      readLocalFile: async () => reviewedBytes,
    });
    assert.equal(plan.rows[0].decision, "ready-to-upload");
    let uploaded = false;
    const execution = await executeReviewedCylinderRolePromotion(plan, {
      readLocalFile: async () => reviewedBytes,
      inspectRemote: async () => uploaded ? { status: "present", bytes: reviewedBytes } : { status: "absent" },
      uploadImmutable: async () => { uploaded = true; },
    });
    const rebuilt = buildCylinderRoleAwareReadinessIndex(execution.roleAwareArtifact, roster);
    assert.equal(rebuilt.size, current.rows.length);
    assert.equal(rebuilt.get(raw.canonicalIdentityKey)?.references.pdpCapOffSidecar.sourceRoute, "reviewed-immutable-sidecar-remediation");
    assert.ok([...rebuilt.values()].filter((row) => row.references.pdpCapOffSidecar.sourceRoute === "exact-live-pdp-sidecar").length === 0);
  });
});
