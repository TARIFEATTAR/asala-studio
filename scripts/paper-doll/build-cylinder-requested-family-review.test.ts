import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { buildCylinderRequestedFamilyReview } from "./build-cylinder-requested-family-review";

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

async function fixture(width: number, height: number, color: { r: number; g: number; b: number }) {
  return sharp({
    create: { width, height, channels: 4, background: { ...color, alpha: 1 } },
  }).png().toBuffer();
}

function recipe(sourceSha256: string) {
  return {
    schemaVersion: 1,
    state: "source-registered-review-only",
    canonicalCanvas: { width: 200, height: 240, centerX: 100, baselineY: 220, background: "#F5F3EF" },
    rules: {
      transformScope: "complete-paper-doll-assembly",
      geometryLockGate: "approved-exact-alpha-mask-and-clamp",
      enhancementPolicy: "material-and-lighting-only",
      detachedComponentPolicy: "review-only-until-family-fit-approval",
      remoteWritesAllowed: false,
    },
    rejectedRegistrations: [{
      requestedLabel: "28 mL big roll-on",
      rejectedFamilyKey: "CYL-28ML-16MM-ROLLON",
      reason: "User confirmed this sold Best Bottles product is not the intended bottle.",
      promotionAllowed: false,
      catalogEvidence: {
        skus: ["GB-CYL-CLR-28ML-RBL-WHT", "GB-CYL-CLR-28ML-RBL"],
      },
      sourceEvidence: {
        archiveRelativePath: "Rollon bottles - 30ml and 50ml/2. 28ml Uncapped/4. GBCyl28RollWht.psd",
        sha256: "6f63bd84d0ababc7a48ab3c26c6804c7ca2e19e032c6828dcbda1fc1534534d0",
      },
    }],
    unresolvedRequestedFamilies: [{
      requestedLabel: "28 mL big roll-on",
      status: "missing-exact-identity",
      requiredEvidence: "One exact SKU, product URL, photograph, or measured dimensions.",
    }],
    families: [{
      familyKey: "CYL-100ML-18-415-SPRAY",
      label: "100 mL spray",
      displayKey: "spray|100",
      geometry: {
        geometryKey: "body__fixture",
        capacityMl: 100,
        bodyHeightMm: 154,
        bodyWidthMm: 35,
        neckFinish: "18-415",
      },
      source: {
        archiveRelativePath: "100/source.psd",
        originalFilename: "source.psd",
        sha256: sourceSha256,
        canvas: { width: 120, height: 100 },
        identityStatus: "source-backed",
      },
      layers: [
        { layerId: "body", role: "body", sceneIndex: 2, sourceBoundsPx: { left: 20, top: 30, width: 40, height: 80 }, assemblyMember: true, zIndex: 10 },
        { layerId: "dip-tube", role: "body-contextual", sceneIndex: 3, sourceBoundsPx: { left: 35, top: 45, width: 8, height: 60 }, assemblyMember: true, zIndex: 20 },
        { layerId: "sprayer-head", role: "exterior-component", sceneIndex: 4, sourceBoundsPx: { left: 25, top: 10, width: 30, height: 25 }, assemblyMember: true, zIndex: 30 },
        { layerId: "opaque-overcap", role: "detached-review", sceneIndex: 5, sourceBoundsPx: { left: 80, top: 80, width: 30, height: 40 }, assemblyMember: false, zIndex: 40 },
      ],
    }],
  };
}

test("materializes full-canvas review plates with one assembly transform", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "cylinder-requested-family-"));
  const archiveRoot = path.join(temporary, "archive");
  const outputRoot = path.join(temporary, "output");
  const sourceBytes = Buffer.from("Photoshop source fixture");
  await mkdir(path.join(archiveRoot, "100"), { recursive: true });
  await writeFile(path.join(archiveRoot, "100/source.psd"), sourceBytes);

  const sourceRecipe = recipe(sha256(sourceBytes));
  const dimensions = new Map(sourceRecipe.families[0].layers.map((layer) => [
    layer.sceneIndex,
    layer.sourceBoundsPx,
  ]));
  const result = await buildCylinderRequestedFamilyReview({
    recipe: sourceRecipe,
    archiveRoot,
    outputRoot,
    generatedAt: "2026-08-03T12:00:00.000Z",
    decodePsdScene: async (_sourcePath, sceneIndex) => {
      const bounds = dimensions.get(sceneIndex)!;
      return fixture(bounds.width, bounds.height, sceneIndex === 2
        ? { r: 180, g: 90, b: 30 }
        : sceneIndex === 3
          ? { r: 220, g: 220, b: 220 }
          : { r: 30, g: 30, b: 30 });
    },
  });

  const family = result.manifest.families[0];
  const body = family.layers.find((layer) => layer.layerId === "body")!;
  const tube = family.layers.find((layer) => layer.layerId === "dip-tube")!;
  const head = family.layers.find((layer) => layer.layerId === "sprayer-head")!;
  const cap = family.layers.find((layer) => layer.layerId === "opaque-overcap")!;
  assert.equal(family.catalogPresentation.targetAssembledHeightPct, 79);
  assert.equal(body.uniformScale, family.uniformScale);
  assert.equal(tube.uniformScale, family.uniformScale);
  assert.equal(head.uniformScale, family.uniformScale);
  assert.equal(cap.uniformScale, null);
  assert.equal(cap.placementBoundsPx, null);
  assert.equal(cap.fullCanvasPlatePath, null);
  assert.ok(cap.detachedReviewPath);
  assert.deepEqual(tube.sourceBoundsPx, { left: 35, top: 45, width: 8, height: 60 });
  assert.deepEqual(tube.editBoundsPx, { left: 35, top: 45, width: 8, height: 55 });
  assert.equal(family.geometryLocked, false);
  assert.equal(family.productionEligible, false);
  assert.deepEqual(result.manifest.mutationPolicy, {
    remoteWritesPerformed: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  });
  assert.equal(result.manifest.rejectedRegistrations.length, 1);
  assert.equal(result.manifest.rejectedRegistrations[0].promotionAllowed, false);
  assert.equal(result.manifest.unresolvedRequestedFamilies.length, 1);
  assert.equal(result.manifest.summary.rejectedRegistrationCount, 1);
  assert.equal(result.manifest.summary.unresolvedRequestedFamilyCount, 1);
  assert.equal((await sharp(body.fullCanvasPlatePath!).metadata()).width, 200);
  assert.equal((await sharp(family.assemblyPreviewPath).metadata()).height, 240);
  assert.equal((await sharp(result.contactSheetPath).metadata()).width, 720);
  assert.equal(JSON.parse(await readFile(result.manifestPath, "utf8")).families.length, 1);
});

test("rejects a mutated PSD before creating a review manifest", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "cylinder-requested-family-mutated-"));
  const archiveRoot = path.join(temporary, "archive");
  const outputRoot = path.join(temporary, "output");
  await mkdir(path.join(archiveRoot, "100"), { recursive: true });
  await writeFile(path.join(archiveRoot, "100/source.psd"), "mutated");

  await assert.rejects(() => buildCylinderRequestedFamilyReview({
    recipe: recipe(sha256(Buffer.from("original"))),
    archiveRoot,
    outputRoot,
    decodePsdScene: async () => fixture(1, 1, { r: 0, g: 0, b: 0 }),
  }), /SHA-256 mismatch/);
  await assert.rejects(() => readFile(path.join(outputRoot, "manifest.json")), /ENOENT/);
});
