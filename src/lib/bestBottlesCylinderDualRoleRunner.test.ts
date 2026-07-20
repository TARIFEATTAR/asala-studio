import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import sharp from "sharp";

import type { PromptSystem } from "./bestBottlesPromptCompiler";
import type { CylinderDualRoleRemediationPlan } from "./bestBottlesCylinderDualRoleRemediation";
import {
  assertCylinderDualRoleResumeCompatible,
  buildSuccessfulCylinderDualRoleResult,
  compileCylinderDualRoleRun,
  computeCanonicalGeometrySha256,
  computeCylinderDualRolePlanSha256,
  parseCylinderDualRoleRunnerArgs,
} from "./bestBottlesCylinderDualRoleRunner";
import {
  executeCylinderDualRoleJob,
  parseCylinderDualRoleCanonicalProductTruth,
  validateCylinderDualRolePng,
  writeCylinderDualRoleCompileRecords,
} from "../../scripts/best-bottles/run-cylinder-dual-role-remediation";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

const promptSystem: PromptSystem = {
  masterTemplate: "",
  families: {},
  materials: {},
  frames: {},
  closures: {},
  negativeRules: [],
};

function fixturePlan(overrides: {
  classification?: string;
  route?: string;
  jobType?: string;
  targetRole?: string;
  sourceSha256?: string | null;
  width?: number;
  height?: number;
} = {}): CylinderDualRoleRemediationPlan {
  const route = overrides.route ?? "approved-detached-dual-role";
  const jobType = overrides.jobType ?? "assemble-cap-on-reference";
  const targetRole = overrides.targetRole ?? "identity-cap-on";
  const plan = {
    version: "best-bottles-cylinder-dual-role-remediation-v2",
    generatedAt: "2026-07-15T00:00:00.000Z",
    provenance: { inputs: {}, localEvidenceVerificationCount: 136 },
    authorization: {
      planMode: "read-only",
      outputState: "review-pending",
      remoteWrites: "forbidden",
      publishStatus: "not-authorized",
    },
    summary: {
      sourceIdentityCount: 377,
      cylinderIdentityCount: 375,
      vialHandoffCount: 2,
      strictBothRolesReadyCount: 172,
      currentLiveSidecarRemediationCount: 56,
      approvedDetachedDualRoleCount: 123,
      approvedTopologyExceptionCount: 13,
      hardBlockedNoEvidenceCount: 11,
      roleJobCount: 1,
      externalWriteCount: 0,
    },
    rows: [{
      canonicalIdentityKey: "WEBA|GRACEA",
      websiteSku: "WebA",
      graceSku: "Grace-A",
      canonicalFamily: "Cylinder",
      route,
      canonical: {
        websiteSku: "WebA",
        graceSku: "Grace-A",
        family: "Cylinder",
        productGroupSlug: "cylinder-9ml-clear-17-415-rollon",
        capacityMl: "9",
        canon_bodyHeightMm: "70.0",
        canon_widthAxisMm: "20.0",
        canon_secondAxisMm: "20.0",
        canon_heightWithCapMm: "83.0",
      },
      evidence: {
        lane: "approved-recovery",
        classification: overrides.classification ?? "detached-cap-or-sidecar",
        sourceSha256: overrides.sourceSha256 === undefined ? SHA_A : overrides.sourceSha256,
        referenceSha256: SHA_B,
        width: overrides.width ?? 600,
        height: overrides.height ?? 1050,
        resolutionStatus: "low-resolution",
        sourceLocator: "tmp/evidence/WebA.png",
        opaque: true,
        originalBackgroundEligible: true,
        verificationMethod: "sha256+sharp-alpha-scan",
      },
      roleJobs: [{
        jobId: `WEBA|GRACEA|${jobType}`,
        jobType,
        targetRole,
        sourceEvidenceLane: "approved-recovery",
        reviewStatus: "sealed-input-review-pending",
      }],
      blockers: [],
    }],
    sha256: "",
  } as unknown as CylinderDualRoleRemediationPlan;
  plan.sha256 = computeCylinderDualRolePlanSha256(plan);
  return plan;
}

