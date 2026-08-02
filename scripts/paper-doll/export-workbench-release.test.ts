import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import sharp from "sharp";

import type { PaperDollReleaseManifest } from "../../src/lib/paperDoll/releaseContract";
import { validatePaperDollRelease } from "../../src/lib/paperDoll/releaseValidator";
import { exportWorkbenchRelease } from "./export-workbench-release";

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writePlate(path: string, rgba: { r: number; g: number; b: number; alpha: number }) {
  await mkdir(dirname(path), { recursive: true });
  const bytes = await sharp({
    create: {
      width: 2080,
      height: 2288,
      channels: 4,
      background: rgba,
    },
  }).png().toBuffer();
  await writeFile(path, bytes);
  return sha256(bytes);
}

async function buildFixture() {
  const root = await mkdtemp(join(tmpdir(), "paper-doll-workbench-export-"));
  const releaseDirectory = join(root, "release");
  const canonicalBodyPath = join(root, "assets", "body.png");
  const capPath = join(releaseDirectory, "layers", "cap", "SILVER.png");
  const maskPath = join(releaseDirectory, "geometry", "cap-mask.png");
  const outputTsPath = join(root, "src", "generated", "release.generated.ts");
  const componentAssetDirectory = join(root, "assets", "release-components");

  const bodySha = await writePlate(canonicalBodyPath, { r: 245, g: 243, b: 239, alpha: 1 });
  const capSha = await writePlate(capPath, { r: 180, g: 180, b: 180, alpha: 0 });
  const maskSha = await writePlate(maskPath, { r: 255, g: 255, b: 255, alpha: 0 });

  const manifest: PaperDollReleaseManifest = {
    schemaVersion: 1,
    familyKey: "TEST-9ML",
    releaseVersion: "1.0.0-test.1",
    status: "ready",
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    assets: [
      {
        componentVersionId: `body@test-${bodySha.slice(0, 12)}`,
        componentKey: "body__test",
        geometryFamilyId: "body__test__v1",
        slot: "body",
        variantKey: "CLR",
        materialVariant: "clear-glass",
        imagePath: "layers/body/CLR.png",
        imageSha256: bodySha,
        geometryMaskPath: null,
        geometryMaskSha256: null,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: { left: 860, top: 750, right: 1225, bottom: 2089 },
        mountAxisXPx: 1041,
        seatYPx: 2090,
        approvalStatus: "approved",
      },
      {
        componentVersionId: `cap@test-${capSha.slice(0, 12)}`,
        componentKey: "cap__test",
        geometryFamilyId: "cap__test__v1",
        slot: "cap",
        variantKey: "SILVER",
        materialVariant: "mirror-chrome",
        imagePath: "layers/cap/SILVER.png",
        imageSha256: capSha,
        geometryMaskPath: "geometry/cap-mask.png",
        geometryMaskSha256: maskSha,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: { left: 860, top: 494, right: 1222, bottom: 1001 },
        mountAxisXPx: 1041,
        seatYPx: 1002,
        approvalStatus: "approved",
      },
    ],
    assemblyRecipes: [{ recipeKey: "rollon-capped", mode: "rollon", layerOrder: ["body", "cap"] }],
    assemblyMappings: [{
      mappingKey: "TEST-9ML:CLR:ROLLON:SILVER",
      websiteSku: "TEST-WEB",
      graceSku: "TEST-GRACE",
      recipeKey: "rollon-capped",
      bodyVariantKey: "CLR",
      fitmentVariantKey: null,
      closureVariantKey: "SILVER",
      overcapVariantKey: null,
    }],
    qaEvidence: [{
      evidenceId: "qa:shared-mask",
      subjectId: "cap__test__v1",
      gateKey: "shared-geometry-mask",
      gateVersion: "test-v1",
      status: "passed",
      blocking: true,
      calibratedWith: ["fixture:silver"],
      measurements: { minIoU: 1 },
      issues: [],
    }],
    blockers: [],
    provenance: { sourceGitCommit: "fixture-commit", rendererVersion: "fixture-renderer" },
  };
  await mkdir(releaseDirectory, { recursive: true });
  await writeFile(join(releaseDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    join(releaseDirectory, "validation.json"),
    `${JSON.stringify(validatePaperDollRelease(manifest), null, 2)}\n`,
  );

  return {
    root,
    releaseDirectory,
    canonicalBodyPath,
    bodySha,
    outputTsPath,
    componentAssetDirectory,
  };
}

test("exports a deterministic browser snapshot without copying frozen body plates", async () => {
  const fixture = await buildFixture();
  const result = await exportWorkbenchRelease({
    repositoryRoot: fixture.root,
    releaseDirectory: fixture.releaseDirectory,
    outputTsPath: fixture.outputTsPath,
    componentAssetDirectory: fixture.componentAssetDirectory,
    canonicalBodyPathsBySha: { [fixture.bodySha]: fixture.canonicalBodyPath },
  });

  assert.equal(result.assetCount, 2);
  assert.equal(result.copiedComponentFileCount, 2);
  assert.match(result.manifestSha256, /^[a-f0-9]{64}$/);

  const generated = await readFile(fixture.outputTsPath, "utf8");
  assert.match(generated, /GENERATED FILE — DO NOT EDIT/);
  assert.match(generated, /parsePaperDollReleaseManifest/);
  assert.match(generated, /layers\/body\/CLR\.png/);
  assert.match(generated, /layers\/cap\/SILVER\.png/);
  assert.match(generated, /geometry\/cap-mask\.png/);
  assert.match(generated, new RegExp(result.manifestSha256));
  await assert.rejects(
    readFile(join(fixture.componentAssetDirectory, "layers", "body", "CLR.png")),
    /ENOENT/,
  );
});

test("fails closed when validation evidence or referenced bytes drift", async () => {
  const validationFixture = await buildFixture();
  await writeFile(
    join(validationFixture.releaseDirectory, "validation.json"),
    `${JSON.stringify({ ready: false, blockers: ["fabricated"], advisories: [], assetCountBySlot: {} })}\n`,
  );
  await assert.rejects(
    exportWorkbenchRelease({
      repositoryRoot: validationFixture.root,
      releaseDirectory: validationFixture.releaseDirectory,
      outputTsPath: validationFixture.outputTsPath,
      componentAssetDirectory: validationFixture.componentAssetDirectory,
      canonicalBodyPathsBySha: { [validationFixture.bodySha]: validationFixture.canonicalBodyPath },
    }),
    /validation\.json does not match/i,
  );

  const bytesFixture = await buildFixture();
  await writeFile(join(bytesFixture.releaseDirectory, "layers", "cap", "SILVER.png"), "drifted");
  await assert.rejects(
    exportWorkbenchRelease({
      repositoryRoot: bytesFixture.root,
      releaseDirectory: bytesFixture.releaseDirectory,
      outputTsPath: bytesFixture.outputTsPath,
      componentAssetDirectory: bytesFixture.componentAssetDirectory,
      canonicalBodyPathsBySha: { [bytesFixture.bodySha]: bytesFixture.canonicalBodyPath },
    }),
    /SHA-256 mismatch/i,
  );
});
