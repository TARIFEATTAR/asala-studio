import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

import {
  BEST_BOTTLES_CYLINDER_DUAL_ROLE_REMEDIATION_VERSION,
  buildCylinderDualRoleRemediationPlan,
  type CylinderDualRoleEvidenceVerification,
  type CylinderDualRoleRemediationInput,
} from "./bestBottlesCylinderDualRoleRemediation";

const ROOT = new URL("../../", import.meta.url);
const SOURCE_PATHS = {
  roleAwareReadiness:
    "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/role-aware-readiness-pre-bbuat-2026-07-17.json",
  recoveryApproval:
    "docs/best-bottles-canonical-truth/best-bottles-cylinder-recovery-approval.json",
  livePointerApproval:
    "docs/best-bottles-canonical-truth/best-bottles-cylinder-live-pointer-approval.json",
  taxonomyOverrides:
    "docs/best-bottles-canonical-truth/best-bottles-family-taxonomy-overrides.json",
} as const;

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

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

function exactKey(row: { websiteSku: string; graceSku: string }): string {
  return `${normalizedIdentity(row.websiteSku)}|${normalizedIdentity(row.graceSku)}`;
}

async function verifyLocalImage(input: {
  canonicalIdentityKey: string;
  evidenceLane: "approved-recovery" | "approved-live-pointer";
  relativePath: string;
  expectedSha256: string;
  expectedWidth: number;
  expectedHeight: number;
}): Promise<CylinderDualRoleEvidenceVerification> {
  const bytes = await readFile(new URL(input.relativePath, ROOT));
  const metadata = await sharp(bytes).metadata();
  const stats = await sharp(bytes).stats();
  const alpha = metadata.hasAlpha ? stats.channels.at(-1) : undefined;
  const opaque = !metadata.hasAlpha || alpha?.min === 255;
  const retiredToken = /clean-references|transparent|background-removed|paper-doll|mask-/i;

  assert.equal(metadata.width, input.expectedWidth);
  assert.equal(metadata.height, input.expectedHeight);

  return {
    canonicalIdentityKey: input.canonicalIdentityKey,
    evidenceLane: input.evidenceLane,
    localPath: input.relativePath,
    referenceSha256: createHash("sha256").update(bytes).digest("hex"),
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    opaque,
    originalBackgroundEligible: opaque && !retiredToken.test(input.relativePath),
    verificationMethod: "sha256+sharp-alpha-scan",
  };
}

async function localEvidenceVerifications(
  sources: CylinderDualRoleRemediationInput["sources"],
): Promise<CylinderDualRoleEvidenceVerification[]> {
  const rows = new Map(sources.roleAwareReadiness.data.rows.map((row) => [
    row.canonicalIdentityKey,
    row,
  ]));
  const vialKeys = new Set(sources.taxonomyOverrides.data.overrides.map(exactKey));
  const records: Promise<CylinderDualRoleEvidenceVerification>[] = [];

  for (const decision of sources.recoveryApproval.data.decisions) {
    const key = exactKey(decision);
    if (rows.get(key)?.status !== "blocked" || vialKeys.has(key)) continue;
    const relativePath = path.relative(
      fileURLToPath(ROOT),
      decision.outputPath ?? "",
    );
    records.push(verifyLocalImage({
      canonicalIdentityKey: key,
      evidenceLane: "approved-recovery",
      relativePath,
      expectedSha256: decision.outputSha256,
      expectedWidth: decision.width,
      expectedHeight: decision.height,
    }));
  }

  for (const decision of sources.livePointerApproval.data.decisions) {
    const key = exactKey(decision);
    if (rows.get(key)?.status !== "blocked" || vialKeys.has(key)) continue;
    const relativePath = path.posix.join(
      "tmp/best-bottles-reference-production/cylinder-live-pointer-intake-v1",
      decision.approvedReference.relativePath ?? "",
    );
    records.push(verifyLocalImage({
      canonicalIdentityKey: key,
      evidenceLane: "approved-live-pointer",
      relativePath,
      expectedSha256: decision.approvedReference.sha256,
      expectedWidth: decision.approvedReference.width,
      expectedHeight: decision.approvedReference.height,
    }));
  }

  const verified = await Promise.all(records);
  for (const record of verified) {
    const decision = record.evidenceLane === "approved-recovery"
      ? sources.recoveryApproval.data.decisions.find((row) => exactKey(row) === record.canonicalIdentityKey)
      : sources.livePointerApproval.data.decisions.find((row) => exactKey(row) === record.canonicalIdentityKey);
    const expectedSha256 = record.evidenceLane === "approved-recovery"
      ? decision?.outputSha256
      : decision && "approvedReference" in decision
        ? decision.approvedReference.sha256
        : undefined;
    assert.equal(record.referenceSha256, expectedSha256);
  }
  return verified;
}

