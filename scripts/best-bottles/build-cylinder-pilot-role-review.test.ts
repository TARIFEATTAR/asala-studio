import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import sharp from "sharp";

import {
  buildCylinderPilotRoleReviewFromLocalFiles,
  parseCylinderPilotRoleReviewArgs,
} from "./build-cylinder-pilot-role-review";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_BASE = path.join(
  ROOT,
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2",
);
const PLAN_SHA = "411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35";
const SOURCE_RUN = path.join(
  SOURCE_BASE,
  "runs",
  PLAN_SHA,
  "execute-local-only-304a29d863ee1e5a",
);
const ROLES = ["identity-cap-on", "pdp-cap-off-sidecar"] as const;
const SLUG = "GBCylBlu5SpryBlkSh__GB-CYL-BLU-5ML-SPR-SBLK";
const temporaryRoots: string[] = [];

after(async () => {
  await Promise.all(temporaryRoots.map((entry) => rm(entry, { recursive: true, force: true })));
});

async function sha256File(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function copyPilotFixture() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "pilot-role-review-"));
  temporaryRoots.push(temporaryRoot);
  const base = path.join(temporaryRoot, "cylinder-dual-role-remediation-v2");
  const runDirectory = path.join(base, "runs", PLAN_SHA, "execute-local-only-fixture");
  const planPath = path.join(base, "cylinder-dual-role-remediation-plan.json");
  await mkdir(runDirectory, { recursive: true });
  await copyFile(path.join(SOURCE_BASE, "cylinder-dual-role-remediation-plan.json"), planPath);
  await copyFile(path.join(SOURCE_RUN, "compiled-jobs.json"), path.join(runDirectory, "compiled-jobs.json"));
  for (const role of ROLES) {
    const relativeDirectory = path.join(
      "normalized/framing-recovery-v3",
      `${SLUG}__${role}`,
    );
    await mkdir(path.join(runDirectory, relativeDirectory), { recursive: true });
    await copyFile(
      path.join(SOURCE_RUN, relativeDirectory, "recovery-record.json"),
      path.join(runDirectory, relativeDirectory, "recovery-record.json"),
    );
    await copyFile(
      path.join(SOURCE_RUN, relativeDirectory, "pass-02.png"),
      path.join(runDirectory, relativeDirectory, "pass-02.png"),
    );
  }
  return { temporaryRoot, planPath, runDirectory };
}

