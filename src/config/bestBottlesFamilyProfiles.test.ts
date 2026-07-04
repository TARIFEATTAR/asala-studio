import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES,
  BEST_BOTTLES_CYLINDER_COMPACT_PROFILE,
  getBestBottlesCatalogFramingProfile,
  getBestBottlesRelativeScaleZoneForProduct,
  getBestBottlesCylinderFamilyProfile,
  getBestBottlesFamilyProfileForProduct,
} from "./bestBottlesFamilyProfiles";

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
  it("classifies 3ml Cylinder sprayers as compact fixed-studio products", () => {
    const profile = getBestBottlesCylinderFamilyProfile({
      family: "Cylinder",
      capacityMl: 3,
      heightWithCap: "54 mm",
      heightWithoutCap: "37 mm",
      diameter: "14 mm",
    });

    assert.deepEqual(profile, BEST_BOTTLES_CYLINDER_COMPACT_PROFILE);
    assert.equal(profile.canvas.widthPx, 2080);
    assert.equal(profile.canvas.heightPx, 2288);
    assert.equal(profile.label, "Cylinder Sample Vial");
    assert.deepEqual(profile.targetProductHeightRangePct, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.sampleVials);
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
    assert.deepEqual(profile.targetProductHeightRangePct, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.sampleVials);
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
    assert.equal(getBestBottlesFamilyProfileForProduct(small9ml)?.targetProductHeightPct, 63);
    assert.equal(getBestBottlesFamilyProfileForProduct(standard28ml)?.targetProductHeightPct, 76);
    assert.equal(getBestBottlesFamilyProfileForProduct(tall100ml)?.targetProductHeightPct, 82);
  });

  it("keeps 5ml short Cylinder sprayers below regular 9ml roll-ons and slim 9ml sprayers", () => {
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
    assert.deepEqual(fiveMlCapOffSprayer.targetProductHeightRangePct, { min: 60, max: 64 });
    assert.equal(fiveMlCapOffSprayer.targetProductHeightPct, 62);
    assert.ok(fiveMlCapOffSprayer.targetProductHeightPct < regular9MlRollOn.targetProductHeightPct);
    assert.ok(regular9MlRollOn.targetProductHeightPct < slim9MlSprayer.targetProductHeightPct);
  });

  it("uses measured slim height, not just 9ml capacity, for 13-415 slim 9ml Cylinder sprayers", () => {
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
    assert.equal(profile.targetProductHeightPct, 76);
    assert.deepEqual(profile.targetProductHeightRangePct, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.cylinders10To30Ml);
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
    assert.deepEqual(profile.targetProductHeightRangePct, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.cylinders10To30Ml);
    assert.ok(profile.targetProductHeightPct >= 72);
    assert.ok(profile.targetProductHeightPct <= 78);
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
    assert.deepEqual(profile.targetProductHeightRangePct, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.rollerBottles);
    assert.ok(profile.targetProductHeightPct >= 65);
    assert.ok(profile.targetProductHeightPct <= 70);
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
    assert.deepEqual(profile.targetProductHeightRangePct, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.bostonRounds);
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
    assert.deepEqual(empire.targetProductHeightRangePct, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.empireBottles);
    assert.equal(aluminum.id, "aluminum-bottle");
    assert.deepEqual(aluminum.targetProductHeightRangePct, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.aluminumBottles);
  });

  // LOCKED-IN capacity scale staircase — render-validated 2026-07-04 on the real
  // production sprayer/roller SKUs (measured fill-heights matched to the tenth:
  // 3ml→56.0%, 4ml→58.1%, 5ml→62.0%, 9ml→67%). This pins the relative-scale
  // gradation so smaller capacities always render genuinely smaller on the shared
  // canvas. Do not change these zone/fill targets without re-validating renders.
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
    const nineMl = getBestBottlesFamilyProfileForProduct({
      graceSku: "GB-CYL-CLR-9ML-T-07", family: "Cylinder", bottleCollection: "Cylinder",
      capacityMl: 9, applicator: "Metal Roller Ball",
      heightWithCap: "83 ±1 mm", heightWithoutCap: "70 ±1 mm", diameter: "20 ±0.5 mm",
    });

    for (const p of [threeMl, fourMl, fiveMl, nineMl]) {
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
    assert.equal(fiveMl.targetProductHeightPct, 62);
    assert.equal(nineMl.relativeScaleZoneId, "roller-bottle");
    assert.equal(nineMl.targetProductHeightPct, 67);
    // Strictly monotonic: smaller capacity is always rendered smaller.
    assert.ok(threeMl.targetProductHeightPct < fourMl.targetProductHeightPct);
    assert.ok(fourMl.targetProductHeightPct < fiveMl.targetProductHeightPct);
    assert.ok(fiveMl.targetProductHeightPct < nineMl.targetProductHeightPct);
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