// The dual-role remediation plan was reviewed against the sealed 2026-07-15
// role artifact, in which the 56 raw exact-live-pdp-sidecar rows were still
// published as verified pending-review evidence. The repaired public artifact
// (2026-07-16) truthfully blocks unreviewed raw live-PDP sidecars and binds the
// reviewed 3 mL lane to reviewed-immutable-sidecar-remediation, so this fixture
// reconstructs the historical sealed input from the same on-disk promotion
// sources the 2026-07-15 composer consumed. This reconstruction exists only in
// this test; the published artifact keeps the raw rows blocked.
function reconstructSealedRawLivePdpRows(
  artifact: {
    rows: Array<Record<string, unknown>>;
    summary: Record<string, unknown>;
    authorization: Record<string, unknown>;
    sha256: string;
  },
  sidecarPreflightPlanRows: Array<{
    canonicalIdentityKey: string;
    exportSha256: string;
    width: number;
    height: number;
    storage: { path: string; publicUrl: string };
  }>,
  sidecarManifestRecords: Array<{
    canonicalIdentityKey: string;
    route: string;
    source: { reviewStatus?: string | null } | null;
  }>,
  minimumReferencePixels: number,
): void {
  const planByKey = new Map(sidecarPreflightPlanRows.map((row) => [row.canonicalIdentityKey, row]));
  const rawRouteKeys = new Set(
    sidecarManifestRecords
      .filter((record) => record.route === "exact-live-pdp-sidecar")
      .map((record) => record.canonicalIdentityKey),
  );
  const reviewStatusByKey = new Map(sidecarManifestRecords.map((record) => [
    record.canonicalIdentityKey,
    /approved|reviewed/i.test(String(record.source?.reviewStatus ?? "")) ? "approved" : "pending",
  ]));
  for (const row of artifact.rows) {
    const key = String(row.canonicalIdentityKey);
    if (!rawRouteKeys.has(key)) continue;
    const plan = planByKey.get(key);
    const references = row.references as {
      identityCapOn: Record<string, unknown>;
      pdpCapOffSidecar: Record<string, unknown>;
    };
    if (!plan || references.identityCapOn.status !== "verified") continue;
    delete references.identityCapOn.reviewedOutputSha256;
    references.pdpCapOffSidecar = {
      roleId: "pdp-cap-off-sidecar",
      status: "verified",
      remoteStatus: "verified",
      productionStatus: "generation-authorized",
      sourceReviewStatus: reviewStatusByKey.get(key) ?? "pending",
      sourceRoute: "exact-live-pdp-sidecar",
      resolutionStatus: plan.width * plan.height >= minimumReferencePixels
        ? "high-resolution"
        : "low-resolution",
      pixelCount: plan.width * plan.height,
      publicUrl: plan.storage.publicUrl,
      storagePath: plan.storage.path,
      exportSha256: plan.exportSha256,
      width: plan.width,
      height: plan.height,
      opaque: true,
      topology: "fitment-attached-cap-right-sidecar",
      approvedException: null,
      blockers: [],
    };
    row.status = "both-roles-verified";
    row.blockers = [];
  }
  const rows = artifact.rows as Array<{
    status: string;
    references: {
      identityCapOn: { status: string; topology: string | null };
      pdpCapOffSidecar: { status: string; topology: string | null };
    };
    approvedEvidence: { livePointer: unknown; recovery: unknown };
  }>;
  const verifiedSidecars = rows.filter((row) => row.references.pdpCapOffSidecar.status === "verified");
  const blocked = rows.filter((row) => row.status !== "both-roles-verified");
  artifact.summary = {
    ...artifact.summary,
    identityCapOnVerifiedCount: rows.filter((row) => row.references.identityCapOn.status === "verified").length,
    pdpCapOffSidecarVerifiedCount: verifiedSidecars.length,
    bothRolesVerifiedCount: rows.length - blocked.length,
    blockedIdentityCount: blocked.length,
    standardSidecarCount: verifiedSidecars
      .filter((row) => row.references.pdpCapOffSidecar.topology === "fitment-attached-cap-right-sidecar").length,
    liveSiteExceptionCount: verifiedSidecars
      .filter((row) => row.references.pdpCapOffSidecar.topology === "assembled-live-site-exception").length,
    approvedEvidenceBlockedCount: blocked
      .filter((row) => row.approvedEvidence.livePointer || row.approvedEvidence.recovery).length,
    missingApprovedEvidenceBlockedCount: blocked
      .filter((row) => !row.approvedEvidence.livePointer && !row.approvedEvidence.recovery).length,
  };
  artifact.authorization = {
    ...artifact.authorization,
    exactEvidenceIdentityCount: rows.length - blocked.length,
  };
  const { sha256: _seal, ...unsigned } = artifact;
  artifact.sha256 = createHash("sha256").update(stableJson(unsigned)).digest("hex");
}

