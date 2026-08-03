import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  parsePaperDollFamilyProductionManifest,
  type PaperDollFamilyProductionManifest,
} from "../../src/lib/paperDoll/componentPlateContract";
import { buildComponentCandidate } from "./build-component-candidate";

const sha = (character: string) => character.repeat(64);

async function rgbaPng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function manifestFixture(maskPath: string, maskSha256: string): PaperDollFamilyProductionManifest {
  return parsePaperDollFamilyProductionManifest({
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    bodyPlates: [{
      bodyVariantKey: "AMB",
      componentVersionId: "body-amber-v1",
      imagePath: "body-amber.png",
      imageSha256: sha("a"),
    }],
    components: [{
      componentKey: "closure__17-415__rollon-overcap__SGLD",
      slot: "cap",
      geometryFamilyId: "closure__17-415__rollon-overcap__v2",
      source: {
        originalFilename: "CpRoll17-415ShnGl.png",
        path: "source-gold.png",
        sha256: sha("b"),
        widthPx: 8,
        heightPx: 8,
      },
      authorityStatus: "approved",
      authority: {
        authorityId: "authority-cap-v1",
        maskPath,
        maskSha256,
        maskWidthPx: 2080,
        maskHeightPx: 2288,
        authorityBoundsPx: { left: 1000, top: 500, width: 6, height: 8 },
        expectedRegions: 1,
      },
      variants: [{
        variantKey: "SGLD",
        materialVariant: "shiny-gold",
        materialClass: "mirror",
      }],
      compatibleBodyVariantKeys: ["AMB"],
    }],
    placements: [{
      placementVersionId: "placement-cap-calibration-v1",
      geometryFamilyId: "closure__17-415__rollon-overcap__v2",
      widthPx: 12,
      centerXPx: 1041,
      seatYPx: 1002,
      placementBoundsPx: { left: 1035, top: 986, width: 12, height: 16 },
      compatibleBodyVariantKeys: ["AMB"],
      locked: false,
    }],
    catalogMappings: [],
    releaseTarget: { sanityDocumentId: "fixture" },
  });
}

test("candidate build preserves original filename and emits exact-alpha evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "paper-doll-candidate-"));
  try {
    const materialPath = join(directory, "generated.png");
    const maskPath = join(directory, "mask.png");
    const materialPng = await rgbaPng(8, 8, (x, y) => [30 + x, 50 + y, 70, 255]);
    const maskPng = await rgbaPng(2080, 2288, (x, y) => (
      x >= 1000 && x <= 1005 && y >= 500 && y <= 507
        ? [255, 255, 255, x === 1000 || x === 1005 ? 128 : 255]
        : [0, 0, 0, 0]
    ));
    await Promise.all([
      writeFile(materialPath, materialPng),
      writeFile(maskPath, maskPng),
    ]);

    const result = await buildComponentCandidate({
      manifest: manifestFixture(
        maskPath,
        createHash("sha256").update(maskPng).digest("hex"),
      ),
      componentKey: "closure__17-415__rollon-overcap__SGLD",
      variantKey: "SGLD",
      sourcePath: materialPath,
      originalFilename: "physical-gold-cap.jpg",
      sourceBoundsPx: { left: 1, top: 2, width: 6, height: 4 },
      editBoundsPx: { left: 1, top: 2, width: 6, height: 4 },
      provider: "openai",
      model: "gpt-image-2",
      prompt: "Change surface pixels only.",
      outputDirectory: join(directory, "output"),
    });

    assert.equal(result.record.source.originalFilename, "physical-gold-cap.jpg");
    assert.equal(result.record.qa.minIoU, 1);
    assert.equal(result.record.qa.mismatchedPixels, 0);
    assert.equal(result.record.qa.geometryLocked, true);
    assert.equal(result.record.placementVersionId, null);
    assert.deepEqual(result.record.mutationPolicy, {
      currentReleaseChanged: false,
      sanityChanged: false,
    });
    assert.equal(JSON.parse(await readFile(result.paths.manifestPath, "utf8")).candidateId, result.record.candidateId);
    await Promise.all(Object.values(result.paths).map((path) => readFile(path)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("candidate build rejects missing authority and path-like original filenames", async () => {
  const directory = await mkdtemp(join(tmpdir(), "paper-doll-candidate-invalid-"));
  try {
    const materialPath = join(directory, "generated.png");
    const maskPath = join(directory, "mask.png");
    await writeFile(materialPath, await rgbaPng(8, 8, () => [30, 50, 70, 255]));
    const manifest = manifestFixture(maskPath, sha("c"));
    manifest.components[0].authorityStatus = "missing";
    manifest.components[0].authority = null;

    await assert.rejects(() => buildComponentCandidate({
      manifest,
      componentKey: manifest.components[0].componentKey,
      variantKey: "SGLD",
      sourcePath: materialPath,
      originalFilename: "folder/physical-gold-cap.jpg",
      sourceBoundsPx: { left: 1, top: 2, width: 6, height: 4 },
      editBoundsPx: { left: 1, top: 2, width: 6, height: 4 },
      provider: "manual",
      model: "manual-v1",
      prompt: null,
      outputDirectory: join(directory, "output"),
    }), /authority|filename/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
