import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { compileCylinderMaterialPilotManifest } from "./cylinder-material-pilot.ts";

const planPath = new URL(
  "../../tmp/best-bottles-reference-production/cylinder-lane-locked-remediation-v3/e2a3cce30e6f529ca6d1ee6a4e3570a2af989aa738fa3f62bd3df8a7c9a813cd/cylinder-lane-locked-remediation-plan.json",
  import.meta.url,
);

describe("Cylinder material pilot benchmark compiler", () => {
  it("compiles 8 role-clean products across 2 models and 2 attempts", async () => {
    const source = JSON.parse(readFileSync(planPath, "utf8"));
    const manifest = await compileCylinderMaterialPilotManifest(source);
    assert.equal(manifest.products.length, 8);
    assert.equal(manifest.attempts.length, 32);
    assert.deepEqual(
      new Set(manifest.products.map((row) => row.assetRole)),
      new Set(["cap-on", "sidecar"]),
    );
    assert.deepEqual(
      new Set(manifest.attempts.map((row) => row.rendererId)),
      new Set(["openai-gpt-image-2", "google-nano-banana-2"]),
    );
    for (const row of manifest.attempts) {
      assert.equal(
        row.references.filter((ref) => ref.kind === "product-truth").length,
        1,
      );
      assert.match(row.prompt, /NO POST-GENERATION BACKGROUND PAINTING/i);
      assert.match(row.promptHash, /^[a-f0-9]{64}$/);
      assert.match(row.canonicalTruthHash, /^[a-f0-9]{64}$/);
      assert.equal(row.scaleContract.version, "best-bottles-catalog-scale-v1");
      assert.equal(row.scaleContract.canvasWidthPx, 2080);
      assert.equal(row.scaleContract.canvasHeightPx, 2288);
      assert.equal(row.scaleContract.baselineYPx, 2082);
      assert.match(row.prompt, /COMPARATIVE SCALE LOCK/i);
      assert.match(row.prompt, /bottle body/i);
    }
  });

  it("locks the approved 5 ml Cylinder sprayer below a regular 9 ml sprayer", async () => {
    const source = JSON.parse(readFileSync(planPath, "utf8"));
    const manifest = await compileCylinderMaterialPilotManifest(source);
    const fiveMl = manifest.products.find((row) =>
      row.websiteSku === "GBCylBlu5SpryBlkSh"
    );

    assert.ok(fiveMl);
    assert.deepEqual(fiveMl.scaleContract, {
      version: "best-bottles-catalog-scale-v1",
      canvasWidthPx: 2080,
      canvasHeightPx: 2288,
      baselinePct: 9,
      baselineYPx: 2082,
      assembledTargetPct: 61,
      assembledTargetPx: 1396,
      bodyTargetPx: 1027,
      bodyTargetRangePx: { min: 994, max: 1061 },
      bodyWidthTargetPx: 329,
      bodyWidthTargetRangePx: { min: 319, max: 340 },
      canonicalBodyHeightMm: 53,
      canonicalBodyWidthMm: 17,
      canonicalAssembledHeightMm: 72,
      qaStatus: "measurement-required",
    });
    assert.match(fiveMl.prompt, /body height target: 1027 px/i);
    assert.match(fiveMl.prompt, /regular 9 mL Cylinder.*taller/i);
    assert.doesNotMatch(fiveMl.prompt, /fill every SKU to the same/i);
  });

  it("hash-binds a pre-generation scale-conditioned product-truth reference", async () => {
    const source = JSON.parse(readFileSync(planPath, "utf8"));
    const manifest = await compileCylinderMaterialPilotManifest(source, {
      conditionedReferences: {
        GBCylBlu5SpryBlkSh: {
          version: "best-bottles-material-reference-conditioning-v1",
          websiteSku: "GBCylBlu5SpryBlkSh",
          sourceSha256:
            "b43d74266a311c17e0181f5b70b954f14e97e4f1de8ddb25d8f1d3405766622a",
          outputPath: "/tmp/GBCylBlu5SpryBlkSh__scale-locked.png",
          outputSha256:
            "7272fdedc2c29ed44df5c7179a0c1971118fd6d31b303616cf3a4437e4dca097",
          operation: "pre-generation-product-truth-conditioning",
          postGenerationMutationAllowed: false,
          scaleContractVersion: "best-bottles-catalog-scale-v1",
          scaleContractBaselineYPx: 2082,
          rendererBaselinePrecompensationPx: 44,
        },
      },
    });
    const product = manifest.products.find((row) =>
      row.websiteSku === "GBCylBlu5SpryBlkSh"
    );
    const reference = product?.references.find((row) =>
      row.kind === "product-truth"
    );
    assert.equal(manifest.version, "cylinder-material-pilot-v3");
    assert.equal(reference?.locator, "/tmp/GBCylBlu5SpryBlkSh__scale-locked.png");
    assert.equal(
      reference?.sha256,
      "7272fdedc2c29ed44df5c7179a0c1971118fd6d31b303616cf3a4437e4dca097",
    );
    assert.equal(reference?.conditioning?.sourceSha256,
      "b43d74266a311c17e0181f5b70b954f14e97e4f1de8ddb25d8f1d3405766622a");
    assert.match(product?.prompt ?? "", /pre-conditioned before generation/i);
    assert.match(product?.prompt ?? "", /do not reframe/i);
    assert.match(product?.prompt ?? "", /44 px renderer baseline precompensation/i);
    assert.match(product?.prompt ?? "", /final bottle base.*y=2082 px/i);
  });
});