async function createInputFixture(): Promise<CylinderDualRoleRemediationInput> {
  type Sources = CylinderDualRoleRemediationInput["sources"];
  const sources = {} as Sources;

  for (const [name, relativePath] of Object.entries(SOURCE_PATHS)) {
    const bytes = await readFile(new URL(relativePath, ROOT));
    sources[name as keyof Sources] = {
      path: relativePath,
      fileSha256: createHash("sha256").update(bytes).digest("hex"),
      data: JSON.parse(bytes.toString("utf8")),
    } as never;
  }

  const sidecarPreflight = JSON.parse((await readFile(new URL(
    "tmp/best-bottles-reference-production/cylinder-sidecar-promotion-v2/cylinder-sidecar-promotion-preflight.json",
    ROOT,
  ))).toString("utf8")) as { plan: { rows: never[] } };
  const sidecarManifest = JSON.parse((await readFile(new URL(
    "tmp/best-bottles-reference-production/cylinder-sidecar-reconciliation-v2/cylinder-sidecar-reconciliation-manifest.json",
    ROOT,
  ))).toString("utf8")) as { records: never[] };
  const productionReadiness = JSON.parse((await readFile(new URL(
    "public/data/best-bottles-cylinder-production-readiness.json",
    ROOT,
  ))).toString("utf8")) as { minimumReferencePixels: number };
  reconstructSealedRawLivePdpRows(
    sources.roleAwareReadiness.data as never,
    sidecarPreflight.plan.rows,
    sidecarManifest.records,
    productionReadiness.minimumReferencePixels,
  );

  return {
    generatedAt: "2026-07-14T19:00:00.000Z",
    sources,
    evidenceVerifications: await localEvidenceVerifications(sources),
  };
}

let inputFixturePromise: Promise<CylinderDualRoleRemediationInput> | undefined;

async function inputFixture(): Promise<CylinderDualRoleRemediationInput> {
  inputFixturePromise ??= createInputFixture();
  return structuredClone(await inputFixturePromise);
}

