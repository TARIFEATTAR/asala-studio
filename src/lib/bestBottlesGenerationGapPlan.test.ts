import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBestBottlesGenerationGapStages,
  getBestBottlesGenerationGapNextStage,
  type BestBottlesGenerationGapInput,
} from "./bestBottlesGenerationGapPlan.ts";

function input(overrides: Partial<BestBottlesGenerationGapInput> = {}): BestBottlesGenerationGapInput {
  return {
    totalSkuJobs: 2483,
    convexSynced: 1595,
    stagingUiFlaggedRows: 0,
    stagingUiRowsNeedingGeneration: 0,
    stagingUiRowsNeedingSyncOrPush: 0,
    stagingUiBlockedRows: 0,
    needsMeasurement: 0,
    needsPromptPolicy: 0,
    blockedTruthReview: 0,
    importLocalReference: 0,
    sourceWebsiteReference: 0,
    needsSourceMatch: 0,
    launchBatchRows: 0,
    launchBatchAttachExistingCdn: 0,
    launchBatchLocalGeneration: 0,
    launchBatchLegacyGeneration: 0,
    readyToGenerate: 0,
    queued: 0,
    generating: 0,
    reviewGenerated: 0,
    pushToShopify: 0,
    syncConvex: 0,
    ...overrides,
  };
}

describe("Best Bottles generation gap plan", () => {
  it("keeps the closure stages in launch operator order", () => {
    const stages = buildBestBottlesGenerationGapStages(input());

    assert.deepEqual(
      stages.map((stage) => stage.id),
      [
        "audit-staging-ui",
        "truth-and-measurements",
        "source-references",
        "launch-batches",
        "ready-to-generate",
        "queued-running",
        "review-generated",
        "push-shopify",
        "sync-convex",
        "complete",
      ],
    );
  });

  it("combines all reference intake work into the source references stage", () => {
    const stages = buildBestBottlesGenerationGapStages(
      input({
        importLocalReference: 176,
        sourceWebsiteReference: 528,
        needsSourceMatch: 47,
      }),
    );
    const sourceStage = stages.find((stage) => stage.id === "source-references");

    assert.equal(sourceStage?.count, 751);
    assert.equal(sourceStage?.status, "needs-work");
    assert.deepEqual(sourceStage?.breakdown, [
      { label: "Import local", value: 176 },
      { label: "Source website", value: 528 },
      { label: "Needs source match", value: 47 },
    ]);
  });

  it("tracks launch batch generation separately from broad source intake", () => {
    const stages = buildBestBottlesGenerationGapStages(
      input({
        launchBatchRows: 328,
        launchBatchAttachExistingCdn: 18,
        launchBatchLocalGeneration: 241,
        launchBatchLegacyGeneration: 69,
      }),
    );
    const launchBatchStage = stages.find((stage) => stage.id === "launch-batches");

    assert.equal(launchBatchStage?.count, 328);
    assert.equal(launchBatchStage?.status, "active");
    assert.deepEqual(launchBatchStage?.breakdown, [
      { label: "Attach CDN", value: 18 },
      { label: "Local gen", value: 241 },
      { label: "Website gen", value: 69 },
    ]);
  });

  it("treats a missing staging UI audit as the next action before generation work", () => {
    const stages = buildBestBottlesGenerationGapStages(
      input({
        stagingUiFlaggedRows: null,
        readyToGenerate: 84,
      }),
    );
    const auditStage = stages[0];
    const nextStage = getBestBottlesGenerationGapNextStage(stages);

    assert.equal(auditStage.id, "audit-staging-ui");
    assert.equal(auditStage.status, "not-run");
    assert.equal(nextStage?.id, "audit-staging-ui");
  });

  it("prioritizes blockers before ready-to-generate work", () => {
    const stages = buildBestBottlesGenerationGapStages(
      input({
        stagingUiFlaggedRows: 12,
        stagingUiRowsNeedingGeneration: 7,
        stagingUiRowsNeedingSyncOrPush: 5,
        stagingUiBlockedRows: 2,
        needsMeasurement: 3,
        blockedTruthReview: 4,
        readyToGenerate: 25,
      }),
    );

    assert.equal(stages.find((stage) => stage.id === "audit-staging-ui")?.count, 12);
    assert.equal(stages.find((stage) => stage.id === "truth-and-measurements")?.count, 9);
    assert.equal(stages.find((stage) => stage.id === "ready-to-generate")?.count, 25);
    assert.equal(getBestBottlesGenerationGapNextStage(stages)?.id, "audit-staging-ui");
  });

  it("uses Firecrawl measurement sourcing as the blocker action when measurements are missing", () => {
    const stages = buildBestBottlesGenerationGapStages(
      input({
        needsMeasurement: 3,
      }),
    );
    const blockerStage = stages.find((stage) => stage.id === "truth-and-measurements");

    assert.equal(blockerStage?.primaryAction, "Scrape measurements");
    assert.match(blockerStage?.description ?? "", /Firecrawl/i);
  });

  it("falls through to generation-ready work after audit, truth, and source stages are clear", () => {
    const stages = buildBestBottlesGenerationGapStages(
      input({
        stagingUiFlaggedRows: 0,
        readyToGenerate: 3,
      }),
    );

    assert.equal(getBestBottlesGenerationGapNextStage(stages)?.id, "ready-to-generate");
  });
});
