import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildBodyContextWeldPlan,
  type BodyContextDispenserInput,
  type BodyPlateRegistry,
} from "./bodyContextWeldPlan";

const workspaceRoot = path.resolve(import.meta.dirname, "../../..");

async function loadBodyRegistry(): Promise<BodyPlateRegistry> {
  return JSON.parse(await readFile(
    path.join(workspaceRoot, "docs/paper-doll-rig/body-plate-registry.json"),
    "utf8",
  )) as BodyPlateRegistry;
}

const SPRAYER: BodyContextDispenserInput = {
  lane: "sprayer",
  componentPartId: "sprayer-dip-tube",
  exteriorSeatY: 1002,
  stockTubeLengthMm: 93.8,
  tubeDiameterMm: null,
  interiorBottomMarginMm: null,
  includesInsertedPlug: true,
  sourceEvidence: "Best Bottles catalog dimension; tube width and target-body trim remain unverified",
};

const PUMP: BodyContextDispenserInput = {
  lane: "pump",
  componentPartId: "pump-dip-tube",
  exteriorSeatY: 1002,
  stockTubeLengthMm: null,
  tubeDiameterMm: null,
  interiorBottomMarginMm: null,
  includesInsertedPlug: true,
  sourceEvidence: "No verified pump tube length or diameter is present in the repository",
};

test("builds five explicit body-context jobs without emitting a reusable plate", async () => {
  const plan = buildBodyContextWeldPlan({
    familyId: "CYL-9ML-17-415",
    bodyRegistry: await loadBodyRegistry(),
    dispensers: [SPRAYER, PUMP],
  });

  assert.equal(plan.jobs.length, 10);
  assert.deepEqual(plan.summary, {
    bodyCount: 5,
    dispenserCount: 2,
    jobCount: 10,
    productionReadyJobCount: 0,
    dimensionReviewJobCount: 5,
    blockedJobCount: 5,
  });
  assert.equal(plan.reusablePlateIds.length, 0);
  assert.ok(plan.jobs.every((job) => job.outputPolicy === "body-contextual-weld"));
  assert.deepEqual(plan.mutationPolicy, {
    masksWritten: false,
    candidatesGenerated: false,
    remoteWritesPerformed: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  });
});

test("preserves each locked body SHA, centerline, neck registration, and measured baseline", async () => {
  const registry = await loadBodyRegistry();
  const plan = buildBodyContextWeldPlan({
    familyId: "CYL-9ML-17-415",
    bodyRegistry: registry,
    dispensers: [SPRAYER],
  });

  const byColor = new Map(plan.jobs.map((job) => [job.bodyColorway, job]));
  assert.equal(byColor.get("clear")?.bodyAssetSha256, registry.entries[0].asset.sha256);
  assert.equal(byColor.get("clear")?.registration.baselineY, 2086);
  assert.equal(byColor.get("frosted")?.registration.baselineY, 2092);
  assert.equal(byColor.get("swirl")?.registration.baselineY, 2091);
  assert.equal(byColor.get("amber")?.registration.baselineY, 2089);
  assert.equal(byColor.get("cobalt")?.registration.baselineY, 2089);
  assert.ok(plan.jobs.every((job) => job.registration.centerX === 1041));
  assert.ok(plan.jobs.every((job) => job.registration.neckTopY === 760));
  assert.ok(plan.jobs.every((job) => job.registration.neckBaseY === 968));
  assert.ok(plan.jobs.every((job) => job.registration.exteriorSeatY === 1002));
});

test("records stock length separately from body-clipped rendered reach", async () => {
  const plan = buildBodyContextWeldPlan({
    familyId: "CYL-9ML-17-415",
    bodyRegistry: await loadBodyRegistry(),
    dispensers: [SPRAYER],
  });

  const clear = plan.jobs.find((job) => job.bodyColorway === "clear");
  assert.ok(clear);
  assert.equal(clear.stockTubeLengthMm, 93.8);
  assert.equal(clear.renderedPath.startY, 1003);
  assert.equal(clear.renderedPath.maximumBottomY, 2085);
  assert.equal(clear.renderedPath.maximumReachPx, 1083);
  assert.equal(clear.renderedPath.mustClipToBodyInterior, true);
  assert.equal(clear.renderedPath.finalBottomY, null);
  assert.equal(clear.renderedPath.finalReachMm, null);
});

test("never converts physical tube dimensions through an ambiguous family scale", async () => {
  const plan = buildBodyContextWeldPlan({
    familyId: "CYL-9ML-17-415",
    bodyRegistry: await loadBodyRegistry(),
    dispensers: [SPRAYER],
  });

  assert.equal(plan.scaleCalibration.status, "ambiguous-review-required");
  assert.ok(plan.scaleCalibration.threadCrestPxPerMm > 15);
  assert.ok(plan.scaleCalibration.bodyHeightProxyPxPerMm > 18);
  assert.ok(plan.scaleCalibration.divergencePercent > 10);
  assert.ok(plan.jobs.every((job) => job.mask === null));
  assert.ok(plan.jobs.every((job) => job.blockers.includes("tube-diameter-unverified")));
  assert.ok(plan.jobs.every((job) => job.blockers.includes("interior-bottom-margin-unverified")));
  assert.ok(plan.jobs.every((job) => job.blockers.includes("pixel-scale-ambiguous")));
  assert.ok(plan.jobs.every((job) => job.state === "dimension-review-required"));
});

test("blocks the pump when stock length and diameter evidence are both missing", async () => {
  const plan = buildBodyContextWeldPlan({
    familyId: "CYL-9ML-17-415",
    bodyRegistry: await loadBodyRegistry(),
    dispensers: [PUMP],
  });

  assert.ok(plan.jobs.every((job) => job.state === "blocked-missing-tube-dimensions"));
  assert.ok(plan.jobs.every((job) => job.blockers.includes("stock-tube-length-unverified")));
  assert.ok(plan.jobs.every((job) => job.blockers.includes("tube-diameter-unverified")));
  assert.ok(plan.jobs.every((job) => job.mask === null));
});

test("rejects body entries that are not approved or do not match the canonical canvas", async () => {
  const registry = await loadBodyRegistry();
  const badStatus = structuredClone(registry);
  badStatus.entries[0].status = "draft";
  assert.throws(() => buildBodyContextWeldPlan({
    familyId: "CYL-9ML-17-415",
    bodyRegistry: badStatus,
    dispensers: [SPRAYER],
  }), /must be approved/);

  const badCanvas = structuredClone(registry);
  badCanvas.entries[0].asset.widthPx = 1000;
  assert.throws(() => buildBodyContextWeldPlan({
    familyId: "CYL-9ML-17-415",
    bodyRegistry: badCanvas,
    dispensers: [SPRAYER],
  }), /canonical 2080x2288 canvas/);
});