async function readJson(filePath: string): Promise<any> {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function buildOptions(fixture: Awaited<ReturnType<typeof copyPilotFixture>>) {
  return {
    planPath: fixture.planPath,
    runDirectory: fixture.runDirectory,
    websiteSku: "GBCylBlu5SpryBlkSh" as const,
    graceSku: "GB-CYL-BLU-5ML-SPR-SBLK" as const,
  };
}

function roleDirectory(
  fixture: Awaited<ReturnType<typeof copyPilotFixture>>,
  role: typeof ROLES[number],
): string {
  return path.join(
    fixture.runDirectory,
    "normalized/framing-recovery-v3",
    `${SLUG}__${role}`,
  );
}

async function expectRejectedWithoutArtifact(
  fixture: Awaited<ReturnType<typeof copyPilotFixture>>,
  pattern: RegExp,
): Promise<void> {
  await assert.rejects(
    () => buildCylinderPilotRoleReviewFromLocalFiles(buildOptions(fixture)),
    pattern,
  );
  await assert.rejects(
    () => readFile(path.join(fixture.runDirectory, "pilot-role-review-v1")),
  );
}

async function replacePass2Output(
  fixture: Awaited<ReturnType<typeof copyPilotFixture>>,
  role: typeof ROLES[number],
  bytes: Buffer,
): Promise<void> {
  const directory = roleDirectory(fixture, role);
  const pngPath = path.join(directory, "pass-02.png");
  const recordPath = path.join(directory, "recovery-record.json");
  await writeFile(pngPath, bytes);
  const record = await readJson(recordPath);
  record.passes.find((entry: any) => entry.passNumber === 2).outputSha256 =
    createHash("sha256").update(bytes).digest("hex");
  await writeJson(recordPath, record);
}

describe("build Cylinder pilot role review CLI", () => {
  it("accepts only the exact local pilot identity and rejects alternate modes", () => {
    const parsed = parseCylinderPilotRoleReviewArgs([
      "--plan", "/tmp/local-plan.json",
      "--run-dir", "/tmp/local-run",
      "--website-sku", "GBCylBlu5SpryBlkSh",
      "--grace-sku", "GB-CYL-BLU-5ML-SPR-SBLK",
    ]);
    assert.equal(parsed.websiteSku, "GBCylBlu5SpryBlkSh");
    assert.throws(
      () => parseCylinderPilotRoleReviewArgs([
        "--plan", "https://example.com/plan.json",
        "--run-dir", "/tmp/local-run",
        "--website-sku", "GBCylBlu5SpryBlkSh",
        "--grace-sku", "GB-CYL-BLU-5ML-SPR-SBLK",
      ]),
      /local path/i,
    );
    assert.throws(
      () => parseCylinderPilotRoleReviewArgs([
        "--plan", "/tmp/local-plan.json",
        "--run-dir", "/tmp/local-run",
        "--website-sku", "wrong",
        "--grace-sku", "GB-CYL-BLU-5ML-SPR-SBLK",
      ]),
      /exact pilot identity/i,
    );
    assert.throws(
      () => parseCylinderPilotRoleReviewArgs([
        "--plan", "/tmp/local-plan.json",
        "--run-dir", "/tmp/local-run",
        "--website-sku", "GBCylBlu5SpryBlkSh",
        "--grace-sku", "GB-CYL-BLU-5ML-SPR-SBLK",
        "--mode", "remote",
      ]),
      /unknown flag/i,
    );
  });

  it("writes only a hash-addressed local artifact and leaves v3 inputs immutable", async () => {
    const fixture = await copyPilotFixture();
    const sourcePaths = ROLES.flatMap((role) => {
      const directory = path.join(
        fixture.runDirectory,
        "normalized/framing-recovery-v3",
        `${SLUG}__${role}`,
      );
      return [path.join(directory, "recovery-record.json"), path.join(directory, "pass-02.png")];
    });
    const before = await Promise.all(sourcePaths.map(sha256File));

    const result = await buildCylinderPilotRoleReviewFromLocalFiles({
      planPath: fixture.planPath,
      runDirectory: fixture.runDirectory,
      websiteSku: "GBCylBlu5SpryBlkSh",
      graceSku: "GB-CYL-BLU-5ML-SPR-SBLK",
    });

    assert.equal(path.basename(result.outputDirectory), result.artifact.inputSetSha256);
    assert.equal(result.artifact.machineStatus, "pass");
    assert.equal(result.artifact.humanVisualApproval, "not-recorded");
    assert.equal(result.artifact.promotionStatus, "not-promoted");
    assert.equal(result.artifact.roles.length, 2);
    assert.equal(JSON.parse(await readFile(result.manifestPath, "utf8")).inputSetSha256, result.artifact.inputSetSha256);
    assert.match(await readFile(result.htmlPath, "utf8"), /human visual review pending/);
    assert.deepEqual(await Promise.all(sourcePaths.map(sha256File)), before);

    const repeated = await buildCylinderPilotRoleReviewFromLocalFiles({
      planPath: fixture.planPath,
      runDirectory: fixture.runDirectory,
      websiteSku: "GBCylBlu5SpryBlkSh",
      graceSku: "GB-CYL-BLU-5ML-SPR-SBLK",
    });
    assert.equal(repeated.outputDirectory, result.outputDirectory);
  });

  it("rejects a semantic plan mutation even when the mutable file SHA is refreshed", async () => {
    const fixture = await copyPilotFixture();
    const plan = await readJson(fixture.planPath);
    plan.rows.find((row: any) => row.websiteSku === "GBCylBlu5SpryBlkSh").canonical.capacityMl = "6";
    await writeJson(fixture.planPath, plan);
    const compiledPath = path.join(fixture.runDirectory, "compiled-jobs.json");
    const compiled = await readJson(compiledPath);
    compiled.planFileSha256 = await sha256File(fixture.planPath);
    await writeJson(compiledPath, compiled);

    await expectRejectedWithoutArtifact(fixture, /recomputed.*plan SHA|semantic.*plan SHA/i);
  });

  it("rejects a prompt text-only mutation", async () => {
    const fixture = await copyPilotFixture();
    const compiledPath = path.join(fixture.runDirectory, "compiled-jobs.json");
    const compiled = await readJson(compiledPath);
    compiled.jobs.find((job: any) => job.role === "identity-cap-on").prompt += "\nMUTATED";
    await writeJson(compiledPath, compiled);

    await expectRejectedWithoutArtifact(fixture, /prompt.*SHA/i);
  });

  it("rejects coordinated geometry, source, and reference hash mutation", async () => {
    const fixture = await copyPilotFixture();
    const compiledPath = path.join(fixture.runDirectory, "compiled-jobs.json");
    const compiled = await readJson(compiledPath);
    const mutated = {
      canonicalGeometrySha256: "a".repeat(64),
      sourceSha256: "b".repeat(64),
      referenceSha256: "c".repeat(64),
    };
    for (const job of compiled.jobs.filter((entry: any) => entry.websiteSku === "GBCylBlu5SpryBlkSh")) {
      Object.assign(job, mutated);
    }
    await writeJson(compiledPath, compiled);
    for (const role of ROLES) {
      const recordPath = path.join(roleDirectory(fixture, role), "recovery-record.json");
      const record = await readJson(recordPath);
      Object.assign(record, mutated);
      Object.assign(record.passes.find((entry: any) => entry.passNumber === 2).job, mutated);
      await writeJson(recordPath, record);
    }

    await expectRejectedWithoutArtifact(fixture, /canonical geometry|source SHA|reference SHA/i);
  });

  it("rejects role crossing and absence before writing", async () => {
    const crossed = await copyPilotFixture();
    const crossedRecordPath = path.join(roleDirectory(crossed, "identity-cap-on"), "recovery-record.json");
    const crossedRecord = await readJson(crossedRecordPath);
    crossedRecord.role = "pdp-cap-off-sidecar";
    crossedRecord.passes.find((entry: any) => entry.passNumber === 2).job.role = "pdp-cap-off-sidecar";
    await writeJson(crossedRecordPath, crossedRecord);
    await expectRejectedWithoutArtifact(crossed, /role.*authority|crosses/i);

    const absent = await copyPilotFixture();
    const compiledPath = path.join(absent.runDirectory, "compiled-jobs.json");
    const compiled = await readJson(compiledPath);
    compiled.jobs = compiled.jobs.filter((entry: any) => entry.role !== "pdp-cap-off-sidecar");
    await writeJson(compiledPath, compiled);
    await expectRejectedWithoutArtifact(absent, /both exact compiled role jobs|required compiled role/i);
  });

  it("rejects PNG hash, opacity, and dimensions before writing", async () => {
    const hashFixture = await copyPilotFixture();
    const hashPath = path.join(roleDirectory(hashFixture, "identity-cap-on"), "pass-02.png");
    const changed = await sharp(await readFile(hashPath)).modulate({ brightness: 0.99 }).png().toBuffer();
    await writeFile(hashPath, changed);
    await expectRejectedWithoutArtifact(hashFixture, /output SHA/i);

    const opacityFixture = await copyPilotFixture();
    const opacityPath = path.join(roleDirectory(opacityFixture, "identity-cap-on"), "pass-02.png");
    const decoded = await sharp(await readFile(opacityPath))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    decoded.data[3] = 254;
    const transparent = await sharp(decoded.data, { raw: decoded.info })
      .png()
      .toBuffer();
    await replacePass2Output(opacityFixture, "identity-cap-on", transparent);
    await expectRejectedWithoutArtifact(opacityFixture, /opaque/i);

    const dimensionFixture = await copyPilotFixture();
    const dimensionPath = path.join(roleDirectory(dimensionFixture, "identity-cap-on"), "pass-02.png");
    const wrongDimensions = await sharp(await readFile(dimensionPath))
      .resize(2079, 2288, { fit: "fill" })
      .png()
      .toBuffer();
    await replacePass2Output(dimensionFixture, "identity-cap-on", wrongDimensions);
    await expectRejectedWithoutArtifact(dimensionFixture, /2080 × 2288/i);
  });
});