function fixtureTruthRow(
  plan: CylinderDualRoleRemediationPlan,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const row = plan.rows[0];
  return {
    graceSku: row.graceSku,
    websiteSku: row.websiteSku,
    productGroupSlug: row.canonical.productGroupSlug,
    family: "Cylinder",
    category: "Glass Bottle",
    bottleCollection: "Cylinder",
    color: "Clear",
    capacityMl: row.canonical.capacityMl,
    material: "Glass",
    glassFinish: "Clear",
    canon_bodyHeightMm: row.canonical.canon_bodyHeightMm,
    canon_widthAxisMm: row.canonical.canon_widthAxisMm,
    canon_secondAxisMm: row.canonical.canon_secondAxisMm,
    canon_heightWithCapMm: row.canonical.canon_heightWithCapMm,
    applicator: "Roll On",
    capStyle: "Screw Cap",
    capColor: "Black",
    trimColor: "",
    itemName: "Clear glass Cylinder bottle with black cap",
    ...overrides,
  };
}

function compileFixture(
  plan: CylinderDualRoleRemediationPlan,
  truthRows: Array<Record<string, string>> = [fixtureTruthRow(plan)],
) {
  return compileCylinderDualRoleRun({
    plan,
    expectedPlanSha256: plan.sha256,
    options: parseCylinderDualRoleRunnerArgs(["--all"]),
    promptSystem,
    canonicalProductTruth: {
      fileSha256: SHA_A,
      rows: truthRows,
    },
  });
}

function cobaltFixture() {
  const plan = fixturePlan();
  const row = plan.rows[0];
  row.websiteSku = "GBCylBlu5SpryBlkSh";
  row.graceSku = "GB-CYL-BLU-5ML-SPR-SBLK";
  row.canonicalIdentityKey = "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK";
  row.canonical.websiteSku = row.websiteSku;
  row.canonical.graceSku = row.graceSku;
  row.canonical.productGroupSlug = "cylinder-5ml-cobalt-blue-13-415-finemist";
  row.canonical.capacityMl = "5";
  row.canonical.canon_bodyHeightMm = "53.0";
  row.canonical.canon_widthAxisMm = "17.0";
  row.canonical.canon_secondAxisMm = "17.0";
  row.canonical.canon_heightWithCapMm = "72.0";
  row.roleJobs[0].jobId = `${row.canonicalIdentityKey}|assemble-cap-on-reference`;
  plan.sha256 = computeCylinderDualRolePlanSha256(plan);
  const truth = fixtureTruthRow(plan, {
    color: "Cobalt Blue",
    material: "Glass",
    glassFinish: "Cobalt",
    applicator: "Fine Mist Sprayer",
    capStyle: "Spray",
    capColor: "Shiny Black",
    itemName: "Cylinder design 5ml Blue glass bottle with shiny black spray",
  });
  return { plan, truth };
}

async function candidatePng(rectangles: Array<{ x: number; y: number; width: number; height: number }>): Promise<Buffer> {
  const overlays = rectangles.map((rect) => ({
    input: Buffer.from(
      `<svg width="${rect.width}" height="${rect.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#173f73"/></svg>`,
    ),
    left: rect.x,
    top: rect.y,
  }));
  return sharp({
    create: { width: 2080, height: 2288, channels: 3, background: "#f6efe8" },
  }).composite(overlays).flatten({ background: "#f6efe8" }).removeAlpha().png().toBuffer();
}

