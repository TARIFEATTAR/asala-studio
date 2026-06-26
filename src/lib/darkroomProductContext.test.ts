import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDarkroomProductContext,
  extractDarkroomBestBottlesContext,
  summarizeDarkroomProductContext,
} from "./darkroomProductContext";

// Minimal Product Hub row shaped like the enrich-script output for a
// 4 ml clear vial/dropper Best Bottles group.
function makeBestBottlesProduct(overrides = {}) {
  return {
    id: "prod-1",
    name: "Vial Design 4 ml Clear Glass Dropper",
    slug: "vial-4ml-clear-dropper",
    sku: "GB-VIA-CLR-4ML-DRP-BLK",
    category: "Packaging",
    product_type: "Vial",
    short_description: "A compact clear vial.",
    long_description: "Long copy.",
    hero_image_url: "https://cdn.example.com/vial-4ml.png",
    collections: ["Vials"],
    metadata: {
      best_bottles: {
        family: "Vial",
        productGroupSlug: "vial-4ml-clear-dropper",
        graceSku: "GB-VIA-CLR-4ML-DRP-BLK",
        websiteSku: "VialClr4mlDrpBlk",
        capacityMl: 4,
        neckThread: "13-415",
        applicator: "Dropper",
        canonicalColor: "Clear",
      },
      bottle_specs: {
        dimensions: { unit: "mm", height_without_cap: 40, diameter: 16 },
        capacity: { ml: 4 },
        neck: { thread_size: "13-415" },
        container: { applicators: ["Dropper"], capStyles: ["Bulb"], capColors: ["Black"] },
        color: { canonical: "Clear" },
      },
    },
    ...overrides,
  } as unknown as Parameters<typeof buildDarkroomProductContext>[0];
}

describe("darkroom product context", () => {
  it("extracts Best Bottles fields from product metadata", () => {
    const ctx = extractDarkroomBestBottlesContext(makeBestBottlesProduct());
    assert.ok(ctx);
    assert.equal(ctx?.graceSku, "GB-VIA-CLR-4ML-DRP-BLK");
    assert.equal(ctx?.websiteSku, "VialClr4mlDrpBlk");
    assert.equal(ctx?.family, "Vial");
    assert.equal(ctx?.capacityMl, 4);
    assert.equal(ctx?.heightWithoutCap, "40");
    assert.equal(ctx?.diameter, "16");
    assert.equal(ctx?.applicator, "Dropper");
    assert.equal(ctx?.capColor, "Black");
  });

  it("builds an enriched payload and merges measurement overrides", () => {
    const payload = buildDarkroomProductContext(makeBestBottlesProduct(), [
      { graceSku: "GB-VIA-CLR-4ML-DRP-BLK", heightWithoutCap: "42", diameter: "15" },
    ]);

    // Standard Product Hub fields are present.
    assert.equal(payload.id, "prod-1");
    assert.equal(payload.sku, "GB-VIA-CLR-4ML-DRP-BLK");
    assert.equal(payload.product_type, "Vial");
    assert.equal(payload.hero_image_url, "https://cdn.example.com/vial-4ml.png");

    // Best Bottles fields are merged, with the override winning over catalog dims.
    assert.equal(payload.capacityMl, 4);
    assert.equal(payload.heightWithoutCap, "42");
    assert.equal(payload.diameter, "15");
    assert.equal(payload.applicator, "Dropper");
    assert.equal(payload.websiteSku, "VialClr4mlDrpBlk");
  });

  it("reports full context loaded when the hub hero image matches", () => {
    const product = makeBestBottlesProduct();
    const payload = buildDarkroomProductContext(product, []);
    const summary = summarizeDarkroomProductContext(product, payload, {
      url: "https://cdn.example.com/vial-4ml.png",
      name: product.name,
    });

    assert.equal(summary.imageStatus, "product-hub");
    assert.equal(summary.imageSourceLabel, "Product Hub image");
    assert.equal(summary.isBestBottles, true);
    assert.equal(summary.hasMeasurements, true);
    assert.equal(summary.fullyLoaded, true);
    assert.equal(summary.capacity, "4 ml");
    assert.equal(summary.heightWithoutCap, "40 mm");
  });

  it("flags missing image and missing measurements", () => {
    const product = makeBestBottlesProduct({
      hero_image_url: null,
      metadata: {
        best_bottles: { family: "Vial", graceSku: "GB-VIA-CLR-4ML-DRP-BLK" },
      },
    });
    const payload = buildDarkroomProductContext(product, []);

    const noImage = summarizeDarkroomProductContext(product, payload, null);
    assert.equal(noImage.imageStatus, "missing");
    assert.equal(noImage.fullyLoaded, false);

    const customImage = summarizeDarkroomProductContext(product, payload, {
      url: "https://uploads.example.com/manual.png",
    });
    assert.equal(customImage.imageStatus, "manual");
    assert.equal(customImage.hasMeasurements, false);
    assert.equal(customImage.fullyLoaded, false);

    // An explicit source (e.g. pipeline reference) is reflected in the summary.
    const pipelineImage = summarizeDarkroomProductContext(
      product,
      payload,
      { url: "https://refs.example.com/clean.png" },
      "pipeline-reference",
    );
    assert.equal(pipelineImage.imageStatus, "pipeline-reference");
    assert.equal(pipelineImage.imageSourceLabel, "Pipeline reference");
  });

  it("handles non-Best-Bottles products without inventing fields", () => {
    const product = {
      id: "p2",
      name: "Generic Serum",
      sku: "SER-001",
      category: "Skincare",
      product_type: "Serum",
      hero_image_url: "https://cdn.example.com/serum.png",
      collections: [],
      metadata: {},
    } as unknown as Parameters<typeof buildDarkroomProductContext>[0];

    assert.equal(extractDarkroomBestBottlesContext(product), null);

    const payload = buildDarkroomProductContext(product, []);
    assert.equal(payload.name, "Generic Serum");
    assert.equal(payload.graceSku, undefined);

    const summary = summarizeDarkroomProductContext(product, payload, {
      url: "https://cdn.example.com/serum.png",
    });
    // Non-Best-Bottles product: image present and measurements N/A → fully loaded.
    assert.equal(summary.isBestBottles, false);
    assert.equal(summary.imageStatus, "product-hub");
    assert.equal(summary.fullyLoaded, true);
  });
});
