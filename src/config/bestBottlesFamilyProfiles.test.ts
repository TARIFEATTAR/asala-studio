import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_FAMILY_SCALE_CORRECTIONS,
  BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES,
  BEST_BOTTLES_CYLINDER_COMPACT_PROFILE,
  getBestBottlesCatalogFramingProfile,
  getBestBottlesRelativeScaleZoneForProduct,
  getBestBottlesCylinderFamilyProfile,
  getBestBottlesFamilyProfileForProduct,
} from "./bestBottlesFamilyProfiles";
import {
  BEST_BOTTLES_CATALOG_SCALE_VERSION,
  resolveBestBottlesGlobalScalePct,
} from "./bestBottlesCatalogScale";

// The 39 distinct families the live catalog actually contains (Convex →
// reference-intake). Split by the server rendering-contract lanes: the 28 that
// are bottle vessels (must ship a real framing profile) vs the 11 that route to
// the component/packaging/blocked lanes (framing handled server-side, not here).
const BOTTLE_FAMILIES = [
  "Aluminum Bottle", "Apothecary", "Atomizer", "Bell", "Boston Round", "Circle",
  "Cream Jar", "Cylinder", "Decorative", "Diamond", "Diva", "Elegant", "Empire",
  "Flair", "Grace", "Lotion Bottle", "Pillar", "Plastic Bottle", "Rectangle",
  "Round", "Royal", "Sleek", "Slim", "Square", "Tall Cylinder", "Teardrop",
  "Tulip", "Vial",
];
const NON_BOTTLE_FAMILIES = [
  "Cap/Closure", "Cap/Component", "Dropper", "Lotion Pump", "Roll-On Cap",
  "Sprayer", "Tool", "Gift Bag", "Gift Box", "Packaging Supply", "Unknown",
];