describe("Best Bottles Cylinder dual-role runner", () => {
  it("defaults to compile-only and forbids unbounded or all-job execution", () => {
    assert.equal(parseCylinderDualRoleRunnerArgs([]).mode, "compile-only");
    assert.throws(
      () => parseCylinderDualRoleRunnerArgs(["--execute", "--route", "approved-detached-dual-role"]),
      /--count.*required/i,
    );
    assert.throws(
      () => parseCylinderDualRoleRunnerArgs(["--execute", "--count", "1"]),
      /route.*cohort.*allowlist/i,
    );
    assert.throws(
      () => parseCylinderDualRoleRunnerArgs(["--execute", "--all", "--count", "1"]),
      /--execute --all.*forbidden/i,
    );
  });

  it("rejects opposite roles compiled from one shared product reference", () => {
    const plan = fixturePlan();
    plan.rows[0].roleJobs.push({
      jobId: "WEBA|GRACEA|preserve-cap-off-sidecar-reference",
      jobType: "preserve-cap-off-sidecar-reference",
      targetRole: "pdp-cap-off-sidecar",
      sourceEvidenceLane: "approved-recovery",
      reviewStatus: "sealed-input-review-pending",
    });
    plan.summary.roleJobCount = 2;
    plan.sha256 = computeCylinderDualRolePlanSha256(plan);

    assert.throws(
      () => compileFixture(plan),
      /opposite roles.*shared product reference|cross-lane product reference/i,
    );
  });

  it("verifies the Task 1 seal before selecting and compiles exact role identity hashes", () => {
    const plan = fixturePlan();
    const compiled = compileFixture(plan);
    assert.equal(compiled.jobs.length, 1);
    assert.equal(compiled.jobs[0].status, "compiled-dry-run");
    assert.equal(compiled.jobs[0].planSha256, plan.sha256);
    assert.equal(compiled.jobs[0].canonicalIdentityKey, "WEBA|GRACEA");
    assert.equal(compiled.jobs[0].websiteSku, "WebA");
    assert.equal(compiled.jobs[0].graceSku, "Grace-A");
    assert.equal(compiled.jobs[0].role, "identity-cap-on");
    assert.equal(compiled.jobs[0].sourceSha256, SHA_A);
    assert.equal(compiled.jobs[0].referenceSha256, SHA_B);
    assert.equal(compiled.jobs[0].canonicalProductTruthFileSha256, SHA_A);
    assert.match(compiled.jobs[0].canonicalProductTruthRecordSha256, /^[a-f0-9]{64}$/);
    assert.match(compiled.jobs[0].promptSha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(compiled.jobs[0].deterministicOperationSha256, null);
    assert.equal(compiled.jobs[0].canonicalGeometrySha256, computeCanonicalGeometrySha256(plan.rows[0].canonical));
    assert.equal(compiled.externalWriteCount, 0);

    const altered = structuredClone(plan);
    altered.rows.push(structuredClone(altered.rows[0]));
    assert.throws(
      () => compileFixture(altered),
      /Task 1 plan SHA/i,
    );
  });

  it("never lets assembled-only evidence request an ordinary cap-off sidecar job", () => {
    const invalid = fixturePlan({
      route: "approved-topology-exception",
      classification: "assembled-cap-on",
      jobType: "preserve-cap-off-sidecar-reference",
      targetRole: "pdp-cap-off-sidecar",
    });
    assert.throws(
      () => compileFixture(invalid),
      /assembled-only evidence.*pdp-cap-off-sidecar/i,
    );

    const exception = fixturePlan({
      route: "approved-topology-exception",
      classification: "assembled-cap-on",
      jobType: "preserve-assembled-topology-exception",
      targetRole: "pdp-cap-off-sidecar",
      width: 2080,
      height: 2288,
    });
    const compiled = compileFixture(exception);
    assert.equal(compiled.jobs[0].promptSha256, null);
    assert.match(compiled.jobs[0].deterministicOperationSha256 ?? "", /^[a-f0-9]{64}$/);
  });

  it("preserves a sealed null source SHA and prompts low-resolution topology preservation", () => {
    const plan = fixturePlan({
      route: "approved-topology-exception",
      classification: "assembled-cap-on",
      jobType: "preserve-cap-on-reference",
      targetRole: "identity-cap-on",
      sourceSha256: null,
    });
    const job = compileFixture(plan).jobs[0];
    assert.equal(job.sourceSha256, null);
    assert.equal(job.referenceSha256, SHA_B);
    assert.match(job.promptSha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(job.deterministicOperationSha256, null);
    assert.match(job.prompt ?? "", /preserve.*assembled cap-on/i);
  });

  it("binds sealed topology evidence when exact item truth requires multi-component preflight", () => {
    const plan = fixturePlan({
      route: "approved-topology-exception",
      classification: "assembled-cap-on",
      jobType: "preserve-assembled-topology-exception",
      targetRole: "pdp-cap-off-sidecar",
    });
    const job = compileFixture(plan, [fixtureTruthRow(plan, {
      itemName: "Antique sprayer bottle with multi-component tassel",
      applicator: "Antique Sprayer",
    })]).jobs[0];
    assert.match(job.promptSha256 ?? "", /^[a-f0-9]{64}$/);
  });

  it("keeps cap-on assembly and cap-off sidecar preservation prompts role-specific", () => {
    const capOnPlan = fixturePlan();
    const capOn = compileFixture(capOnPlan).jobs[0];
    assert.match(capOn.prompt ?? "", /assemble.*cap-on/i);
    assert.match(capOn.prompt ?? "", /only authorized positional change.*seating.*detached cap/i);
    assert.doesNotMatch(capOn.prompt ?? "", /preserve.*cap-off.*sidecar/i);

    const sidecarPlan = fixturePlan({
      jobType: "preserve-cap-off-sidecar-reference",
      targetRole: "pdp-cap-off-sidecar",
    });
    const sidecar = compileFixture(sidecarPlan).jobs[0];
    assert.match(sidecar.prompt ?? "", /preserve.*cap-off.*sidecar/i);
    assert.doesNotMatch(sidecar.prompt ?? "", /assemble.*cap-on/i);
    assert.notEqual(sidecar.promptSha256, capOn.promptSha256);
  });

  it("rejects stale resume metadata and emits only framing-approved review-pending success states", () => {
    const plan = fixturePlan();
    const job = compileFixture(plan).jobs[0];
    const stale = { ...job, promptSha256: SHA_A };
    assert.throws(() => assertCylinderDualRoleResumeCompatible(job, stale), /stale resume metadata/i);
    assert.throws(
      () => assertCylinderDualRoleResumeCompatible(job, {
        ...job,
        canonicalProductTruthRecordSha256: SHA_B,
      }),
      /stale resume metadata/i,
    );
    assert.doesNotThrow(() => assertCylinderDualRoleResumeCompatible(job, { ...job }));

    const rendered = buildSuccessfulCylinderDualRoleResult(job, {
      disposition: "rendered",
      outputSha256: SHA_A,
      width: 2080,
      height: 2288,
      opaque: true,
      framingQa: { status: "pass" },
    } as any);
    const skipped = buildSuccessfulCylinderDualRoleResult(job, {
      disposition: "existing",
      outputSha256: SHA_B,
      width: 2080,
      height: 2288,
      opaque: true,
      framingQa: { status: "pass" },
    } as any);
    assert.equal(rendered.status, "rendered-review-pending");
    assert.equal(skipped.status, "skipped-existing-review-pending");
    assert.equal(rendered.reviewStatus, "review-pending");
    assert.equal(skipped.reviewStatus, "review-pending");
    assert.equal((rendered as any).framingQa.status, "pass");
    assert.throws(
      () => buildSuccessfulCylinderDualRoleResult(job, {
        disposition: "rendered",
        outputSha256: SHA_A,
        width: 2080,
        height: 2288,
        opaque: true,
        framingQa: { status: "fail" },
      } as any),
      /must pass family-rig framing QA/i,
    );
    assert.throws(
      () => buildSuccessfulCylinderDualRoleResult(job, {
        disposition: "rendered",
        outputSha256: SHA_A,
        width: 2080,
        height: 2288,
        opaque: true,
      } as any),
      /must pass family-rig framing QA/i,
    );
    assert.throws(
      () => buildSuccessfulCylinderDualRoleResult(job, {
        disposition: "rendered",
        outputSha256: SHA_A,
        width: 1000,
        height: 1300,
        opaque: true,
      }),
      /2080x2288/i,
    );
  });

  it("accepts only local 2080x2288 opaque PNG candidate bytes that pass the exact family rig", async () => {
    const { plan, truth } = cobaltFixture();
    const job = compileFixture(plan, [truth]).jobs[0];
    const opaque = await candidatePng([{ x: 840, y: 686, width: 400, height: 1397 }]);
    const valid = await validateCylinderDualRolePng(opaque, { job, productTruth: truth });
    assert.deepEqual(
      { width: valid.width, height: valid.height, opaque: valid.opaque },
      { width: 2080, height: 2288, opaque: true },
    );
    assert.notEqual(valid.framingQa.status, "fail");

    const transparent = await sharp({
      create: { width: 2080, height: 2288, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
    await assert.rejects(() => validateCylinderDualRolePng(transparent, { job, productTruth: truth }), /opaque/i);

    const legacy = await sharp({
      create: { width: 1000, height: 1300, channels: 3, background: "white" },
    }).png().toBuffer();
    await assert.rejects(() => validateCylinderDualRolePng(legacy, { job, productTruth: truth }), /2080x2288/i);
  });

  it("rejects the reproduced oversized and off-baseline cap-on pilot framing", async () => {
    const { plan, truth } = cobaltFixture();
    const job = compileFixture(plan, [truth]).jobs[0];
    const pilotLike = await candidatePng([{ x: 1110, y: 254, width: 400, height: 1728 }]);
    await assert.rejects(
      () => validateCylinderDualRolePng(pilotLike, { job, productTruth: truth }),
      /framing QA failed.*fill height.*baseline/is,
    );
  });

  it("rejects a changed framing-failed PNG when resuming a prior successful result", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cylinder-dual-role-resume-success-"));
    try {
      const { plan, truth } = cobaltFixture();
      const job = compileFixture(plan, [truth]).jobs[0];
      const runDir = path.join(root, "run");
      const outputPath = path.join(runDir, job.outputRelativePath);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, await candidatePng([{ x: 1110, y: 254, width: 400, height: 1728 }]));
      const prior = buildSuccessfulCylinderDualRoleResult(job, {
        disposition: "rendered",
        outputSha256: SHA_A,
        width: 2080,
        height: 2288,
        opaque: true,
        framingQa: { status: "pass" },
      } as any);

      await assert.rejects(
        () => executeCylinderDualRoleJob({
          root,
          runDir,
          job,
          prior,
          apiKey: null,
          productTruth: truth,
        }),
        /output SHA changed/i,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a changed framing-failed PNG when resuming a prior framing failure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cylinder-dual-role-resume-framing-"));
    try {
      const { plan, truth } = cobaltFixture();
      const job = compileFixture(plan, [truth]).jobs[0];
      const runDir = path.join(root, "run");
      const outputPath = path.join(runDir, job.outputRelativePath);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, await candidatePng([{ x: 1110, y: 254, width: 400, height: 1728 }]));
      const prior = {
        ...job,
        status: "failed-framing" as const,
        reviewStatus: "framing-rejected" as const,
        error: "prior framing failure",
        outputSha256: SHA_A,
        outputDimensions: { width: 2080 as const, height: 2288 as const },
        opaque: true as const,
        framingQa: { status: "fail" },
      };

      await assert.rejects(
        () => executeCylinderDualRoleJob({
          root,
          runDir,
          job,
          prior: prior as any,
          apiKey: null,
          productTruth: truth,
        }),
        /output SHA changed/i,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses complete-product fill and shared baseline for detached sidecar without requiring a cap box or primary centerline", async () => {
    const { plan, truth } = cobaltFixture();
    const row = plan.rows[0];
    row.roleJobs[0].jobType = "preserve-cap-off-sidecar-reference";
    row.roleJobs[0].targetRole = "pdp-cap-off-sidecar";
    row.roleJobs[0].jobId = `${row.canonicalIdentityKey}|preserve-cap-off-sidecar-reference`;
    plan.sha256 = computeCylinderDualRolePlanSha256(plan);
    const job = compileFixture(plan, [truth]).jobs[0];
    const detached = await candidatePng([
      { x: 680, y: 686, width: 400, height: 1397 },
      { x: 1320, y: 1683, width: 210, height: 400 },
    ]);
    const valid = await validateCylinderDualRolePng(detached, { job, productTruth: truth });
    assert.equal(valid.framingQa.measurements.fillHeightPct, 61.1);
    assert.equal(valid.framingQa.measurements.baselineYPx, 2082);
    assert.equal(valid.framingQa.measurements.centerXPct, null);
    assert.match(valid.framingQa.warnings.join(" "), /Primary bottle bounds unavailable/i);
    assert.notEqual(valid.framingQa.status, "fail");
  });

  it("parses canonical product truth only when its exact file hash matches", () => {
    const csv = Buffer.from([
      "graceSku,websiteSku,productGroupSlug,family,category,bottleCollection,color,capacityMl,material,glassFinish,canon_bodyHeightMm,canon_widthAxisMm,canon_secondAxisMm,canon_heightWithCapMm,applicator,capStyle,capColor,trimColor,itemName",
      "GB-CYL-BLU-5ML-SPR-SBLK,GBCylBlu5SpryBlkSh,cylinder-5ml-cobalt-blue-13-415-finemist,Cylinder,Glass Bottle,Cylinder,Cobalt Blue,5,Glass,Cobalt,53.0,17.0,17.0,72.0,Fine Mist Sprayer,Spray,Shiny Black,,\"Cylinder, cobalt blue\"",
    ].join("\n"));
    const fileSha256 = createHash("sha256").update(csv).digest("hex");
    const parsed = parseCylinderDualRoleCanonicalProductTruth(csv, fileSha256);
    assert.equal(parsed.fileSha256, fileSha256);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].itemName, "Cylinder, cobalt blue");
    assert.throws(
      () => parseCylinderDualRoleCanonicalProductTruth(csv, SHA_A),
      /canonical product-truth file SHA mismatch/i,
    );
  });

  it("replaces stale compile records without deleting local outputs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cylinder-dual-role-records-"));
    try {
      await writeFile(path.join(root, "keep-output.png"), "review-candidate");
      await writeCylinderDualRoleCompileRecords(root, []);
      await writeFile(path.join(root, "operations", "stale.json"), "{}");

      const plan = fixturePlan();
      const job = compileFixture(plan).jobs[0];
      await writeCylinderDualRoleCompileRecords(root, [job]);

      assert.deepEqual(await readdir(path.join(root, "operations")), []);
      assert.equal((await readdir(path.join(root, "prompts"))).length, 1);
      assert.ok((await readdir(root)).includes("keep-output.png"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed on missing, duplicate, or wrong dual-identity canonical product truth", () => {
    const plan = fixturePlan();
    assert.throws(() => compileFixture(plan, []), /missing canonical product truth/i);
    const exact = fixtureTruthRow(plan);
    assert.throws(() => compileFixture(plan, [exact, { ...exact }]), /duplicate canonical product truth/i);
    assert.throws(
      () => compileFixture(plan, [{ ...exact, graceSku: "Wrong-Grace" }]),
      /wrong-identity canonical product truth/i,
    );
  });

  it("ignores unrelated incomplete master rows while requiring selected exact identities", () => {
    const plan = fixturePlan();
    const unrelated = { ...fixtureTruthRow(plan), websiteSku: "", graceSku: "" };
    const compiled = compileFixture(plan, [unrelated, fixtureTruthRow(plan)]);
    assert.equal(compiled.jobs.length, 1);
  });

  it("rejects canonical product-truth geometry that differs from the sealed Task 1 row", () => {
    const plan = fixturePlan();
    assert.throws(
      () => compileFixture(plan, [fixtureTruthRow(plan, { canon_widthAxisMm: "19.0" })]),
      /canonical product-truth geometry mismatch.*canon_widthAxisMm/i,
    );
  });

  it("uses exact cobalt product truth instead of compiling clear-glass language from an underspecified SKU", () => {
    const { plan, truth } = cobaltFixture();
    const job = compileFixture(plan, [truth]).jobs[0];
    assert.match(job.prompt ?? "", /cobalt glass/i);
    assert.match(job.prompt ?? "", /cobalt blue/i);
    assert.doesNotMatch(job.prompt ?? "", /clear glass/i);
  });
});
