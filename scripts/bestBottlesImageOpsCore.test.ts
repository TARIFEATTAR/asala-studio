import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findDuplicateSkuKeys,
  findRetiredReferenceHits,
  findStaleQueuedWithoutReferenceRows,
  summarizeImageOpsReadiness,
  type ImageOpsSkuJobRow,
} from "./bestBottlesImageOpsCore.ts";

function row(overrides: Partial<ImageOpsSkuJobRow>): ImageOpsSkuJobRow {
  return {
    id: "job-1",
    grace_sku: "GB-CYL-CLR-9ML-SPR-GLD",
    website_sku: "GB9MlGoldSprayer",
    shopify_sku: "GB-CYL-CLR-9ML-SPR-GLD",
    family: "Cylinder",
    product_group_slug: "cylinder-9ml-swirl-17-415-finemist",
    status: "queued",
    best_reference_candidate_path: null,
    expected_canonical_filename: null,
    reference_source: null,
    reference_source_path: null,
    reference_source_url: null,
    reference_issue: null,
    generated_image_id: null,
    generated_image_url: null,
    approved_image_id: null,
    approved_image_url: null,
    shopify_product_id: null,
    shopify_variant_id: null,
    last_error: null,
    ...overrides,
  };
}

describe("Best Bottles image ops readiness core", () => {
  it("finds queued/generating rows with no usable flattened reference and no generated image", () => {
    const stale = row({ id: "stale", status: "queued" });
    const ready = row({
      id: "ready",
      status: "queued",
      best_reference_candidate_path:
        "https://example.com/best-bottles/reference-imports/Cylinder/GB-CYL-CLR-9ML-SPR-GLD.png",
    });
    const generated = row({
      id: "generated",
      status: "generating",
      generated_image_url: "https://example.com/generated.png",
    });

    assert.deepEqual(
      findStaleQueuedWithoutReferenceRows([stale, ready, generated]).map((hit) => hit.id),
      ["stale"],
    );
  });

  it("flags retired Cylinder references across path, URL, filename, and metadata fields", () => {
    const hits = findRetiredReferenceHits([
      row({
        id: "transparent",
        best_reference_candidate_path:
          "https://example.com/generated-images/best-bottles/reference-imports/background-removed/Cylinder/GB-CYL-CLR-9ML-SPR-GLD.png",
      }),
      row({
        id: "mask-meta",
        best_reference_candidate_path:
          "https://example.com/generated-images/best-bottles/reference-imports/Cylinder/GB-CYL-CLR-9ML-SPR-SLV.png",
        reference_source_path: "pipeline/paper-doll/cylinder/GB-CYL-CLR-9ML-SPR-SLV.png",
      }),
      row({
        id: "flattened",
        best_reference_candidate_path:
          "https://example.com/generated-images/best-bottles/reference-imports/Cylinder/GB-CYL-CLR-9ML-SPR-BLK.png",
        expected_canonical_filename: "GB-CYL-CLR-9ML-SPR-BLK.png",
      }),
    ]);

    assert.deepEqual(hits.map((hit) => hit.id), ["transparent", "mask-meta"]);
  });

  it("detects duplicate SKU keys without treating blank keys as duplicates", () => {
    const duplicates = findDuplicateSkuKeys([
      row({ id: "one", grace_sku: "GB-CYL-CLR-9ML-SPR-GLD", website_sku: "" }),
      row({ id: "two", grace_sku: "GB-CYL-CLR-9ML-SPR-GLD", website_sku: null }),
      row({
        id: "three",
        grace_sku: "GB-CYL-CLR-9ML-SPR-SLV",
        website_sku: "",
        shopify_sku: "GB-CYL-CLR-9ML-SPR-SLV",
      }),
    ]);

    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0].key, "GBCYLCLR9MLSPRGLD");
    assert.deepEqual(duplicates[0].rowIds, ["one", "two"]);
  });

  it("summarizes blockers needed before mass generation and Shopify push", () => {
    const summary = summarizeImageOpsReadiness([
      row({ id: "stale", status: "queued" }),
      row({
        id: "approved-without-shopify",
        status: "approved",
        approved_image_url: "https://example.com/approved.png",
        approved_image_id: "image-1",
      }),
      row({
        id: "generated-without-url",
        status: "generated",
        generated_image_id: "image-2",
      }),
    ]);

    assert.equal(summary.totalRows, 3);
    assert.equal(summary.staleQueuedWithoutReference.length, 1);
    assert.equal(summary.generatedWithoutUrl.length, 1);
    assert.equal(summary.approvedWithoutUrl.length, 0);
    assert.equal(summary.missingShopifyVariantId.length, 3);
  });
});
