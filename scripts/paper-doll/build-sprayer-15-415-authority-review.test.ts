import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  buildCalibratedAuthorityMask,
  buildSprayerAuthorityReview,
  cleanCalibratedDetachedAlphaIslands,
  normalizeSourceMaterialToAuthority,
} from "./build-sprayer-15-415-authority-review";

async function rectanglePng(width: number, height: number, inset = 0): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{
    input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" fill="#b87333"/></svg>`),
  }]).png().toBuffer();
}

async function alphaBoundsForTest(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

test("calibrates a source silhouette uniformly to the physical width and mount seat", async () => {
  const authority = await buildCalibratedAuthorityMask({
    sourcePng: await rectanglePng(12, 22, 1),
    canvas: { widthPx: 100, heightPx: 120 },
    targetWidthPx: 20,
    centerXPx: 50,
    seatYPx: 90,
    allowedHeightPx: { minimum: 39, maximum: 45 },
  });

  assert.deepEqual(authority.sourceBoundsPx, { left: 1, top: 1, width: 10, height: 20 });
  assert.deepEqual(authority.authorityBoundsPx, { left: 40, top: 50, width: 20, height: 40 });
  assert.equal(authority.uniformScale, 2);
});

test("normalizes source material without changing the authority alpha", async () => {
  const authority = await buildCalibratedAuthorityMask({
    sourcePng: await rectanglePng(12, 22, 1),
    canvas: { widthPx: 100, heightPx: 120 },
    targetWidthPx: 20,
    centerXPx: 50,
    seatYPx: 90,
    allowedHeightPx: { minimum: 39, maximum: 45 },
  });
  const candidate = await normalizeSourceMaterialToAuthority({
    sourcePng: await rectanglePng(16, 18, 2),
    authorityMaskPng: authority.maskPng,
  });

  assert.equal(candidate.qa.mismatchedPixels, 0);
  assert.equal(candidate.qa.geometryLocked, true);
  assert.deepEqual(candidate.authorityBoundsPx, authority.authorityBoundsPx);
});

test("removes only source-calibrated detached alpha islands and records the measurement", async () => {
  const source = await sharp({
    create: { width: 20, height: 30, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: Buffer.from('<svg width="20" height="30" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="10" height="20" fill="#fff"/><rect x="1" y="1" width="2" height="2" fill="#fff"/><rect x="18" y="28" width="1" height="1" fill="#fff"/></svg>') },
  ]).png().toBuffer();

  const cleaned = await cleanCalibratedDetachedAlphaIslands({
    sourcePng: source,
    calibration: {
      expectedSourceComponents: 3,
      maxDiscardedComponentPixels: 4,
      maxDiscardedTotalPixels: 5,
    },
  });

  assert.equal(cleaned.report.measuredSourceComponents, 3);
  assert.equal(cleaned.report.retainedComponentPixels, 200);
  assert.deepEqual(cleaned.report.discardedComponentPixels, [4, 1]);
  assert.equal(cleaned.report.discardedTotalPixels, 5);
  assert.deepEqual(await alphaBoundsForTest(cleaned.png), { left: 5, top: 5, width: 10, height: 20 });
});

test("rejects an undeclared second object instead of silently cleaning it", async () => {
  const source = await sharp({
    create: { width: 20, height: 30, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: Buffer.from('<svg width="20" height="30" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="10" height="20" fill="#fff"/><rect x="0" y="0" width="3" height="3" fill="#fff"/></svg>') },
  ]).png().toBuffer();

  await assert.rejects(
    cleanCalibratedDetachedAlphaIslands({
      sourcePng: source,
      calibration: {
        expectedSourceComponents: 2,
        maxDiscardedComponentPixels: 4,
        maxDiscardedTotalPixels: 4,
      },
    }),
    /exceeds calibrated maximum/,
  );
});

test("builds two five-appearance review families while keeping the dip tube contextual", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "sprayer-authority-review-"));
  const extractedRoot = path.join(temporary, "extracted");
  const outputRoot = path.join(temporary, "output");
  const bodyRoot = path.join(temporary, "bodies");
  await Promise.all([mkdir(extractedRoot, { recursive: true }), mkdir(bodyRoot, { recursive: true })]);
  const head = await rectanglePng(12, 22, 1);
  const overcap = await rectanglePng(12, 22, 1);
  const files: string[] = [];
  const assets = [];
  for (const partId of ["sprayer-head", "protective-overcap"] as const) {
    for (const [index, variantKey] of ["SBLK", "MGLD", "MSLV", "SGLD", "SSLV"].entries()) {
      const filePath = path.join(extractedRoot, `${partId}-${variantKey}.png`);
      const bytes = partId === "sprayer-head" ? head : overcap;
      await writeFile(filePath, bytes);
      files.push(filePath);
      assets.push({
        partId,
        sourceId: partId === "sprayer-head" && variantKey === "SSLV" ? "psd-head-shiny-silver" : `${partId}-${variantKey}`,
        cutoutPath: filePath,
        cutoutSha256: createHash("sha256").update(bytes).digest("hex"),
        originalFilename: `${variantKey}.psd`,
        sourceSha256: "a".repeat(64),
        variantKey,
        index,
      });
    }
  }
  const overcapMaskPath = path.join(temporary, "overcap-mask.png");
  await writeFile(overcapMaskPath, overcap);
  const bodyPaths = [];
  for (const body of ["clear", "amber", "cobalt", "frosted", "swirl"]) {
    const bodyPath = path.join(bodyRoot, `${body}.png`);
    await writeFile(bodyPath, await sharp({ create: { width: 100, height: 120, channels: 4, background: "#F5F3EF" } }).png().toBuffer());
    bodyPaths.push({ bodyId: body, path: bodyPath });
  }
  const manifestPath = path.join(extractedRoot, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({ assets }));

  const result = await buildSprayerAuthorityReview({
    extractionManifestPath: manifestPath,
    overcapBlenderMaskPath: overcapMaskPath,
    outputRoot,
    canvas: { widthPx: 100, heightPx: 120 },
    calibration: {
      pxPerMm: 2,
      outsideDiameterMm: 10,
      outsideDiameterToleranceMm: 0.5,
      heightMm: 20,
      heightToleranceMm: 1.5,
      centerXPx: 50,
      seatYPx: 90,
    },
    scaleContextBodyPlates: bodyPaths,
  });
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));

  assert.equal(manifest.responsibilities[0].authoritySourceId, "psd-head-shiny-silver");
  assert.deepEqual(manifest.responsibilities.map((value: { candidateCount: number }) => value.candidateCount), [5, 5]);
  assert.equal(manifest.bodyContextualResponsibilities[0].partId, "dip-tube");
  assert.ok(manifest.qa.every((value: { exactAlpha: boolean }) => value.exactAlpha));
  assert.equal(manifest.geometryLocked, false);
  assert.equal(manifest.productionEligible, false);
  assert.equal(manifest.compatibilityClaim, "none");
  assert.equal(manifest.familyFitApprovalRequired, false);
  assert.equal(manifest.compatibilityReviewRequired, true);
  assert.equal(manifest.currentReleaseChanged, false);
  assert.equal(manifest.sanityChanged, false);
  assert.equal(result.contactSheetPaths.length, 4);
  assert.ok(result.contactSheetPaths.filter((value: string) => value.endsWith("five-body-scale-context.png")).length === 2);
  assert.equal(files.length, 10);
});
