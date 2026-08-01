import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";

import {
  buildCyl9DraftRelease,
  detectCyl9ReleaseBodyBounds,
  parseCyl9ReleaseArgs,
  type Cyl9DraftReleaseInput,
} from "./cyl9FamilyRelease.node";

const BODY_VARIANTS = [
  ["clear", "CLR"],
  ["amber", "AMB"],
  ["cobalt", "BLU"],
  ["frosted", "FRS"],
  ["swirl", "SWL"],
] as const;

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function buildFixture(t: test.TestContext): Promise<Cyl9DraftReleaseInput> {
  const root = await mkdtemp(join(tmpdir(), "cyl9-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const assetsDir = join(root, "assets");
  const rendersDir = join(root, "renders");
  const outputDirectory = join(root, "release");
  await mkdir(assetsDir, { recursive: true });
  await mkdir(rendersDir, { recursive: true });

  const bodyEntries = [];
  const expectedBodySha256ById: Record<string, string> = {};
  for (let index = 0; index < BODY_VARIANTS.length; index++) {
    const [color] = BODY_VARIANTS[index];
    const id = `body__cylinder__9ml__${color}__70.0x20.0mm`;
    const path = join(assetsDir, `${id}.png`);
    const bottle = await sharp({
      create: { width: 300, height: 1200, channels: 4, background: { r: 80 + index, g: 90, b: 100, alpha: 1 } },
    }).png().toBuffer();
    await sharp({
      create: { width: 2080, height: 2288, channels: 4, background: "#F5F3EF" },
    }).composite([{ input: bottle, left: 890, top: 800 }]).png().toFile(path);
    const hash = await sha256(path);
    expectedBodySha256ById[id] = hash;
    bodyEntries.push({
      id,
      role: "body-plate",
      asset: { path, sha256: hash, widthPx: 2080, heightPx: 2288, hasAlpha: true },
      status: "approved",
    });
  }

  const renderRecords = [];
  for (const [id, alpha] of [
    ["silver", 255],
    ["matte-white", 255],
    ["glossy-black", 255],
    ["translucent-frosted", 80],
  ] as const) {
    const path = join(rendersDir, `${id}.png`);
    const cap = await sharp({
      create: { width: 40, height: 70, channels: 4, background: { r: 80, g: 80, b: 80, alpha: alpha / 255 } },
    }).png().toBuffer();
    await sharp({
      create: { width: 60, height: 90, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: cap, left: 10, top: 10 }]).png().toFile(path);
    renderRecords.push({ id, path });
  }

  const bodyRegistryPath = join(root, "body-registry.json");
  const placementRecipePath = join(root, "placement-recipe.json");
  const closurePilotManifestPath = join(root, "closure-pilot.json");
  await writeFile(bodyRegistryPath, JSON.stringify({ version: 1, entries: bodyEntries }));
  await writeFile(placementRecipePath, JSON.stringify({
    canvas: { widthPx: 2080, heightPx: 2288, background: "#F5F3EF" },
    placements: {
      "roll-on-over-cap": {
        widthPx: 363,
        anchor: { centerX: 1041, bottomY: 1002 },
      },
    },
  }));
  await writeFile(closurePilotManifestPath, JSON.stringify({
    geometryAuthority: { mesh: "over_cap" },
    qa: { exactBinarySilhouette: true, minIoU: 1, renders: renderRecords },
  }));

  return {
    repositoryRoot: root,
    bodyRegistryPath,
    placementRecipePath,
    closurePilotManifestPath,
    outputDirectory,
    sourceGitCommit: "fixture-commit",
    expectedBodySha256ById,
  };
}

test("CYL-9ML adapter preserves five frozen bodies and blocks translucent", async (t) => {
  const input = await buildFixture(t);
  const result = await buildCyl9DraftRelease(input);

  assert.equal(result.manifest.assets.filter((asset) => asset.slot === "body").length, 5);
  assert.equal(
    result.manifest.assets.filter(
      (asset) => asset.slot === "cap" && asset.approvalStatus === "approved",
    ).length,
    3,
  );
  assert.equal(result.manifest.assemblyMappings.length, 15);
  assert.match(result.validation.blockers.join("\n"), /assembly_context_required/);

  for (const [id, expectedSha] of Object.entries(input.expectedBodySha256ById)) {
    const asset = result.manifest.assets.find((candidate) => candidate.componentKey === id);
    assert.equal(asset?.imageSha256, expectedSha);
  }
});

test("canonical cap layers and geometry mask share the locked canvas", async (t) => {
  const input = await buildFixture(t);
  const result = await buildCyl9DraftRelease(input);

  for (const asset of result.manifest.assets) {
    assert.equal(asset.widthPx, 2080);
    assert.equal(asset.heightPx, 2288);
    const metadata = await sharp(join(input.outputDirectory, asset.imagePath)).metadata();
    assert.deepEqual([metadata.width, metadata.height], [2080, 2288]);
  }

  const opaqueCaps = result.manifest.assets.filter(
    (asset) => asset.slot === "cap" && asset.materialVariant !== "translucent-frosted",
  );
  assert.equal(new Set(opaqueCaps.map((asset) => asset.geometryFamilyId)).size, 1);
  assert.equal(new Set(opaqueCaps.map((asset) => asset.geometryMaskSha256)).size, 1);
  assert.ok(opaqueCaps[0]?.geometryMaskPath);
  const mask = await sharp(join(input.outputDirectory, opaqueCaps[0].geometryMaskPath!)).metadata();
  assert.deepEqual([mask.width, mask.height], [2080, 2288]);
});

test("release CLI arguments require one explicit output directory", () => {
  assert.deepEqual(parseCyl9ReleaseArgs(["--output", "outputs/release"]), {
    outputDirectory: "outputs/release",
  });
  assert.throws(() => parseCyl9ReleaseArgs([]), /--output is required/);
  assert.throws(() => parseCyl9ReleaseArgs(["--output"]), /--output is required/);
});

test("CYL-9ML body bounds survive interrupted swirl relief", () => {
  const width = 40;
  const height = 200;
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    data[index * 4] = 245;
    data[index * 4 + 1] = 243;
    data[index * 4 + 2] = 239;
    data[index * 4 + 3] = 255;
  }
  for (const [top, bottom, left, right] of [
    [35, 85, 12, 18],
    [92, 142, 19, 23],
    [149, 180, 24, 27],
  ]) {
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const index = (y * width + x) * 4;
        data[index] = 120;
        data[index + 1] = 120;
        data[index + 2] = 120;
      }
    }
  }

  assert.deepEqual(detectCyl9ReleaseBodyBounds({ data, width, height, hasAlpha: true }), {
    left: 12,
    right: 27,
    top: 35,
    bottom: 180,
  });
});
