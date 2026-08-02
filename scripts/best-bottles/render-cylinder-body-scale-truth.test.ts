import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import sharp from "sharp";

import {
  buildCylinderApplicatorCurvePlan,
  renderCylinderApplicatorCurves,
  type CylinderApplicatorCurveEvidenceInputs,
} from "./render-cylinder-body-scale-truth";
import { parseCanonicalTruthCsv } from "./build-psd-cap-state-audit";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_MANIFEST_PATH = path.join(
  REPOSITORY_ROOT,
  "tmp/best-bottles-reference-production/cylinder-81-type-review-v1/cylinder-81-type-review-manifest.json",
);
const CANONICAL_TRUTH_PATH = path.join(
  REPOSITORY_ROOT,
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function createEvidence(parent: string): Promise<CylinderApplicatorCurveEvidenceInputs> {
  async function image(name: string, width: number, height: number) {
    const target = path.join(parent, name);
    await sharp({ create: { width, height, channels: 3, background: "white" } })
      .composite([{ input: Buffer.from(`<svg width="${Math.floor(width / 3)}" height="${Math.floor(height * 0.7)}"><rect width="100%" height="100%" rx="12" fill="#2647a8"/></svg>`), left: Math.floor(width / 3), top: 20 }])
      .png()
      .toFile(target);
    return { path: target, sha256: sha256(await readFile(target)) };
  }
  const five = await image("five-spray.png", 300, 900);
  const tallNine = await image("tall-nine-spray.png", 260, 900);
  const twentyFiveReducer = await image("twenty-five-reducer.png", 260, 900);
  const regularNine = await image("regular-nine-pdp.png", 500, 500);
  const glassRod = await image("glass-rod-pdp.png", 500, 500);
  const tallRectangle = await image("tall-rectangle-pdp.png", 500, 500);
  const fiveRollOn = await image("five-roll-on-pdp.png", 300, 900);
  const regularNineRollOn = await image("regular-nine-roll-on-pdp.png", 300, 900);
  const tallNineRollOn = await image("tall-nine-roll-on-pdp.png", 300, 900);
  const twentyEightRollOn = await image("twenty-eight-roll-on-pdp.png", 300, 900);
  const fiftyRollOn = await image("fifty-roll-on-pdp.png", 300, 900);
  const twentyFiveSpray = await image("twenty-five-spray-pdp.png", 300, 900);
  return {
    reviewVersion: "2026-07-13-user-applicator-curves-v3",
    fiveMlSprayPdp: { ...five, foregroundBounds: { left: 100, top: 20, width: 100, height: 630 } },
    tallNineSprayPdp: { ...tallNine, foregroundBounds: { left: 86, top: 20, width: 86, height: 630 } },
    twentyFiveReducerPdp: { ...twentyFiveReducer, foregroundBounds: { left: 86, top: 20, width: 86, height: 630 } },
    regularNineSprayPdp: regularNine,
    glassRodPdp: glassRod,
    tallRectangleTenPdp: tallRectangle,
    fiveMlRollOnPdp: { ...fiveRollOn, foregroundBounds: { left: 100, top: 20, width: 100, height: 630 } },
    regularNineRollOnPdp: { ...regularNineRollOn, foregroundBounds: { left: 100, top: 20, width: 100, height: 630 } },
    tallNineRollOnPdp: { ...tallNineRollOn, foregroundBounds: { left: 100, top: 20, width: 100, height: 630 } },
    twentyEightRollOnPdp: { ...twentyEightRollOn, foregroundBounds: { left: 100, top: 20, width: 100, height: 630 } },
    fiftyRollOnPdp: { ...fiftyRollOn, foregroundBounds: { left: 100, top: 20, width: 100, height: 630 } },
    twentyFiveSprayPdp: { ...twentyFiveSpray, foregroundBounds: { left: 100, top: 20, width: 100, height: 630 } },
  };
}

describe("Cylinder controlled applicator-curve plan", () => {
  it("separates sprays, roll-ons, and reducers without substituting blocked references", async () => {
    const manifest = JSON.parse(await readFile(SOURCE_MANIFEST_PATH, "utf8"));
    const evidence = await createEvidence(await mkdtemp(path.join(os.tmpdir(), "bb-cylinder-evidence-")));
    const canonicalRows = parseCanonicalTruthCsv(await readFile(CANONICAL_TRUTH_PATH, "utf8"));
    const plan = buildCylinderApplicatorCurvePlan(manifest, evidence, canonicalRows);

    assert.equal(plan.curves.sprays.positions.length, 8);
    assert.equal(plan.curves.sprays.positions.filter((position) => position.status === "ready").length, 8);
    assert.equal(plan.curves.sprays.positions.filter((position) => position.status === "blocked").length, 0);
    assert.ok(plan.curves.sprays.positions.every((position) => position.applicatorSystem === "fine-mist-or-perfume-pump-spray"));
    assert.ok(plan.curves.sprays.positions.filter((position) => position.status === "ready")
      .every((position) => position.targetAssembledHeightPx === position.heightWithCapMm * plan.pixelsPerMm));

    const five = plan.curves.sprays.positions.find((position) => position.displayKey === "spray|5");
    assert.equal(five?.canonicalIdentityKey, "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK");
    assert.equal(five?.bodyHeightMm, 53);
    assert.equal(five?.heightWithCapMm, 72);
    assert.equal(five?.referenceClass, "user-confirmed-pdp-screenshot-scale-only");
    assert.deepEqual(five?.collapsedSourceBodyKeys, ["cylinder|5|53|17|17", "cylinder|5|54.2|17|17"]);

    const regularNine = plan.curves.sprays.positions.find((position) => position.displayKey === "spray|9|regular");
    assert.equal(regularNine?.canonicalIdentityKey, "GBCYLAMB9SPRYBLK|GBCYLAMB9MLSPRBLK");
    assert.equal(regularNine?.bodyHeightMm, 70);
    assert.equal(regularNine?.heightWithCapMm, 96);
    assert.equal(regularNine?.websiteSku, "GBCylAmb9SpryBlk");
    assert.deepEqual(regularNine?.collapsedSourceBodyKeys, [
      "cylinder|9|70|20|20",
      "cylinder|9|74|20|20",
      "cylinder|9|74|21|21",
    ]);

    const tallNine = plan.curves.sprays.positions.find((position) => position.displayKey === "spray|9|tall");
    assert.equal(tallNine?.canonicalIdentityKey, "GBTALLCYL9SPRYBLKMATT|GBCYLCLR9MLSPRMBLK");
    assert.equal(tallNine?.bodyHeightMm, 106);
    assert.equal(tallNine?.heightWithCapMm, 111);
    assert.equal(tallNine?.referenceClass, "user-confirmed-pdp-screenshot-scale-only");

    const twentyFiveSpray = plan.curves.sprays.positions.find((position) => position.displayKey === "spray|25");
    assert.equal(twentyFiveSpray?.status, "ready");
    assert.equal(twentyFiveSpray?.canonicalIdentityKey, "GBCYL25SPRYSHNBLK|GBCYLCLR25MLSPRSBLK");
    assert.equal(twentyFiveSpray?.websiteSku, "GBcyl25SpryShnBlk");
    assert.equal(twentyFiveSpray?.graceSku, "GB-CYL-CLR-25ML-SPR-SBLK");
    assert.deepEqual(
      [twentyFiveSpray?.bodyHeightMm, twentyFiveSpray?.widthAxisMm, twentyFiveSpray?.secondAxisMm, twentyFiveSpray?.heightWithCapMm],
      [83, 32, 32, 108],
    );
    assert.equal(twentyFiveSpray?.referenceClass, "user-confirmed-pdp-screenshot-scale-only");
    assert.doesNotMatch(twentyFiveSpray?.blockerReason ?? "", /absent from (?:the )?canonical master/i);
    assert.equal(twentyFiveSpray?.blockerReason, null);
    assert.equal(
      plan.reconciliationFindings.twentyFiveMlSpray.decisionStatus,
      "canonical-measurement-and-identity-ready",
    );
    assert.equal(plan.reconciliationFindings.twentyFiveMlSpray.blocker, null);
    assert.equal(plan.reconciliationFindings.twentyFiveMlSpray.measurementSource, "manual-override");
    assert.equal(plan.curves.sprays.positions.some((position) => position.displayKey === "spray|30"), false);

    assert.equal(plan.curves.rollOns.positions.length, 7);
    assert.equal(plan.curves.rollOns.positions.filter((position) => position.status === "ready").length, 5);
    assert.equal(plan.curves.rollOns.positions.filter((position) => position.status === "blocked").length, 2);
    assert.ok(plan.curves.rollOns.positions.every((position) => position.applicatorSystem === "roller-ball-roll-on"));
    assert.ok(plan.curves.rollOns.positions.filter((position) => position.status === "ready")
      .every((position) => position.targetAssembledHeightPx === position.heightWithCapMm * plan.pixelsPerMm));

    const classicTwenty = plan.curves.rollOns.positions.find((position) => position.displayKey === "roll-on|9|classic-20");
    assert.deepEqual(
      [classicTwenty?.status, classicTwenty?.bodyHeightMm, classicTwenty?.widthAxisMm, classicTwenty?.secondAxisMm, classicTwenty?.heightWithCapMm],
      ["blocked", 70, 20, 20, 83],
    );
    assert.equal(classicTwenty?.previewPath, null);
    assert.equal(classicTwenty?.targetAssembledHeightPx, null);
    assert.equal(classicTwenty?.blockerIdentityKeys.length, 33);

    const classicTwentyOne = plan.curves.rollOns.positions.find((position) => position.displayKey === "roll-on|9|classic-21");
    assert.deepEqual(
      [classicTwentyOne?.status, classicTwentyOne?.bodyHeightMm, classicTwentyOne?.widthAxisMm, classicTwentyOne?.secondAxisMm, classicTwentyOne?.heightWithCapMm],
      ["blocked", 70, 21, 21, 75],
    );
    assert.equal(classicTwentyOne?.previewPath, null);
    assert.equal(classicTwentyOne?.targetAssembledHeightPx, null);
    assert.equal(classicTwentyOne?.blockerIdentityKeys.length, 27);

    const fiveRollOn = plan.curves.rollOns.positions.find((position) => position.displayKey === "roll-on|5");
    assert.deepEqual(
      [fiveRollOn?.canonicalIdentityKey, fiveRollOn?.bodyHeightMm, fiveRollOn?.widthAxisMm, fiveRollOn?.heightWithCapMm],
      ["GBCYLBLU5ROLLGLMATT|GBCYLBLU5MLROLMGLD", 53, 17, 65],
    );
    assert.equal(fiveRollOn?.referenceClass, "user-confirmed-pdp-screenshot-scale-only");

    const regularNineRollOn = plan.curves.rollOns.positions.find((position) => position.displayKey === "roll-on|9|regular");
    assert.deepEqual(
      [regularNineRollOn?.canonicalIdentityKey, regularNineRollOn?.bodyHeightMm, regularNineRollOn?.widthAxisMm, regularNineRollOn?.heightWithCapMm],
      ["GBCYLFRST9MTLROLLMATTGL|GBCYLFRS9MLMRLMGLD", 74, 21, 87],
    );
    assert.equal(regularNineRollOn?.websiteSku, "GBCylFrst9MtlRollMattGl");
    assert.equal(regularNineRollOn?.referenceClass, "approved-psd-derived");

    const tallNineRollOn = plan.curves.rollOns.positions.find((position) => position.displayKey === "roll-on|9|tall");
    assert.deepEqual(
      [tallNineRollOn?.canonicalIdentityKey, tallNineRollOn?.bodyHeightMm, tallNineRollOn?.widthAxisMm, tallNineRollOn?.heightWithCapMm],
      ["GBTALLCYLFRST9MTLROLLGLMATT|GBCYLFRS9MLT05", 106, 18, 118],
    );
    assert.equal(tallNineRollOn?.referenceClass, "user-confirmed-pdp-screenshot-scale-only");

    const twentyEight = plan.curves.rollOns.positions.find((position) => position.displayKey === "roll-on|28");
    assert.equal(twentyEight?.status, "ready");
    assert.equal(twentyEight?.canonicalIdentityKey, "GBROLL28BLK|GBCYLCLR28MLRBL");
    assert.deepEqual([twentyEight?.bodyHeightMm, twentyEight?.widthAxisMm, twentyEight?.secondAxisMm], [81, 31, 31]);
    assert.equal(twentyEight?.heightWithCapMm, 100);
    assert.equal(twentyEight?.referenceClass, "user-confirmed-pdp-screenshot-scale-only");

    const fiftyRollOn = plan.curves.rollOns.positions.find((position) => position.displayKey === "roll-on|50");
    assert.deepEqual(
      [fiftyRollOn?.canonicalIdentityKey, fiftyRollOn?.bodyHeightMm, fiftyRollOn?.widthAxisMm, fiftyRollOn?.heightWithCapMm],
      ["GBCYL50ROLLBLK|GBCYLBLK50MLROLBLK", 98, 37, 116],
    );
    assert.equal(fiftyRollOn?.referenceClass, "user-confirmed-pdp-screenshot-scale-only");

    assert.equal(plan.curves.reducers.positions.length, 3);
    assert.ok(plan.curves.reducers.positions.every((position) => position.status === "ready"));
    assert.ok(plan.curves.reducers.positions.every((position) => position.applicatorSystem === "reducer"));
    const twentyFiveReducer = plan.curves.reducers.positions[0];
    assert.equal(twentyFiveReducer.canonicalIdentityKey, null);
    assert.equal(twentyFiveReducer.websiteSku, "GBcyl25RdcrBlkLthr");
    assert.equal(twentyFiveReducer.graceSku, null);
    assert.deepEqual(
      [twentyFiveReducer.bodyHeightMm, twentyFiveReducer.widthAxisMm, twentyFiveReducer.secondAxisMm, twentyFiveReducer.heightWithCapMm],
      [83, 32, 32, 97],
    );
    assert.equal(twentyFiveReducer.referenceClass, "user-confirmed-pdp-screenshot-scale-only");
    assert.match(twentyFiveReducer.blockerReason ?? "", /absent from canonical master/i);
    assert.deepEqual(plan.curves.reducers.positions.map((position) => position.canonicalIdentityKey), [
      null,
      "GBCYL50RDCRBLKLTHR|GBCYLCLR50MLRDCBKLT",
      "GBCYL100RDCRBLKLTHR|GBCYLCLR100MLRDCBKLT",
    ]);
    assert.deepEqual(plan.curves.reducers.positions.map((position) => position.heightWithCapMm), [97, 131, 184]);
    assert.equal(plan.reconciliationFindings.twentyFiveMlReducer.decisionStatus, "source-reconciliation-required");
    assert.equal(plan.reconciliationFindings.twentyFiveMlReducer.productionReferencePromoted, false);
  });

  it("records the glass-wand Vial candidate and keeps Boston Round and Tall Rectangle outside Cylinder", async () => {
    const manifest = JSON.parse(await readFile(SOURCE_MANIFEST_PATH, "utf8"));
    const evidence = await createEvidence(await mkdtemp(path.join(os.tmpdir(), "bb-cylinder-exclusions-")));
    const canonicalRows = parseCanonicalTruthCsv(await readFile(CANONICAL_TRUTH_PATH, "utf8"));
    const plan = buildCylinderApplicatorCurvePlan(manifest, evidence, canonicalRows);
    const allPositions = Object.values(plan.curves).flatMap((curve) => curve.positions);

    assert.equal(allPositions.some((position) => position.canonicalIdentityKey === "GB09BLACKCAPAPP|GBCYLCLR9MLT01"), false);
    assert.deepEqual(plan.classificationReview.glassWand, {
      canonicalIdentityKey: "GB09BLACKCAPAPP|GBCYLCLR9MLT01",
      currentSourceFamily: "Cylinder",
      proposedFamily: "Vial",
      decisionStatus: "candidate-not-written",
      reason: "18-400 glass-wand construction is vial-like; excluded from controlled Cylinder applicator curves",
    });
    assert.equal(plan.outOfFamilyEvidence.tallRectangleTen.family, "Tall Rectangular/Rectangle");
    assert.equal(plan.outOfFamilyEvidence.bostonRound.family, "Boston Round");
    assert.deepEqual(plan.outOfFamilyEvidence.bostonRound.canonicalBodies, [
      "15 mL — 68×25×25 mm",
      "30 mL — 68×33×33 mm (single quarantined outlier)",
      "30 mL — 78×33×33 mm",
      "60 mL — 94×39×39 mm",
    ]);
    assert.equal(plan.outOfFamilyEvidence.bostonRound.includedInCylinderCurves, false);
  });
});

describe("Cylinder controlled applicator-curve renderer", () => {
  it("writes three opaque plates, a blocker-preserving manifest, and a relative review page", async () => {
    const temporaryParent = await mkdtemp(path.join(os.tmpdir(), "bb-cylinder-curves-"));
    const outputRoot = path.join(temporaryParent, "cylinder-applicator-curves-v1");
    const evidence = await createEvidence(temporaryParent);
    const sourceBefore = sha256(await readFile(SOURCE_MANIFEST_PATH));
    const result = await renderCylinderApplicatorCurves({
      manifestPath: SOURCE_MANIFEST_PATH,
      outputRoot,
      evidence,
      generatedAt: "2026-07-13T00:00:00.000Z",
    });

    assert.equal(sha256(await readFile(SOURCE_MANIFEST_PATH)), sourceBefore);
    assert.deepEqual((await readdir(outputRoot)).sort(), [
      "cylinder-applicator-curves-manifest.json",
      "cylinder-reducer-scale-curve.png",
      "cylinder-roll-on-scale-curve.png",
      "cylinder-spray-scale-curve.png",
      "evidence",
      "index.html",
    ]);
    assert.deepEqual(result.manifest.summary, {
      sourceTypeCount: 81,
      sourceReadyTypeCount: 41,
      sourceBlockedTypeCount: 40,
      sourceBlockedIdentityCount: 216,
      displayPositionCount: 18,
      readyPositionCount: 16,
      blockedPositionCount: 2,
      sprayPositionCount: 8,
      rollOnPositionCount: 7,
      reducerPositionCount: 3,
    });
    assert.equal(result.manifest.externalWriteCount, 0);
    assert.equal(result.manifest.sourceBlockers.length, 216);
    assert.equal(result.manifest.previews.length, 16);
    assert.match(JSON.stringify(result.manifest.sourceBlockers), /GBSPRY1OZGL\|GBSPRCLR30MLGLD/);
    assert.match(JSON.stringify(result.manifest.sourceBlockers), /GBSPRY1OZSL\|GBSPRCLR30MLSLV/);
    assert.deepEqual((await readdir(path.join(outputRoot, "evidence"))).sort(), [
      "2026-07-12-GB09BlackCapApp-PDP.png",
      "2026-07-12-GBCylBlu5SpryBlkSh-PDP.png",
      "2026-07-12-GBTallCyl9SpryBlkMatt-PDP.png",
      "2026-07-13-GBCyl50RollBlk-PDP.png",
      "2026-07-13-GBCylAmb9SpryBlk-PDP.png",
      "2026-07-13-GBCylBlu5RollGlMatt-PDP.png",
      "2026-07-13-GBCylFrst9MtlRollMattGl-PDP.png",
      "2026-07-13-GBRoll28Blk-PDP.png",
      "2026-07-13-GBTallCylFrst9MtlRollGlMatt-PDP.png",
      "2026-07-13-GBTallRect10SpryBlkMatt-PDP.png",
      "2026-07-13-GBcyl25RdcrBlkLthr-PDP-cap-on-main.png",
      "2026-07-13-GBcyl25SpryShnBlk-PDP.png",
    ]);
    for (const name of [
      "cylinder-spray-scale-curve.png",
      "cylinder-roll-on-scale-curve.png",
      "cylinder-reducer-scale-curve.png",
    ]) {
      const metadata = await sharp(path.join(outputRoot, name)).metadata();
      assert.equal(metadata.channels, 3, name);
      assert.equal(metadata.hasAlpha, false, name);
      assert.deepEqual({ width: metadata.width, height: metadata.height }, result.manifest.outputs[name].dimensions);
    }
    for (const [name, output] of Object.entries(result.manifest.outputs)) {
      assert.equal(output.sha256, sha256(await readFile(path.join(outputRoot, name))), name);
    }
    const html = await readFile(path.join(outputRoot, "index.html"), "utf8");
    assert.match(html, /Cylinder sprays only/i);
    assert.match(html, /Cylinder roll-ons only/i);
    assert.match(html, /Cylinder reducers only/i);
    assert.match(html, /five supplied roll-on references/i);
    assert.match(html, /two additional 9 mL classic bodies remain blocked/i);
    assert.doesNotMatch(html, /28 mL.*blocked/i);
    assert.match(html, /25 mL Cylinder spray is present/i);
    assert.doesNotMatch(html, /30 mL spray/i);
    assert.match(html, /Vial reclassification candidate/i);
    assert.match(html, /Boston Round is a separate canonical family/i);
    assert.ok(html.includes('src="cylinder-spray-scale-curve.png"'));
    assert.ok(html.includes('src="cylinder-roll-on-scale-curve.png"'));
    assert.ok(html.includes('src="cylinder-reducer-scale-curve.png"'));
    assert.doesNotMatch(html, /(?:src|href)="(?:file:|\/)/);
  });
});