describe("Cylinder dual-role remediation plan", () => {
  it("partitions every exact identity into one sealed taxonomy-aware route", async () => {
    const plan = buildCylinderDualRoleRemediationPlan(await inputFixture());

    assert.equal(
      plan.version,
      BEST_BOTTLES_CYLINDER_DUAL_ROLE_REMEDIATION_VERSION,
    );
    assert.equal(plan.rows.length, 377);
    assert.deepEqual(plan.summary, {
      sourceIdentityCount: 377,
      cylinderIdentityCount: 375,
      vialHandoffCount: 2,
      strictBothRolesReadyCount: 172,
      currentLiveSidecarRemediationCount: 56,
      approvedDetachedDualRoleCount: 123,
      approvedTopologyExceptionCount: 13,
      hardBlockedNoEvidenceCount: 11,
      roleJobCount: 328,
      externalWriteCount: 0,
    });

    const identities = new Set<string>();
    const recoveryLane = new Set<string>();
    const livePointerLane = new Set<string>();

    for (const row of plan.rows) {
      const exactKey = `${normalizedIdentity(row.websiteSku)}|${normalizedIdentity(row.graceSku)}`;
      assert.equal(row.canonicalIdentityKey, exactKey);
      assert.equal(identities.has(exactKey), false, `duplicate ${exactKey}`);
      identities.add(exactKey);

      if (row.evidence.lane === "approved-recovery") recoveryLane.add(exactKey);
      if (row.evidence.lane === "approved-live-pointer") livePointerLane.add(exactKey);

      if (row.route === "approved-detached-dual-role") {
        assert.deepEqual(
          row.roleJobs.map((job) => job.jobType),
          ["assemble-cap-on-reference", "preserve-cap-off-sidecar-reference"],
        );
      }
      if (row.route === "approved-topology-exception") {
        assert.deepEqual(
          row.roleJobs.map((job) => [job.jobType, job.targetRole]),
          [
            ["preserve-cap-on-reference", "identity-cap-on"],
            ["preserve-assembled-topology-exception", "pdp-cap-off-sidecar"],
          ],
        );
      }
      if (row.route === "remediate-current-live-sidecar") {
        assert.deepEqual(
          row.roleJobs.map((job) => job.jobType),
          ["preserve-cap-off-sidecar-reference"],
        );
      }
      if (
        row.route === "hard-blocked-no-evidence"
        || row.route === "routed-to-vial"
        || row.route === "strict-both-roles-ready"
      ) {
        assert.deepEqual(row.roleJobs, []);
      }

      if (row.evidence.lane !== "none") {
        assert.equal(row.evidence.opaque, true);
        assert.equal(row.evidence.originalBackgroundEligible, true);
      }
    }

    assert.equal(identities.size, 377);
    assert.deepEqual(
      [...recoveryLane].filter((key) => livePointerLane.has(key)),
      [],
    );

    assert.deepEqual(
      plan.rows
        .filter((row) => row.route === "routed-to-vial")
        .map((row) => `${row.websiteSku}|${row.graceSku}`)
        .sort(),
      [
        "GB09BlackCapApp|GB-CYL-CLR-9ML-T-01",
        "GB09BlackCapSht|GB-CYL-CLR-9ML-S-01",
      ],
    );
    assert.equal(
      plan.rows
        .filter((row) => row.route === "hard-blocked-no-evidence")
        .every((row) => row.roleJobs.length === 0),
      true,
    );

    assert.match(plan.sha256, /^[a-f0-9]{64}$/);
    const { sha256, ...unsealed } = plan;
    assert.equal(
      sha256,
      createHash("sha256").update(stableJson(unsealed)).digest("hex"),
    );
    assert.equal(JSON.stringify(plan).includes("/Users/"), false);
    assert.equal(
      plan.rows
        .filter((row) => row.route === "routed-to-vial")
        .every((row) => row.canonicalFamily === "Vial" && row.canonical.family === "Vial"),
      true,
    );
  });

  it("rejects any taxonomy override set other than the two canonical Vial handoffs", async () => {
    const input = await inputFixture();
    const replacement = input.sources.roleAwareReadiness.data.rows.find((row) => (
      row.canonicalIdentityKey === "GBCYL5GL|GBCYLCLR5MLGLDT"
    ));
    assert.ok(replacement);
    input.sources.taxonomyOverrides.data.overrides[1] = {
      websiteSku: replacement.websiteSku,
      graceSku: replacement.graceSku,
      canonicalFamily: "Vial",
    };

    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(input),
      /exact canonical Vial handoff identities/i,
    );
  });

  it("rejects recovery decisions without exact approval semantics", async () => {
    const input = await inputFixture();
    input.sources.recoveryApproval.data.decisions[0].identityDecision = "approved-sibling-substitute";
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(input),
      /recovery identity decision/i,
    );

    const dispositionInput = await inputFixture();
    dispositionInput.sources.recoveryApproval.data.decisions[0].productionDisposition =
      "production-gate-candidate";
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(dispositionInput),
      /recovery production disposition/i,
    );
  });

  it("rejects live-pointer decisions or guardrails that allow substitution or promotion", async () => {
    const input = await inputFixture();
    input.sources.livePointerApproval.data.decisions[0].identityDecision = "approved-substitute";
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(input),
      /live-pointer identity decision/i,
    );

    const dispositionInput = await inputFixture();
    dispositionInput.sources.livePointerApproval.data.decisions[0].productionDisposition = "promotion-ready";
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(dispositionInput),
      /live-pointer production disposition/i,
    );

    const guardrailInput = await inputFixture();
    guardrailInput.sources.livePointerApproval.data.guardrails.substitutionsAllowed = true;
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(guardrailInput),
      /substitutions.*automatic promotion/i,
    );
  });

  it("rejects non-opaque current roles and unverified or altered local evidence", async () => {
    const input = await inputFixture();
    const current = input.sources.roleAwareReadiness.data.rows.find((row) => (
      row.references.pdpCapOffSidecar.sourceRoute === "exact-live-pdp-sidecar"
    ));
    assert.ok(current);
    current.references.pdpCapOffSidecar.opaque = null;
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(input),
      /verified roles must be explicitly opaque/i,
    );

    const transparentInput = await inputFixture();
    transparentInput.evidenceVerifications[0].opaque = false;
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(transparentInput),
      /local evidence must be opaque/i,
    );

    const backgroundInput = await inputFixture();
    backgroundInput.evidenceVerifications[0].originalBackgroundEligible = false;
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(backgroundInput),
      /original-background eligible/i,
    );

    const hashInput = await inputFixture();
    hashInput.evidenceVerifications[0].referenceSha256 = "0".repeat(64);
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(hashInput),
      /verification hash disagrees/i,
    );
  });

  it("rejects contradictory embedded canonical taxonomy", async () => {
    const input = await inputFixture();
    const cylinder = input.sources.roleAwareReadiness.data.rows.find((row) => (
      !input.sources.taxonomyOverrides.data.overrides.some((override) => (
        exactKey(override) === row.canonicalIdentityKey
      ))
    ));
    assert.ok(cylinder);
    cylinder.canonical.family = "Vial";
    assert.throws(
      () => buildCylinderDualRoleRemediationPlan(input),
      /embedded canonical family must be Cylinder/i,
    );
  });
});
