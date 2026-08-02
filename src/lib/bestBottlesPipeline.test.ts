import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findPipelineSkuJobForProductIdentity,
  shouldRecordGeneratedImageForSkuJob,
  type PipelineSkuJobIdentityRow,
} from "./bestBottlesPipelineSkuJobs";

type TestSkuJob = PipelineSkuJobIdentityRow & {
  id: string;
};

function job(overrides: Partial<TestSkuJob>): TestSkuJob {
  return {
    id: "job-1",
    grace_sku: "GB-CYL-CLR-9ML-SPR-GLD",
    website_sku: "GB9MlGoldSprayer",
    shopify_sku: "GB-CYL-CLR-9ML-SPR-GLD",
    status: "ready-to-generate",
    ...overrides,
  };
}

describe("Best Bottles pipeline SKU job identity helpers", () => {
  it("matches generation results to the exact SKU job by Grace, website, or Shopify SKU", () => {
    const jobs = [
      job({ id: "gold", grace_sku: "GB-CYL-CLR-9ML-SPR-GLD", website_sku: "GB9MlGoldSprayer" }),
      job({
        id: "silver",
        grace_sku: "GB-CYL-CLR-9ML-SPR-SLV",
        website_sku: "GB9MlSilverSprayer",
        shopify_sku: "GB-CYL-CLR-9ML-SPR-SLV",
      }),
    ];

    assert.equal(
      findPipelineSkuJobForProductIdentity(jobs, {
        graceSku: "GB-CYL-CLR-9ML-SPR-SLV",
        websiteSku: "GB9MlSilverSprayer",
      })?.id,
      "silver",
    );
    assert.equal(
      findPipelineSkuJobForProductIdentity(jobs, {
        graceSku: "missing",
        websiteSku: "GB9MlGoldSprayer",
      })?.id,
      "gold",
    );
  });

  it("does not let generated callbacks overwrite approved or pushed SKU jobs", () => {
    assert.equal(shouldRecordGeneratedImageForSkuJob(job({ status: "ready-to-generate" })), true);
    assert.equal(shouldRecordGeneratedImageForSkuJob(job({ status: "generated" })), true);
    assert.equal(shouldRecordGeneratedImageForSkuJob(job({ status: "approved" })), false);
    assert.equal(shouldRecordGeneratedImageForSkuJob(job({ status: "shopify-pushed" })), false);
    assert.equal(shouldRecordGeneratedImageForSkuJob(job({ status: "synced" })), false);
  });
});
