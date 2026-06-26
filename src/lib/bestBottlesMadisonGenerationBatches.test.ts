import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMadisonGenerationBatchSections,
  getMadisonGenerationBatchLaneMeta,
  summarizeMadisonGenerationTruthReview,
  type MadisonGenerationBatchPlan,
} from "./bestBottlesMadisonGenerationBatches.ts";

const plan: MadisonGenerationBatchPlan = {
  generatedAt: "2026-06-16T03:32:11.963Z",
  source: {
    residualCsv: "remaining.csv",
    reconciliationJson: "reconciliation.json",
    existingMediaCheckJson: "existing.json",
  },
  mantra: "Generate by product truth; write by Grace SKU.",
  summary: {
    totalNoProductMedia: 5,
    selectedRows: 5,
    blockedRows: 0,
    batchCount: 2,
    byLane: {
      attach_existing_cdn_before_generation: 2,
      generate_from_local_reference: 3,
      generate_from_legacy_reference: 0,
      blocked_truth_review: 0,
    },
    byFamily: {
      Atomizer: 2,
      Slim: 3,
    },
  },
  batches: [
    {
      batchNumber: 1,
      batchLabel: "batch-01-attach_existing_cdn_before_generation",
      lane: "attach_existing_cdn_before_generation",
      rowCount: 2,
      productGroups: ["atomizer-5ml-slim"],
      families: ["Atomizer"],
    },
    {
      batchNumber: 2,
      batchLabel: "batch-02-generate_from_local_reference",
      lane: "generate_from_local_reference",
      rowCount: 3,
      productGroups: ["slim-30ml-clear-18-415-dropper", "slim-30ml-clear-18-415-lotionpump"],
      families: ["Slim"],
    },
  ],
  rows: [
    {
      batchNumber: 1,
      batchLabel: "batch-01-attach_existing_cdn_before_generation",
      batchLane: "attach_existing_cdn_before_generation",
      launchPriority: 1,
      launchVisibility: "smoke-test PDP/product group",
      family: "Atomizer",
      productGroupSlug: "atomizer-5ml-slim",
      graceSku: "GB-SLM-BLK-5ML-ATM-BLK-T",
      websiteSku: "GBAtom5SlimBlk",
      sourceIssue: "no_product_media",
      referenceSource: "shopify_existing_media",
      referenceUrlOrPath: "https://cdn.shopify.com/atomizer-black.png",
      generatedOrCdnUrl: "https://cdn.shopify.com/atomizer-black.png",
      nextAction: "Visual QA the existing CDN image, attach/upload it to the Shopify product media gallery, assign exact variant, then sync Convex by graceSku.",
      guardrail: "Generate by product truth; write by Grace SKU.",
    },
    {
      batchNumber: 1,
      batchLabel: "batch-01-attach_existing_cdn_before_generation",
      batchLane: "attach_existing_cdn_before_generation",
      launchPriority: 1,
      launchVisibility: "smoke-test PDP/product group",
      family: "Atomizer",
      productGroupSlug: "atomizer-5ml-slim",
      graceSku: "GB-SLM-CLR-5ML-ATM-GLD-T",
      websiteSku: "GBAtom5SlimGl",
      sourceIssue: "no_product_media",
      referenceSource: "shopify_existing_media",
      referenceUrlOrPath: "https://cdn.shopify.com/atomizer-gold.png",
      generatedOrCdnUrl: "https://cdn.shopify.com/atomizer-gold.png",
      nextAction: "Visual QA the existing CDN image, attach/upload it to the Shopify product media gallery, assign exact variant, then sync Convex by graceSku.",
      guardrail: "Generate by product truth; write by Grace SKU.",
    },
    {
      batchNumber: 2,
      batchLabel: "batch-02-generate_from_local_reference",
      batchLane: "generate_from_local_reference",
      launchPriority: 10,
      launchVisibility: "top nav Bottles design family",
      family: "Slim",
      productGroupSlug: "slim-30ml-clear-18-415-dropper",
      graceSku: "GB-SLM-CLR-30ML-DRP-BLK",
      websiteSku: "GBSlim30DropBlk",
      sourceIssue: "no_product_media",
      referenceSource: "local_repo",
      referenceUrlOrPath: "/refs/slim-dropper.png",
      generatedOrCdnUrl: null,
      nextAction: "Generate Madison PDP image from local reference, upload to Shopify, assign exact variant, then sync Convex by graceSku.",
      guardrail: "Generate by product truth; write by Grace SKU.",
    },
    {
      batchNumber: 2,
      batchLabel: "batch-02-generate_from_local_reference",
      batchLane: "generate_from_local_reference",
      launchPriority: 10,
      launchVisibility: "top nav Bottles design family",
      family: "Slim",
      productGroupSlug: "slim-30ml-clear-18-415-lotionpump",
      graceSku: "GB-SLM-CLR-30ML-PMP-BLK",
      websiteSku: "GBSlim30PumpBlk",
      sourceIssue: "no_product_media",
      referenceSource: "local_repo",
      referenceUrlOrPath: "/refs/slim-pump-black.png",
      generatedOrCdnUrl: null,
      nextAction: "Generate Madison PDP image from local reference, upload to Shopify, assign exact variant, then sync Convex by graceSku.",
      guardrail: "Generate by product truth; write by Grace SKU.",
    },
    {
      batchNumber: 2,
      batchLabel: "batch-02-generate_from_local_reference",
      batchLane: "generate_from_local_reference",
      launchPriority: 10,
      launchVisibility: "top nav Bottles design family",
      family: "Slim",
      productGroupSlug: "slim-30ml-clear-18-415-lotionpump",
      graceSku: "GB-SLM-CLR-30ML-PMP-GLD",
      websiteSku: "GBSlim30PumpGold",
      sourceIssue: "no_product_media",
      referenceSource: "local_repo",
      referenceUrlOrPath: "/refs/slim-pump-gold.png",
      generatedOrCdnUrl: null,
      nextAction: "Generate Madison PDP image from local reference, upload to Shopify, assign exact variant, then sync Convex by graceSku.",
      guardrail: "Generate by product truth; write by Grace SKU.",
    },
  ],
};