describe("Best Bottles family profiles", () => {
  it("keeps detached Cylinder sidecars on the global PDP catalog-scale contract", () => {
    const profile = getBestBottlesCylinderFamilyProfile({
      family: "Cylinder",
      capacityMl: 9,
      heightWithCap: "98 ±1 mm",
      heightWithoutCap: "70 ±1 mm",
      diameter: "20 ±0.5 mm",
      capState: "detached",
      mode: "fitment-attached-cap-right-sidecar",
    });
    assert.equal(profile.scaleContractVersion, BEST_BOTTLES_CATALOG_SCALE_VERSION);
    assert.equal(profile.geometryScaleVersion, undefined);
    assert.equal(profile.targetProductHeightPct, 69);
    assert.deepEqual(profile.targetProductHeightRangePct, {
      min: 67,
      max: 71,
    });
  });

  it("keeps regular and tall 9ml Cylinder assemblies on the same capacity-owned PDP target", () => {
    const regular = getBestBottlesFamilyProfileForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 9,
      heightWithCap: "96 ±1 mm",
      heightWithoutCap: "70 ±1 mm",
      diameter: "20 ±0.5 mm",
      applicator: "Fine Mist Sprayer",
    });
    const tall = getBestBottlesFamilyProfileForProduct({
      family: "Tall Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 9,
      heightWithCap: "111 ±2 mm",
      heightWithoutCap: "106 ±2 mm",
      diameter: "18 ±0.5 mm",
      applicator: "Fine Mist Sprayer",
    });

    assert.ok(regular);
    assert.ok(tall);
    assert.equal(regular.targetProductHeightPct, 69);
    assert.equal(tall.targetProductHeightPct, 69);
  });

  it("does not apply the Cylinder display curve to an explicitly classified Vial", () => {
    const vial = getBestBottlesFamilyProfileForProduct({
      family: "Vial",
      bottleCollection: "Vial",
      capacityMl: 9,
      heightWithCap: "50 ±0.5 mm",
      diameter: "20 ±0.5 mm",
      itemName: "Cylinder design 9 ml clear glass vial with glass rod applicator",
      websiteSku: "GB09BlackCapApp",
    });

    assert.ok(vial);
    assert.equal(vial.id, "sample-vial");
    assert.equal(vial.targetProductHeightPct, resolveBestBottlesGlobalScalePct(9));
  });

  it("uses the global catalog curve as Cylinder height authority", () => {
    const expected = new Map([
      [1, 54], [3, 56], [4, 58], [5, 61], [9, 69], [28, 74],
      [30, 75], [50, 78], [100, 79], [118, 80], [227, 82], [454, 84],
    ]);

    for (const [capacityMl, targetPct] of expected) {
      const profile = getBestBottlesFamilyProfileForProduct({
        family: "Cylinder",
        bottleCollection: "Cylinder",
        capacityMl,
      });
      assert.ok(profile);
      assert.equal(profile.scaleContractVersion, BEST_BOTTLES_CATALOG_SCALE_VERSION);
      assert.equal(profile.globalTargetProductHeightPct, targetPct);
      assert.equal(profile.familyScaleCorrectionPct, 0);
      assert.equal(profile.targetProductHeightPct, targetPct);
    }
  });

  it("keeps every authored family correction inside the global rail", () => {
    for (const [profileId, correction] of Object.entries(BEST_BOTTLES_FAMILY_SCALE_CORRECTIONS)) {
      assert.ok(Math.abs(correction) <= 2, `${profileId} correction exceeds ±2: ${correction}`);
    }
  });

  it("classifies 3ml Cylinder sprayers as compact fixed-studio products", () => {
    const profile = getBestBottlesCylinderFamilyProfile({
      family: "Cylinder",
      capacityMl: 3,
      heightWithCap: "54 mm",
      heightWithoutCap: "37 mm",
      diameter: "14 mm",
    });

    assert.equal(profile.id, BEST_BOTTLES_CYLINDER_COMPACT_PROFILE.id);
    assert.equal(profile.canvas.widthPx, 2080);
    assert.equal(profile.canvas.heightPx, 2288);
    assert.equal(profile.label, "Cylinder Sample Vial");
    assert.deepEqual(profile.targetProductHeightRangePct, { min: 54, max: 58 });
    assert.equal(profile.targetProductHeightPct, 56);
    assert.equal(profile.relativeScaleZoneId, "sample-vial");
    assert.equal(profile.primaryObjectCenterXPct, 50);
    assert.equal(profile.detachedComponentPlacement, "right-sidecar");
    assert.equal(profile.detachedComponentShiftsPrimary, false);
  });

  it("treats 4ml-and-below Cylinder sprayers as sample-vial scale", () => {
    const profile = getBestBottlesCylinderFamilyProfile({
      family: "Cylinder",
      capacityMl: 4,
      heightWithCap: "60 mm",
      heightWithoutCap: "40 mm",
      diameter: "15 mm",
    });

    assert.equal(profile.id, "sample-vial");
    assert.equal(profile.label, "Cylinder Sample Vial");
    assert.deepEqual(profile.targetProductHeightRangePct, { min: 56, max: 60 });
    assert.equal(profile.targetProductHeightPct, 58);
    assert.equal(profile.relativeScaleZoneId, "sample-vial");
  });

  it("maps smoke-test Cylinder capacities into explicit relative scale zones", () => {
    const sample3ml = {
      family: "Cylinder",
      capacityMl: 3,
      heightWithCap: "54 mm",
      heightWithoutCap: "37 mm",
      diameter: "14 mm",
    };
    const sample4ml = {
      family: "Cylinder",
      capacityMl: 4,
      heightWithCap: "60 mm",
      heightWithoutCap: "40 mm",
      diameter: "15 mm",
    };
    const small9ml = {
      family: "Cylinder",
      capacityMl: 9,
      heightWithCap: "83 ±1 mm",
      heightWithoutCap: "70 ±1 mm",
      diameter: "20 ±0.5 mm",
    };
    const standard28ml = {
      family: "Cylinder",
      capacityMl: 28,
      heightWithCap: "118 mm",
      heightWithoutCap: "93 mm",
      diameter: "24 mm",
    };
    const tall100ml = {
      family: "Cylinder",
      capacityMl: 100,
      heightWithCap: "180 mm",
      heightWithoutCap: "150 mm",
      diameter: "38 mm",
    };

    assert.equal(getBestBottlesRelativeScaleZoneForProduct(sample3ml)?.id, "sample-vial");
    assert.equal(getBestBottlesRelativeScaleZoneForProduct(sample4ml)?.id, "sample-vial");
    assert.equal(getBestBottlesRelativeScaleZoneForProduct(small9ml)?.id, "small-cylinder");
    assert.equal(getBestBottlesRelativeScaleZoneForProduct(standard28ml)?.id, "standard-cylinder");
    assert.equal(getBestBottlesRelativeScaleZoneForProduct(tall100ml)?.id, "large-cylinder");

    assert.equal(getBestBottlesFamilyProfileForProduct(sample3ml)?.targetProductHeightPct, 56);
    assert.equal(getBestBottlesFamilyProfileForProduct(sample4ml)?.targetProductHeightPct, 58);
    assert.equal(getBestBottlesFamilyProfileForProduct(small9ml)?.targetProductHeightPct, 69);
    assert.equal(getBestBottlesFamilyProfileForProduct(standard28ml)?.targetProductHeightPct, 74);
    assert.equal(getBestBottlesFamilyProfileForProduct(tall100ml)?.targetProductHeightPct, 79);
  });

  it("keeps 5ml Cylinder products below both regular and slim 9ml products", () => {
    const fiveMlCapOffSprayer = getBestBottlesFamilyProfileForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 5,
      heightWithCap: "72 ±1 mm",
      heightWithoutCap: "53 ±1 mm",
      diameter: "17 ±0.5 mm",
      applicator: "Fine Mist Sprayer",
      itemName: "Cylinder design 5ml clear glass bottle with shiny black spray.",
      websiteSku: "GBCyl5SpryBlkSh",
      graceSku: "GB-CYL-CLR-5ML-SPR-SBLK",
    });
    const regular9MlRollOn = getBestBottlesFamilyProfileForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 9,
      heightWithCap: "83 ±1 mm",
      heightWithoutCap: "70 ±1 mm",
      diameter: "20 ±0.5 mm",
      applicator: "Plastic Roller Ball",
      itemName: "Cylinder design 9ml clear glass bottle with plastic roller ball plug and black dot cap.",
      websiteSku: "GBCyl9RollBlkDot",
      graceSku: "GB-CYL-CLR-9ML-T-11",
    });
    const slim9MlSprayer = getBestBottlesFamilyProfileForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 9,
      heightWithCap: "126 ±2 mm",
      heightWithoutCap: "106 ±2 mm",
      diameter: "18 ±0.5 mm",
      applicator: "Fine Mist Sprayer",
      itemName: "Tall cylinder design 9ml clear glass bottle with shiny black spray.",
      websiteSku: "GBTallCyl9SpryBlkSh",
      graceSku: "GB-CYL-CLR-9ML-SPR-SBLK",
    });

    assert.ok(fiveMlCapOffSprayer);
    assert.ok(regular9MlRollOn);
    assert.ok(slim9MlSprayer);
    assert.equal(fiveMlCapOffSprayer.relativeScaleZoneId, "small-cylinder");
    assert.deepEqual(fiveMlCapOffSprayer.targetProductHeightRangePct, { min: 59, max: 63 });
    assert.equal(fiveMlCapOffSprayer.targetProductHeightPct, 61);
    assert.ok(fiveMlCapOffSprayer.targetProductHeightPct < regular9MlRollOn.targetProductHeightPct);
    // Roll-ons are zone-owned (2026-07-20): the standard 9ml roll-on (83mm
    // w/cap) interpolates within the 67-72 standard-roller band.
    assert.equal(regular9MlRollOn.targetProductHeightPct, 71);
    assert.equal(slim9MlSprayer.targetProductHeightPct, 69);
  });

  it("uses measured slim height for profile classification while capacity owns PDP scale", () => {
    const profile = getBestBottlesFamilyProfileForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 9,
      heightWithCap: "118 ±2 mm",
      heightWithoutCap: "106 ±2 mm",
      diameter: "18 ±0.5 mm",
      applicator: "Fine Mist Sprayer",
      itemName: "Tall cylinder design 9ml, 1/3oz Clear glass bottle with shiny black spray.",
      websiteSku: "GBTallCyl9SpryBlkSh",
      graceSku: "GB-CYL-CLR-9ML-SPR-SBLK",
    });

    assert.ok(profile);
    assert.equal(profile.id, "cylinder-standard");
    assert.equal(profile.relativeScaleZoneId, "standard-cylinder");
    assert.equal(profile.targetProductHeightPct, 69);
    assert.deepEqual(profile.targetProductHeightRangePct, {
      min: 67,
      max: 71,
    });
  });

  it("maps measured 10-30ml Cylinder sprayers inside the Cylinder fill-height range", () => {
    const profile = getBestBottlesCylinderFamilyProfile({
      family: "Cylinder",
      capacityMl: 30,
      heightWithCap: "118 mm",
      heightWithoutCap: "93 mm",
      diameter: "24 mm",
    });

    assert.equal(profile.id, "cylinder-standard");
    assert.equal(profile.canvas.widthPx, 2080);
    assert.equal(profile.canvas.heightPx, 2288);
    assert.deepEqual(profile.targetProductHeightRangePct, {
      min: 73,
      max: 77,
    });
    assert.equal(profile.targetProductHeightPct, 75);
    assert.equal(profile.primaryObjectCenterXPct, 50);
  });

  it("maps roller bottles to the roller fill-height range before raw bottle family", () => {
    const profile = getBestBottlesFamilyProfileForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 9,
      heightWithCap: "73 mm",
      heightWithoutCap: "56 mm",
      applicator: "Metal Roller Ball",
    });

    assert.ok(profile);
    assert.equal(profile.id, "roller-bottle");
    // 73mm w/cap, 9ml → standard roller zone (roll-ons are now split into
    // small/standard/tall by real size so a 5ml no longer renders the same
    // height as a 9ml). See the roll-on capacity-gradation test below.
    assert.equal(profile.relativeScaleZoneId, "roller-standard");
    // Height-split roller zones own their calibrated band (2026-07-20): a
    // 73mm-with-cap 9ml lands low inside the 67-72 standard band, so the real
    // 106mm TALL 9ml roll-on (75-80 band) reads visibly taller on canvas.
    assert.deepEqual(profile.targetProductHeightRangePct, { min: 67, max: 72 });
    assert.equal(profile.targetProductHeightPct, 68);
  });

  it("maps Boston Round products to the Boston Round fill-height range", () => {
    const profile = getBestBottlesFamilyProfileForProduct({
      family: "Boston Round",
      bottleCollection: "Boston Round",
      capacityMl: 30,
      heightWithCap: "97 mm",
      heightWithoutCap: "78 mm",
      applicator: "Dropper",
    });

    assert.ok(profile);
    assert.equal(profile.id, "boston-round");
    assert.deepEqual(profile.targetProductHeightRangePct, { min: 73, max: 77 });
    assert.equal(profile.targetProductHeightPct, 75);
  });

  it("maps Empire and Aluminum Bottle products to their larger fill-height bands", () => {
    const empire = getBestBottlesFamilyProfileForProduct({
      family: "Empire",
      bottleCollection: "Empire",
      capacityMl: 50,
      heightWithCap: "116 mm",
      heightWithoutCap: "88 mm",
    });
    const aluminum = getBestBottlesFamilyProfileForProduct({
      family: "Aluminum Bottle",
      bottleCollection: "Aluminum Bottle",
      capacityMl: 250,
      heightWithCap: "186 mm",
      heightWithoutCap: "180 mm",
    });

    assert.ok(empire);
    assert.ok(aluminum);
    assert.equal(empire.id, "empire-bottle");
    assert.deepEqual(empire.targetProductHeightRangePct, { min: 76, max: 80 });
    assert.equal(empire.targetProductHeightPct, 78);
    assert.equal(aluminum.id, "aluminum-bottle");
    assert.equal(aluminum.scaleContractVersion, BEST_BOTTLES_CATALOG_SCALE_VERSION);
    assert.equal(aluminum.familyScaleCorrectionPct, 0);
    assert.ok(aluminum.targetProductHeightPct >= 82 && aluminum.targetProductHeightPct <= 84);
  });

  // Global catalog scale staircase. Zone IDs remain composition classifiers;
  // capacity owns the assembled-height target across closure variants.
  it("locks the 3/4/5/9ml capacity scale gradation on real production SKUs", () => {
    const threeMl = getBestBottlesFamilyProfileForProduct({
      graceSku: "GB-SPR-CLR-3ML-BLK", family: "Cylinder", bottleCollection: "Cylinder",
      capacityMl: 3, applicator: "Fine Mist Sprayer",
      heightWithCap: "54 ±1 mm", heightWithoutCap: "37 ±0.5 mm", diameter: "14 ±0.5 mm",
    });
    const fourMl = getBestBottlesFamilyProfileForProduct({
      graceSku: "GB-SPR-CLR-4ML-BLK", family: "Cylinder", bottleCollection: "Cylinder",
      capacityMl: 4, applicator: "Fine Mist Sprayer",
      heightWithCap: "67 ±1 mm", heightWithoutCap: "49 ±0.5 mm", diameter: "14 ±0.5 mm",
    });
    const fiveMl = getBestBottlesFamilyProfileForProduct({
      graceSku: "GB-CYL-CLR-5ML-SPR-SBLK", family: "Cylinder", bottleCollection: "Cylinder",
      capacityMl: 5, applicator: "Fine Mist Sprayer",
      heightWithCap: "72 ±1 mm", heightWithoutCap: "53 ±1 mm", diameter: "17 ±0.5 mm",
    });
    // A real 5ml ROLL-ON (not a sprayer): must land in the small roller zone and
    // render clearly shorter than a 9ml roll-on — this is the exact defect the
    // re-zoning fixes.
    const fiveMlRollOn = getBestBottlesFamilyProfileForProduct({
      graceSku: "GB-CYL-CLR-5ML-MRL-SBLK", family: "Cylinder", bottleCollection: "Cylinder",
      capacityMl: 5, applicator: "Metal Roller Ball",
      heightWithCap: "65 ±1 mm", heightWithoutCap: "53 ±1 mm", diameter: "17 ±0.5 mm",
    });
    const nineMl = getBestBottlesFamilyProfileForProduct({
      graceSku: "GB-CYL-CLR-9ML-T-07", family: "Cylinder", bottleCollection: "Cylinder",
      capacityMl: 9, applicator: "Metal Roller Ball",
      heightWithCap: "83 ±1 mm", heightWithoutCap: "70 ±1 mm", diameter: "20 ±0.5 mm",
    });

    for (const p of [threeMl, fourMl, fiveMl, fiveMlRollOn, nineMl]) {
      assert.ok(p);
      assert.equal(p.canvas.widthPx, 2080);
      assert.equal(p.canvas.heightPx, 2288);
      assert.equal(p.baselinePct, 9);
    }
    // The staircase: each capacity resolves to its designed zone + fill target.
    assert.equal(threeMl.relativeScaleZoneId, "sample-vial");
    assert.equal(threeMl.targetProductHeightPct, 56);
    assert.equal(fourMl.relativeScaleZoneId, "sample-vial");
    assert.equal(fourMl.targetProductHeightPct, 58);
    assert.equal(fiveMl.relativeScaleZoneId, "small-cylinder");
    assert.equal(fiveMl.targetProductHeightPct, 61);
    assert.equal(fiveMlRollOn.relativeScaleZoneId, "roller-small");
    assert.equal(nineMl.relativeScaleZoneId, "roller-standard");
    assert.equal(fiveMlRollOn.targetProductHeightPct, 61);
    // Zone-owned roller scale (2026-07-20): 83mm-with-cap 9ml roll-on
    // interpolates to 71 inside the 67-72 standard-roller band.
    assert.equal(nineMl.targetProductHeightPct, 71);
    // Strictly monotonic: smaller capacity is always rendered smaller.
    assert.ok(threeMl.targetProductHeightPct < fourMl.targetProductHeightPct);
    assert.ok(fourMl.targetProductHeightPct < fiveMl.targetProductHeightPct);
    // The core fix: a 5ml roll-on now renders clearly shorter than a 9ml roll-on.
    assert.ok(fiveMlRollOn.targetProductHeightPct < nineMl.targetProductHeightPct);
    assert.ok(nineMl.targetProductHeightPct - fiveMlRollOn.targetProductHeightPct >= 4);
  });

  it("now resolves a framing profile for the previously-uncovered Circle family", () => {
    const circle = getBestBottlesFamilyProfileForProduct({ family: "Circle" });
    assert.ok(circle, "Circle should resolve to a framing profile");
    assert.equal(circle.id, "circle-bottle");
    assert.equal(circle.canvas.widthPx, 2080);
    assert.equal(circle.canvas.heightPx, 2288);
  });
});

