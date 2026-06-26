import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_CANVAS_TIERS,
  BEST_BOTTLES_CANVAS_TIER_ID_BY_FAMILY,
  getBestBottlesCanvasTierForFamily,
  resolveBestBottlesCanvasTier,
} from "./productImageCanvasTiers";
import { IMAGE_PRESETS } from "./imagePresets";

const flattenedReferenceFamilyKeys = [
  "aluminum-bottle",
  "apothecary",
  "atomizer",
  "cap-closure",
  "circle",
  "cream-jar",
  "cylinder",
  "diamond",
  "diva",
  "dropper",
  "elegant",
  "empire",
  "eternal-flame",
  "fine-mist-sprayer",
  "flair",
  "footed-rectangle",
  "genie-32ml",
  "grace",
  "heart-4ml",
  "lotion-pump",
  "marble-10ml",
  "marble-5ml",
  "pear-118ml",
  "pear-355ml",
  "plastic-bottle",
  "rectangle",
  "roll-on",
  "round",
  "royal",
  "sleek",
  "slim",
  "square",
  "tall-rectangle",
  "teardrop",
  "tola-3ml",
  "tola-6ml",
  "tulip",
  "vial",
  "vintage-bulb",
] as const;

describe("Best Bottles product image canvas tiers", () => {
  it("keeps Cylinder products on the native tall-narrow generation canvas", () => {
    const tier = getBestBottlesCanvasTierForFamily("Cylinder");

    assert.equal(tier.id, "tall-narrow");
    assert.deepEqual(tier.canvas, { widthPx: 1024, heightPx: 1536 });
    assert.equal(tier.aspectRatio, "2:3");
  });

  it("routes round and square families to a square canvas", () => {
    for (const family of ["Circle", "Round", "Square"]) {
      const tier = getBestBottlesCanvasTierForFamily(family);

      assert.equal(tier.id, "square-round");
      assert.deepEqual(tier.canvas, { widthPx: 2048, heightPx: 2048 });
      assert.equal(tier.aspectRatio, "1:1");
    }
  });

  it("routes low wide products to the landscape canvas", () => {
    for (const family of ["Cream Jar", "Heart 4ml"]) {
      const tier = getBestBottlesCanvasTierForFamily(family);

      assert.equal(tier.id, "wide-low");
      assert.deepEqual(tier.canvas, { widthPx: 1536, heightPx: 1024 });
      assert.equal(tier.aspectRatio, "3:2");
    }
  });

  it("can resolve a tier from measured foreground aspect when family is unknown", () => {
    assert.equal(resolveBestBottlesCanvasTier({ foregroundAspectHOverW: 0.65 }).id, "wide-low");
    assert.equal(resolveBestBottlesCanvasTier({ foregroundAspectHOverW: 1.27 }).id, "square-round");
    assert.equal(resolveBestBottlesCanvasTier({ foregroundAspectHOverW: 1.87 }).id, "tall-portrait");
  });

  it("prefers a known family route over measured foreground aspect", () => {
    const tier = resolveBestBottlesCanvasTier({
      family: "Cylinder",
      foregroundAspectHOverW: 0.65,
    });

    assert.equal(tier.id, "tall-narrow");
  });

  it("exports exactly four production canvas tiers", () => {
    assert.deepEqual(
      BEST_BOTTLES_CANVAS_TIERS.map((tier) => tier.id),
      ["tall-narrow", "tall-portrait", "square-round", "wide-low"],
    );
  });

  it("explicitly maps every family key found in the flattened reference set", () => {
    const missing = flattenedReferenceFamilyKeys.filter(
      (familyKey) => !BEST_BOTTLES_CANVAS_TIER_ID_BY_FAMILY[familyKey],
    );

    assert.deepEqual(missing, []);
  });

  it("registers prompt presets for the routed catalog canvas tiers", () => {
    assert.deepEqual(IMAGE_PRESETS["grid-card-tall-narrow-1024x1536"].canvas, {
      widthPx: 1024,
      heightPx: 1536,
    });
    assert.deepEqual(IMAGE_PRESETS["grid-card-square-round-2048x2048"].canvas, {
      widthPx: 2048,
      heightPx: 2048,
    });
    assert.deepEqual(IMAGE_PRESETS["grid-card-wide-low-1536x1024"].canvas, {
      widthPx: 1536,
      heightPx: 1024,
    });
  });
});