describe("Best Bottles Madison generation batch plan", () => {
  it("organizes rows by launch batch in plan order", () => {
    const sections = buildMadisonGenerationBatchSections(plan);

    assert.equal(sections.length, 2);
    assert.equal(sections[0].batchLabel, "batch-01-attach_existing_cdn_before_generation");
    assert.equal(sections[0].lane, "attach_existing_cdn_before_generation");
    assert.equal(sections[0].rowCount, 2);
    assert.deepEqual(sections[0].families, ["Atomizer"]);
    assert.deepEqual(sections[0].productGroups, ["atomizer-5ml-slim"]);

    assert.equal(sections[1].batchLabel, "batch-02-generate_from_local_reference");
    assert.equal(sections[1].rowCount, 3);
    assert.deepEqual(sections[1].families, ["Slim"]);
  });

  it("groups each batch by exact Studio product group destinations", () => {
    const sections = buildMadisonGenerationBatchSections(plan);

    assert.deepEqual(sections[0].studioDestinations, [
      {
        family: "Atomizer",
        productGroupSlug: "atomizer-5ml-slim",
        productGroupDisplayName: "Atomizer Slim",
        count: 2,
      },
    ]);
    assert.deepEqual(sections[1].studioDestinations, [
      {
        family: "Slim",
        productGroupSlug: "slim-30ml-clear-18-415-lotionpump",
        productGroupDisplayName: "Slim 30ml Clear 18 415 Lotionpump",
        count: 2,
      },
      {
        family: "Slim",
        productGroupSlug: "slim-30ml-clear-18-415-dropper",
        productGroupDisplayName: "Slim 30ml Clear 18 415 Dropper",
        count: 1,
      },
    ]);
  });

  it("names the batch lane by the operator action", () => {
    assert.deepEqual(getMadisonGenerationBatchLaneMeta("attach_existing_cdn_before_generation"), {
      label: "Attach existing CDN",
      tone: "destination",
      primaryAction: "QA, attach, assign, sync",
    });
    assert.deepEqual(getMadisonGenerationBatchLaneMeta("generate_from_local_reference"), {
      label: "Generate from local reference",
      tone: "generate",
      primaryAction: "Generate in Madison",
    });
    assert.deepEqual(getMadisonGenerationBatchLaneMeta("generate_from_legacy_reference"), {
      label: "Generate from BestBottles.com",
      tone: "source",
      primaryAction: "Verify, generate in Madison",
    });
  });

  it("keeps component and packaging media holds out of launch-wide truth blockers", () => {
    const summary = summarizeMadisonGenerationTruthReview([
      {
        batchNumber: 999,
        batchLabel: "blocked-truth-review",
        batchLane: "blocked_truth_review",
        launchPriority: 900,
        launchVisibility: "catalog path",
        family: "Unknown",
        productGroupSlug: "unknown-0ml-clear",
        graceSku: "PKG-BOX-BRN-4X4X4",
        websiteSku: null,
        sourceIssue: "no_product_media",
        referenceSource: "blocked",
        referenceUrlOrPath: null,
        generatedOrCdnUrl: null,
        nextAction: "Hold until product-truth evidence is resolved or explicitly waived.",
        guardrail: "Generate by product truth; write by Grace SKU.",
      },
      {
        batchNumber: 999,
        batchLabel: "blocked-truth-review",
        batchLane: "blocked_truth_review",
        launchPriority: 42,
        launchVisibility: "catalog path",
        family: "Cap/Component",
        productGroupSlug: "cap-closure-13-415",
        graceSku: "CMP-CAP-SBLK-13-415",
        websiteSku: null,
        sourceIssue: "no_product_media",
        referenceSource: "blocked",
        referenceUrlOrPath: null,
        generatedOrCdnUrl: null,
        nextAction: "Hold until product-truth evidence is resolved or explicitly waived.",
        guardrail: "Generate by product truth; write by Grace SKU.",
      },
      {
        batchNumber: 999,
        batchLabel: "blocked-truth-review",
        batchLane: "blocked_truth_review",
        launchPriority: 12,
        launchVisibility: "catalog path",
        family: "Cylinder",
        productGroupSlug: "cylinder-9ml-clear",
        graceSku: "GB-CYL-CLR-9ML-T-03",
        websiteSku: "GBCyl9MtlRoll",
        sourceIssue: "identity_conflict",
        referenceSource: "blocked",
        referenceUrlOrPath: null,
        generatedOrCdnUrl: null,
        nextAction: "Hold until product-truth evidence is resolved or explicitly waived.",
        guardrail: "Generate by product truth; write by Grace SKU.",
      },
    ]);

    assert.equal(summary.totalRows, 3);
    assert.equal(summary.componentMediaHolds, 2);
    assert.equal(summary.launchBlockingTruthRows, 1);
  });
});
