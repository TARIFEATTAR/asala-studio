import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBestBottlesStagingUiAuditSections,
  type BestBottlesStagingUiAudit,
} from "./bestBottlesStagingUiAudit.ts";

const audit: BestBottlesStagingUiAudit = {
  generatedAt: "2026-06-15T12:00:00.000Z",
  source: "audit_staging_ui_reference_images.mjs",
  baseUrl: "http://localhost:3000",
  summary: {
    renderedImagesChecked: 3,
    flaggedRows: 2,
    rowsNeedingGeneration: 1,
    rowsNeedingSyncOrPush: 1,
    blockedTruthReviewRows: 0,
    byFamily: {
      Cylinder: 1,
      Slim: 1,
    },
    byGenerationBucket: {
      generate_from_legacy_reference: 1,
      covered_madison_not_synced: 1,
    },
  },
  rows: [
    {
      surface: "catalog",
      stagingUrl: "http://localhost:3000/catalog?families=Cylinder",
      family: "Cylinder",
      productGroupSlug: "cylinder-9ml-clear-13-415-finemist",
      graceSku: "GB-CYL-CLR-9ML-SPR-SBLK",
      websiteSku: "GBCyl9SpryBlk",
      renderedImageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBCyl9SpryBlk.gif",
      imageClassification: "legacy_bestbottles_url",
      needsGenerationOrFix: "yes",
      generationBucket: "generate_from_legacy_reference",
      referenceSource: "legacy_site",
      referenceUrlOrPath: "https://www.bestbottles.com/images/store/enlarged_pics/GBCyl9SpryBlk.gif",
      existingMadisonEvidenceUrl: "",
      nextAction: "Generate Madison image, push to Shopify, sync Convex by graceSku.",
      qaStatus: "needs_generation",
      notes: "",
    },
    {
      surface: "pdp-gallery",
      stagingUrl: "http://localhost:3000/products/slim-30ml-clear-18-415-dropper",
      family: "Slim",
      productGroupSlug: "slim-30ml-clear-18-415-dropper",
      graceSku: "GB-SLM-CLR-30ML-DRP-BLK",
      websiteSku: "GBSlim30DropBlk",
      renderedImageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBSlim30DropBlk.gif",
      imageClassification: "legacy_bestbottles_url",
      needsGenerationOrFix: "yes",
      generationBucket: "covered_madison_not_synced",
      referenceSource: "madison_generated_evidence",
      referenceUrlOrPath: "",
      existingMadisonEvidenceUrl: "https://cdn.shopify.com/s/files/1/0739/9420/7524/files/slim-generated.png",
      nextAction: "Push/sync existing Madison generated evidence by graceSku.",
      qaStatus: "needs_sync_or_push",
      notes: "",
    },
    {
      surface: "catalog",
      stagingUrl: "http://localhost:3000/catalog?families=Bell",
      family: "Bell",
      productGroupSlug: "bell-10ml-clear-13-415-rollon",
      graceSku: "GB-BEL-CLR-10ML-ROL-BDOT",
      websiteSku: "GBBell10RollBlkDot",
      renderedImageUrl: "https://cdn.shopify.com/s/files/1/0739/9420/7524/files/bell-generated.png",
      imageClassification: "shopify_cdn_unknown",
      needsGenerationOrFix: "no",
      generationBucket: "",
      referenceSource: "",
      referenceUrlOrPath: "",
      existingMadisonEvidenceUrl: "",
      nextAction: "",
      qaStatus: "pass",
      notes: "",
    },
  ],
};

describe("Best Bottles staging UI audit lane", () => {
  it("groups only flagged rows by family and launch batch action", () => {
    const sections = buildBestBottlesStagingUiAuditSections(audit);

    assert.equal(sections.length, 2);
    assert.deepEqual(sections.map((section) => section.family), ["Cylinder", "Slim"]);
    assert.equal(sections[0].rowCount, 1);
    assert.equal(sections[0].generationBuckets.generate_from_legacy_reference, 1);
    assert.equal(sections[0].rows[0].graceSku, "GB-CYL-CLR-9ML-SPR-SBLK");
    assert.equal(sections[1].generationBuckets.covered_madison_not_synced, 1);
  });

  it("exposes exact Studio destinations for flagged rows", () => {
    const sections = buildBestBottlesStagingUiAuditSections(audit);

    assert.deepEqual(sections[0].studioDestinations, [
      {
        family: "Cylinder",
        productGroupSlug: "cylinder-9ml-clear-13-415-finemist",
        productGroupDisplayName: "Cylinder 9ml Clear 13 415 Finemist",
        count: 1,
      },
    ]);
  });
});
