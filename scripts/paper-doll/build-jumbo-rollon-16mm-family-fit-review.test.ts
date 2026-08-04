import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  buildJumboRollon16mmFamilyFitReview,
  resolveSourceRelativePlacement,
} from "./build-jumbo-rollon-16mm-family-fit-review";

test("resolves jumbo roller placement from the source body transform without a manual nudge", () => {
  assert.deepEqual(resolveSourceRelativePlacement({
    sourceBodyBoundsPx: { left: 199, top: 251, width: 445, height: 1577 },
    targetBodyBoundsPx: { left: 847, top: 712, width: 387, height: 1371 },
    sourceComponentBoundsPx: { left: 272, top: 475, width: 280, height: 253 },
    uniformScale: 0.8693722257450857,
  }), { left: 910, top: 907, width: 243, height: 220 });

  assert.deepEqual(resolveSourceRelativePlacement({
    sourceBodyBoundsPx: { left: 226, top: 453, width: 509, height: 1368 },
    targetBodyBoundsPx: { left: 760, top: 575, width: 561, height: 1508 },
    sourceComponentBoundsPx: { left: 314, top: 185, width: 327, height: 305 },
    uniformScale: 1.1023391812865497,
  }), { left: 857, top: 280, width: 360, height: 336 });
});

test("builds four capacity-specific jumbo roller Family Fit assemblies while keeping overcap placement blocked", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jumbo-family-fit-"));
  try {
    const canvas = { width: 208, height: 229 };
    const body28 = await sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from('<svg width="40" height="130"><rect x="1" y="1" width="38" height="128" rx="4" fill="#d9e4e8"/></svg>'), left: 84, top: 80 }])
      .png().toBuffer();
    const body50 = await sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from('<svg width="56" height="150"><rect x="1" y="1" width="54" height="148" rx="5" fill="#d9e4e8"/></svg>'), left: 76, top: 72 }])
      .png().toBuffer();
    const makeCandidate = (fill: string) => sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from(`<svg width="30" height="24"><path d="M2 23V10Q2 2 15 2Q28 2 28 10V23Z" fill="${fill}"/></svg>`), left: 89, top: 30 }])
      .png().toBuffer();
    const [plastic28, metal28, plastic50, metal50] = await Promise.all([
      makeCandidate("#e9eceb"), makeCandidate("#9da4a6"), makeCandidate("#eceeed"), makeCandidate("#a3aaac"),
    ]);
    const files = {
      body28: path.join(root, "body-28.png"),
      body50: path.join(root, "body-50.png"),
      plastic28: path.join(root, "plastic-28.png"),
      metal28: path.join(root, "metal-28.png"),
      plastic50: path.join(root, "plastic-50.png"),
      metal50: path.join(root, "metal-50.png"),
    };
    await Promise.all([
      writeFile(files.body28, body28), writeFile(files.body50, body50),
      writeFile(files.plastic28, plastic28), writeFile(files.metal28, metal28),
      writeFile(files.plastic50, plastic50), writeFile(files.metal50, metal50),
    ]);
    const sha256 = async (filePath: string) => {
      const { createHash } = await import("node:crypto");
      return createHash("sha256").update(await readFile(filePath)).digest("hex");
    };
    const sourceManifestPath = path.join(root, "source-manifest.json");
    const authorityManifestPath = path.join(root, "authority-manifest.json");
    await writeFile(sourceManifestPath, JSON.stringify({
      canonicalCanvas: { ...canvas, centerX: 104, baselineY: 220, background: "#F5F3EF" },
      families: [
        { familyKey: "CYL-OTHER", source: {}, layers: [] },
        {
          familyKey: "CYL-28ML-16MM-JUMBO-ROLLON",
          source: { catalogReference: { capacityMl: 28, neckFinish: "16mm" } },
          sourceAssemblyBoundsPx: { left: 20, top: 30, width: 50, height: 150 },
          targetAssemblyBoundsPx: { left: 84, top: 80, width: 40, height: 130 },
          uniformScale: 0.8,
          layers: [{ role: "body", sourceBoundsPx: { left: 20, top: 30, width: 50, height: 150 }, placementBoundsPx: { left: 84, top: 80, width: 40, height: 130 }, fullCanvasPlatePath: files.body28, fullCanvasPlateSha256: await sha256(files.body28) }],
        },
        {
          familyKey: "CYL-50ML-16MM-JUMBO-ROLLON",
          source: { catalogReference: { capacityMl: 50, neckFinish: "16mm" } },
          sourceAssemblyBoundsPx: { left: 25, top: 40, width: 50, height: 135 },
          targetAssemblyBoundsPx: { left: 76, top: 72, width: 56, height: 150 },
          uniformScale: 1.1,
          layers: [{ role: "body", sourceBoundsPx: { left: 25, top: 40, width: 50, height: 135 }, placementBoundsPx: { left: 76, top: 72, width: 56, height: 150 }, fullCanvasPlatePath: files.body50, fullCanvasPlateSha256: await sha256(files.body50) }],
        },
      ],
    }));
    await writeFile(authorityManifestPath, JSON.stringify({
      canonicalCanvas: canvas,
      lifecycleState: "authority-review-required",
      geometryLocked: false,
      productionEligible: false,
      groups: [
        {
          groupKey: "jumbo-rollon__16mm__28ml",
          physicalContract: { capacityMl: 28, neckSizeMm: 16 },
          authoritySource: { sourceBoundsPx: { left: 28, top: 12, width: 30, height: 24 } },
          authorityMaskReviewCandidate: { authorityBoundsPx: { left: 89, top: 30, width: 30, height: 24 } },
          candidates: [
            { material: "natural-plastic", path: files.plastic28, sha256: await sha256(files.plastic28), qa: { exactAlpha: true, mismatchedAlphaBytes: 0 } },
            { material: "metal-ball-plastic-housing", path: files.metal28, sha256: await sha256(files.metal28), qa: { exactAlpha: true, mismatchedAlphaBytes: 0 } },
          ],
        },
        {
          groupKey: "jumbo-rollon__16mm__50ml",
          physicalContract: { capacityMl: 50, neckSizeMm: 16 },
          authoritySource: { sourceBoundsPx: { left: 30, top: 10, width: 30, height: 24 } },
          authorityMaskReviewCandidate: { authorityBoundsPx: { left: 89, top: 30, width: 30, height: 24 } },
          candidates: [
            { material: "natural-plastic", path: files.plastic50, sha256: await sha256(files.plastic50), qa: { exactAlpha: true, mismatchedAlphaBytes: 0 } },
            { material: "metal-ball-plastic-housing", path: files.metal50, sha256: await sha256(files.metal50), qa: { exactAlpha: true, mismatchedAlphaBytes: 0 } },
          ],
        },
      ],
    }));
    const outputRoot = path.join(root, "output");
    const result = await buildJumboRollon16mmFamilyFitReview({ sourceManifestPath, authorityManifestPath, outputRoot, generatedAt: "2026-08-04T00:00:00.000Z" });
    assert.equal(result.manifest.summary.capacityGroupCount, 2);
    assert.equal(result.manifest.summary.candidateCount, 4);
    assert.equal(result.manifest.summary.assemblyCount, 4);
    assert.equal(result.manifest.summary.exactAlphaWithinEveryCapacity, true);
    assert.equal(result.manifest.overcaps.placementState, "missing-assembled-placement-authority");
    assert.equal(result.manifest.geometryLocked, false);
    assert.equal(result.manifest.productionEligible, false);
    assert.deepEqual(result.manifest.mutationPolicy, { approvalsWritten: false, placementLockWritten: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false });
    for (const group of result.manifest.groups) {
      assert.equal(group.candidates.length, 2);
      assert.deepEqual(group.candidates[0].placementBoundsPx, group.candidates[1].placementBoundsPx);
      assert.ok(group.candidates.every((candidate: any) => candidate.geometryLocked === false));
      assert.ok(group.candidates.every((candidate: any) => candidate.productionEligible === false));
      assert.ok(group.candidates.every((candidate: any) => candidate.assembly.path.endsWith(".png")));
    }
    assert.ok((await readFile(result.contactSheetPath)).length > 1000);
    assert.ok((await readFile(result.manifestPath, "utf8")).includes("family-fit-review-required"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
