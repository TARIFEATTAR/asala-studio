import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import type { CylinderDualRoleRemediationPlan } from "./bestBottlesCylinderDualRoleRemediation";
import type { CylinderRoleAwareReadinessArtifact } from "./bestBottlesCylinderRoleAwareReadiness";
import {
  BEST_BOTTLES_CYLINDER_LANE_LOCKED_REMEDIATION_VERSION,
  BEST_BOTTLES_LANE_LOCKED_MATERIAL_CALIBRATIONS,
  assertCylinderLaneLockedJob,
  buildCylinderLaneLockedRemediationPlan,
  validateCylinderLaneLockedJobs,
  type CylinderLaneLockedJob,
  type CylinderLaneLockedRemediationInput,
} from "./bestBottlesCylinderLaneLockedRemediation";

const ROOT = new URL("../../", import.meta.url);
const SOURCE_PATHS = {
  supersededDualRolePlan:
    "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json",
  roleAwareReadiness: "public/data/best-bottles-cylinder-sidecar-promotion.json",
} as const;

const GLASS_CALIBRATION_URL =
  "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/visual-targets/glass/v1/54f5c6c1-7cb3-4137-9cb8-0208028f696a__e2443ec95d9856105cd187c305f10785d4233d4fe0480ce2a8b521f83b462708.png";
const GLASS_CALIBRATION_SHA256 =
  "e2443ec95d9856105cd187c305f10785d4233d4fe0480ce2a8b521f83b462708";

async function source<T>(relativePath: string): Promise<{
  path: string;
  fileSha256: string;
  data: T;
}> {
  const bytes = await readFile(new URL(relativePath, ROOT));
  return {
    path: relativePath,
    fileSha256: createHash("sha256").update(bytes).digest("hex"),
    data: JSON.parse(bytes.toString("utf8")) as T,
  };
}

async function fixture(): Promise<CylinderLaneLockedRemediationInput> {
  return {
    generatedAt: "2026-07-15T12:00:00.000Z",
    sources: {
      supersededDualRolePlan: await source<CylinderDualRoleRemediationPlan>(
        SOURCE_PATHS.supersededDualRolePlan,
      ),
      roleAwareReadiness: await source<CylinderRoleAwareReadinessArtifact>(
        SOURCE_PATHS.roleAwareReadiness,
      ),
    },
  };
}

function mutate(
  job: CylinderLaneLockedJob,
  change: (draft: CylinderLaneLockedJob) => void,
): CylinderLaneLockedJob {
  const draft = structuredClone(job);
  change(draft);
  return draft as CylinderLaneLockedJob;
}

