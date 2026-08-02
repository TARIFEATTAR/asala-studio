import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { conditionWholeRoleReference } from "./condition-whole-role-reference";

test("uniformly scales the entire exact role group to the canonical body height and baseline", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "bb-role-condition-"));
  try {
    const sourcePath = path.join(directory, "source.png");
    const outputPath = path.join(directory, "conditioned.png");
    const maskPath = path.join(directory, "conditioned-mask.png");
    const identityOverlayPath = path.join(directory, "conditioned-identity-overlay.png");
    const recordPath = path.join(directory, "conditioned.json");
    const source = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "white" },
    }).composite([
      { input: { create: { width: 20, height: 60, channels: 3, background: "black" } }, left: 40, top: 20 },
      { input: { create: { width: 15, height: 30, channels: 3, background: "black" } }, left: 70, top: 50 },
    ]).png().toBuffer();
    await writeFile(sourcePath, source);
    const record = await conditionWholeRoleReference({
      websiteSku: "TEST",
      assetRole: "sidecar",
      sourcePath,
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      outputPath,
      maskPath,
      identityOverlayPath,
      recordPath,
      sourceGeometry: {
        foregroundBounds: { left: 40, top: 20, width: 45, height: 60 },
        bodyLeftX: 40,
        bodyRightXExclusive: 60,
        bodyTopY: 40,
        bodyBottomYExclusive: 80,
        primaryCenterX: 50,
      },
      canvas: { widthPx: 200, heightPx: 240, boneHex: "#F5F3EF" },
      target: {
        bodyHeightPx: 80,
        bodyWidthPx: 40,
        baselineYPx: 220,
        primaryCenterXPx: 100,
      },
    });
    assert.equal(record.uniformScale, 2);
    assert.equal(record.targetBodyBounds.top, 141);
    assert.equal(record.targetBodyBounds.left, 80);
    assert.equal(record.targetBodyBounds.right, 119);
    assert.equal(record.targetBodyBounds.bottom, 220);
    assert.equal(record.postGenerationMutationAllowed, false);
    assert.equal(record.operation, "pre-generation-whole-role-uniform-conditioning");
    assert.equal(record.maskPath, maskPath);
    assert.equal(record.identityOverlayPath, identityOverlayPath);
    assert.match(record.maskSha256, /^[a-f0-9]{64}$/);
    assert.match(record.identityOverlaySha256, /^[a-f0-9]{64}$/);
    assert.equal(
      record.identityOverlaySemantics,
      "exact-sprayer-closure-sidecar-with-body-removed",
    );
    assert.equal(
      record.maskSemantics,
      "transparent-body-material-edit-opaque-hardware-sidecar-bone-preserve",
    );
    const metadata = await sharp(outputPath).metadata();
    assert.equal(metadata.width, 200);
    assert.equal(metadata.height, 240);
    assert.equal(metadata.hasAlpha, false);
    const maskMetadata = await sharp(maskPath).metadata();
    assert.equal(maskMetadata.width, 200);
    assert.equal(maskMetadata.height, 240);
    assert.equal(maskMetadata.hasAlpha, true);
    const maskAlpha = await sharp(maskPath).ensureAlpha().extractChannel("alpha")
      .raw().toBuffer();
    assert.equal(maskAlpha[0], 255, "Bone canvas must be protected.");
    assert.equal(maskAlpha[(120 * 200) + 100], 255, "Sprayer/closure must be protected.");
    assert.equal(maskAlpha[(180 * 200) + 88], 0, "Primary body glass must be editable.");
    assert.equal(
      maskAlpha[(180 * 200) + 100],
      255,
      "Dip-tube column at the primary center must be protected hardware.",
    );
    assert.equal(maskAlpha[(180 * 200) + 150], 255, "Detached sidecar must be protected.");
    assert.equal(maskAlpha[(220 * 200) + 100], 0, "Body baseline must remain inside the edit region.");
    assert.equal(maskAlpha[(230 * 200) + 100], 0, "Small contact-shadow strip must be editable.");
    const overlayAlpha = await sharp(identityOverlayPath).ensureAlpha()
      .extractChannel("alpha").raw().toBuffer();
    assert.equal(overlayAlpha[(120 * 200) + 100] > 0, true, "Sprayer must remain exact.");
    assert.equal(overlayAlpha[(180 * 200) + 100], 0, "Old bottle body must be absent.");
    assert.equal(overlayAlpha[(180 * 200) + 150] > 0, true, "Sidecar must remain exact.");
    assert.deepEqual(JSON.parse(await readFile(recordPath, "utf8")), record);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