describe("Best Bottles family profile — full catalog coverage", () => {
  it("gives every bottle family a real framing profile on the fixed studio canvas", () => {
    for (const family of BOTTLE_FAMILIES) {
      const profile = getBestBottlesFamilyProfileForProduct({ family });
      assert.ok(profile, `${family} must resolve to a non-null framing profile`);
      assert.equal(profile.canvas.widthPx, 2080, `${family} canvas width`);
      assert.equal(profile.canvas.heightPx, 2288, `${family} canvas height`);
      assert.equal(profile.baselinePct, 9, `${family} shared baseline`);
      assert.equal(profile.primaryObjectCenterXPct, 50, `${family} centerline`);
      assert.ok(
        profile.targetProductHeightPct > 0 && profile.targetProductHeightPct <= 100,
        `${family} fill-height must be a sane percent (got ${profile.targetProductHeightPct})`,
      );
      assert.ok(
        profile.fillWidthPct > 0 && profile.fillWidthPct <= 100,
        `${family} fill-width must be a sane percent (got ${profile.fillWidthPct})`,
      );
    }
  });

  it("never returns a blank catalog framing profile for ANY family (bottle or component)", () => {
    for (const family of [...BOTTLE_FAMILIES, ...NON_BOTTLE_FAMILIES]) {
      const profile = getBestBottlesCatalogFramingProfile({ family });
      assert.ok(profile, `${family} catalog framing must never be null`);
      assert.equal(profile.canvas.widthPx, 2080);
      assert.equal(profile.canvas.heightPx, 2288);
    }
  });

  it("stays in sync with the live reference-intake catalog family set", () => {
    const intake = JSON.parse(
      readFileSync(
        new URL("../../public/data/best-bottles-reference-intake.json", import.meta.url),
        "utf8",
      ),
    ) as { summary?: { byFamily?: Array<{ family?: string }> } };
    const catalogFamilies = new Set(
      (intake.summary?.byFamily ?? [])
        .map((entry) => entry.family)
        .filter((family): family is string => typeof family === "string" && family.length > 0),
    );
    const contract = new Set([...BOTTLE_FAMILIES, ...NON_BOTTLE_FAMILIES]);

    const missingFromContract = [...catalogFamilies].filter((family) => !contract.has(family));
    assert.deepEqual(
      missingFromContract,
      [],
      `New catalog families are not yet classified as bottle/non-bottle: ${missingFromContract.join(", ")}`,
    );
  });
});