describe("Cylinder lane-locked remediation v3", () => {
  it("seals the approved glass and aluminum material calibration bytes independently", () => {
    assert.deepEqual(BEST_BOTTLES_LANE_LOCKED_MATERIAL_CALIBRATIONS, {
      glass: {
        url: GLASS_CALIBRATION_URL,
        bytesSha256: GLASS_CALIBRATION_SHA256,
      },
      aluminum: {
        url: "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1779263636108-9e5b6e2e-88a1-4d39-bfd1-75a2a398a84d.png",
        bytesSha256: "ff15dde94f2a7b5d2076e2e5df6b72ae9bd640454c4b74f672736300103bd382",
      },
    });
  });

  it("emits exactly 192 topology-preserving single-role jobs and retains every missing role as a blocker", async () => {
    const plan = buildCylinderLaneLockedRemediationPlan(await fixture());

    assert.equal(plan.version, BEST_BOTTLES_CYLINDER_LANE_LOCKED_REMEDIATION_VERSION);
    assert.equal(plan.rows.length, 377);
    assert.deepEqual(plan.summary, {
      sourceIdentityCount: 377,
      cylinderIdentityCount: 375,
      vialHandoffCount: 2,
      strictBothRolesReadyCount: 172,
      currentLiveSidecarJobCount: 56,
      detachedSidecarJobCount: 123,
      assembledCapOnJobCount: 13,
      hardBlockedNoEvidenceCount: 11,
      validRoleJobCount: 192,
      blockedRoleSlotCount: 158,
      blockedCylinderIdentityCount: 147,
      externalWriteCount: 0,
    });

    assert.equal(plan.jobs.length, 192);
    assert.equal(plan.jobs.filter((job) => job.role === "pdp-cap-off-sidecar").length, 179);
    assert.equal(plan.jobs.filter((job) => job.role === "identity-cap-on").length, 13);
    assert.equal(plan.jobs.every((job) => job.operation === "preserve-exact-role-reference"), true);
    assert.doesNotMatch(JSON.stringify(plan), /assemble-cap-on-reference/);
    assert.doesNotMatch(JSON.stringify(plan), /preserve-assembled-topology-exception/);

    const detached = plan.rows.filter((row) => row.route === "approved-sidecar-only-missing-cap-on");
    assert.equal(detached.length, 123);
    assert.equal(detached.every((row) => (
      row.jobs.length === 1
      && row.jobs[0].role === "pdp-cap-off-sidecar"
      && row.blockedRoles.identityCapOn.includes("no-approved-exact-cap-on-reference")
      && row.blockedRoles.pdpCapOffSidecar.length === 0
    )), true);

    const assembled = plan.rows.filter((row) => row.route === "approved-cap-on-only-missing-sidecar");
    assert.equal(assembled.length, 13);
    assert.equal(assembled.every((row) => (
      row.jobs.length === 1
      && row.jobs[0].role === "identity-cap-on"
      && row.blockedRoles.identityCapOn.length === 0
      && row.blockedRoles.pdpCapOffSidecar.includes("no-approved-exact-sidecar-reference")
    )), true);

    const none = plan.rows.filter((row) => row.route === "hard-blocked-no-evidence");
    assert.equal(none.length, 11);
    assert.equal(none.every((row) => (
      row.jobs.length === 0
      && row.blockedRoles.identityCapOn.length > 0
      && row.blockedRoles.pdpCapOffSidecar.length > 0
    )), true);
  });

  it("binds each job to its own role, topology, exact reference, prompt, material authority, and aggregate SHA", async () => {
    const plan = buildCylinderLaneLockedRemediationPlan(await fixture());

    for (const job of plan.jobs) {
      assert.doesNotThrow(() => assertCylinderLaneLockedJob(job));
      assert.match(job.productReference.locator, /^(https:\/\/|tmp\/|public\/|docs\/)/);
      assert.match(job.productReference.sha256, /^[a-f0-9]{64}$/);
      assert.equal(job.promptContract.role, job.role);
      assert.match(job.promptContract.sha256, /^[a-f0-9]{64}$/);
      assert.equal(job.materialAuthority.role, job.role);
      const material = job.materialAuthority as typeof job.materialAuthority & {
        materialType: "glass" | "aluminum";
        calibrationUrl: string;
        calibrationBytesSha256: string;
        record: { restriction: string };
      };
      assert.equal(material.materialType, "glass");
      assert.equal(material.calibrationUrl, GLASS_CALIBRATION_URL);
      assert.equal(material.calibrationBytesSha256, GLASS_CALIBRATION_SHA256);
      assert.notEqual(material.calibrationUrl, job.productReference.locator);
      assert.notEqual(material.calibrationBytesSha256, job.productReference.sha256);
      assert.match(material.record.restriction, /style-only/i);
      assert.match(job.materialAuthority.recordSha256, /^[a-f0-9]{64}$/);
      assert.match(job.bindingSha256, /^[a-f0-9]{64}$/);
    }

    assert.doesNotThrow(() => validateCylinderLaneLockedJobs(plan.jobs));
  });

  it("keeps product identity authority separate from the hash-bound material calibration authority", async () => {
    const plan = buildCylinderLaneLockedRemediationPlan(await fixture());

    for (const job of plan.jobs) {
      const prompt = job.promptContract.directives.join(" ");
      assert.match(prompt, /exact role product reference exclusively controls product identity/i);
      assert.match(prompt, /separate hash-bound material calibration controls only/i);
      assert.match(prompt, /optics.*refraction.*edge density.*reflectance.*curvature.*studio finish/i);
      assert.match(prompt, /never identity.*geometry.*topology.*color.*component design/i);
      assert.doesNotMatch(prompt, /material appearance.*only from this .*reference/i);
    }
  });

  it("fails closed on every role/topology/identity/hash/prompt/material/binding mismatch before execution", async () => {
    const plan = buildCylinderLaneLockedRemediationPlan(await fixture());
    const original = plan.jobs.find((job) => job.role === "pdp-cap-off-sidecar")!;
    const cases: Array<[string, CylinderLaneLockedJob]> = [
      ["role", mutate(original, (job) => { job.role = "identity-cap-on"; })],
      ["topology", mutate(original, (job) => { job.requiredTopology = "assembled-cap-on"; })],
      ["identity", mutate(original, (job) => { job.websiteSku = "WRONG"; })],
      ["reference hash", mutate(original, (job) => { job.productReference.sha256 = "0".repeat(64); })],
      ["prompt", mutate(original, (job) => {
        (job.promptContract as { version: string }).version = "wrong";
      })],
      ["material", mutate(original, (job) => { job.materialAuthority.role = "identity-cap-on"; })],
      ["material calibration URL", mutate(original, (job) => {
        (job.materialAuthority as unknown as { calibrationUrl: string }).calibrationUrl =
          job.productReference.locator;
      })],
      ["material calibration hash", mutate(original, (job) => {
        (job.materialAuthority as unknown as { calibrationBytesSha256: string }).calibrationBytesSha256 =
          "0".repeat(64);
      })],
      ["material type", mutate(original, (job) => {
        (job.materialAuthority as unknown as { materialType: string }).materialType = "aluminum";
      })],
      ["binding", mutate(original, (job) => { job.bindingSha256 = "f".repeat(64); })],
    ];

    for (const [label, job] of cases) {
      assert.throws(() => assertCylinderLaneLockedJob(job), new RegExp(label, "i"));
    }
  });

  it("rejects the same exact product locator or hash when it is assigned to opposite roles", async () => {
    const plan = buildCylinderLaneLockedRemediationPlan(await fixture());
    const sidecar = plan.jobs.find((job) => job.role === "pdp-cap-off-sidecar")!;
    const capOn = mutate(sidecar, (job) => {
      job.jobId = `${job.canonicalIdentityKey}|identity-cap-on|preserve-exact-role-reference`;
      job.role = "identity-cap-on";
      job.requiredTopology = "assembled-cap-on";
      job.sourceTopology = "assembled-cap-on";
      job.promptContract.role = "identity-cap-on";
      job.materialAuthority.role = "identity-cap-on";
    });

    assert.throws(
      () => validateCylinderLaneLockedJobs([sidecar, capOn], { validateIndividualBindings: false }),
      /opposite roles.*same (product locator|product reference hash)/i,
    );
  });
});
