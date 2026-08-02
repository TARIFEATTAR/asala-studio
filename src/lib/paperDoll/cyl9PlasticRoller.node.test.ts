import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import sharp from "sharp";

import {
  CYL9_PLASTIC_ROLLER_CONTRACT,
  buildCyl9PlasticRollerRegistrationPlan,
  normalizeRollerLayer,
} from "./cyl9PlasticRoller.node";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";

async function syntheticSource(): Promise<{ bytes: Buffer; sha256: string }> {
  const width = 20;
  const height = 20;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 4; y <= 11; y += 1) {
    for (let x = 5; x <= 14; x += 1) {
      const index = (y * width + x) * 4;
      rgba[index] = 230;
      rgba[index + 1] = 230;
      rgba[index + 2] = 230;
      rgba[index + 3] = x === 5 || x === 14 || y === 4 || y === 11 ? 128 : 255;
    }
  }
  const bytes = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}

test("normalization crops from alpha, follows the shared placement recipe, and preserves exact mask alpha", async () => {
  const source = await syntheticSource();
  const contract = {
    sourceSha256: source.sha256,
    sourceWidthPx: 20,
    sourceHeightPx: 20,
    sourceAlphaBounds: { left: 5, top: 4, right: 14, bottom: 11 },
    canvasWidthPx: 100,
    canvasHeightPx: 120,
    targetWidthPx: 30,
    anchorTopYPx: 10,
    centerXPx: 50,
    alphaFloor: 8,
  };

  const first = await normalizeRollerLayer(source.bytes, contract);
  const second = await normalizeRollerLayer(source.bytes, contract);

  assert.equal(first.widthPx, 100);
  assert.equal(first.heightPx, 120);
  assert.deepEqual(first.alphaBounds, { left: 35, top: 10, right: 64, bottom: 33 });
  assert.equal(first.authorityMaskAlphaExact, true);
  assert.equal(first.imageSha256, second.imageSha256);
  assert.equal(first.geometryMaskSha256, second.geometryMaskSha256);
  assert.deepEqual(first.imageBytes, second.imageBytes);
  assert.deepEqual(first.geometryMaskBytes, second.geometryMaskBytes);
});

test("normalization refuses source identity or alpha-bound drift", async () => {
  const source = await syntheticSource();
  const contract = {
    sourceSha256: source.sha256,
    sourceWidthPx: 20,
    sourceHeightPx: 20,
    sourceAlphaBounds: { left: 5, top: 4, right: 14, bottom: 11 },
    canvasWidthPx: 100,
    canvasHeightPx: 120,
    targetWidthPx: 30,
    anchorTopYPx: 10,
    centerXPx: 50,
    alphaFloor: 8,
  };

  await assert.rejects(
    () => normalizeRollerLayer(source.bytes, { ...contract, sourceSha256: "0".repeat(64) }),
    /source sha/i,
  );
  await assert.rejects(
    () => normalizeRollerLayer(source.bytes, {
      ...contract,
      sourceAlphaBounds: { ...contract.sourceAlphaBounds, bottom: 12 },
    }),
    /alpha bounds/i,
  );
});

test("registration plan is approved, content-addressed, QA-bound, and release-neutral", () => {
  const normalized = {
    imageSha256: "1".repeat(64),
    geometryMaskSha256: "2".repeat(64),
    imageByteSize: 123_456,
    geometryMaskByteSize: 45_678,
    widthPx: 2080,
    heightPx: 2288,
    alphaBounds: { left: 907, top: 675, right: 1175, bottom: 918 },
    authorityMaskAlphaExact: true,
    opaqueWhiteFraction: 0,
  };

  const plan = buildCyl9PlasticRollerRegistrationPlan({
    organizationId: ORGANIZATION_ID,
    source: {
      sha256: CYL9_PLASTIC_ROLLER_CONTRACT.sourceSha256,
      widthPx: 198,
      heightPx: 330,
      alphaBounds: { left: 35, top: 12, right: 186, bottom: 149 },
      status: "approved",
      reviewedBy: "jordan",
      reviewedAt: "2026-07-31T14:57:23.371Z",
    },
    normalized,
  });

  assert.equal(plan.component.slot, "roller");
  assert.equal(plan.component.variantKey, "PLASTIC");
  assert.equal(plan.version.approvalStatus, "approved");
  assert.equal(plan.version.mountAxisXPx, 1041);
  assert.equal(plan.version.seatYPx, 968);
  assert.ok(plan.version.imagePath.endsWith(`${normalized.imageSha256}.png`));
  assert.ok(plan.version.geometryMaskPath.endsWith(`${normalized.geometryMaskSha256}.png`));
  assert.equal(plan.qaResults.length, 4);
  assert.ok(plan.qaResults.every((qa) => qa.blocking && qa.qaStatus === "passed"));
  assert.equal(plan.releaseMutation, false);
});

test("registration plan refuses to relabel an unapproved or geometrically drifted source", () => {
  const normalized = {
    imageSha256: "1".repeat(64),
    geometryMaskSha256: "2".repeat(64),
    imageByteSize: 123_456,
    geometryMaskByteSize: 45_678,
    widthPx: 2080,
    heightPx: 2288,
    alphaBounds: { left: 907, top: 675, right: 1175, bottom: 918 },
    authorityMaskAlphaExact: true,
    opaqueWhiteFraction: 0,
  };
  const approvedSource = {
    sha256: CYL9_PLASTIC_ROLLER_CONTRACT.sourceSha256,
    widthPx: 198,
    heightPx: 330,
    alphaBounds: { left: 35, top: 12, right: 186, bottom: 149 },
    status: "approved" as const,
    reviewedBy: "jordan",
    reviewedAt: "2026-07-31T14:57:23.371Z",
  };

  assert.throws(() => buildCyl9PlasticRollerRegistrationPlan({
    organizationId: ORGANIZATION_ID,
    source: { ...approvedSource, status: "pending-review" },
    normalized,
  }), /approved source/i);
  assert.throws(() => buildCyl9PlasticRollerRegistrationPlan({
    organizationId: ORGANIZATION_ID,
    source: approvedSource,
    normalized: { ...normalized, alphaBounds: { ...normalized.alphaBounds, top: 674 } },
  }), /normalized geometry/i);
});
