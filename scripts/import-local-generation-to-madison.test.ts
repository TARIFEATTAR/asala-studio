import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildGeneratedImageInsert,
  buildStoragePath,
  parseGenerationReport,
  selectImportableRows,
} from "./import-local-generation-to-madison.ts";

describe("local generation → Madison importer planning", () => {
  it("parses the generation report and imports only ok / qa-warning rows with existing PNGs", () => {
    const dir = mkdtempSync(join(tmpdir(), "madison-import-test-"));
    const pngPath = join(dir, "GB-SQR-CLR-15ML-SPR-SBLK.png");
    writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const report = join(dir, "_generation-report.csv");
    writeFileSync(
      report,
      [
        "graceSku,websiteSku,mode,cycleId,pipelineLaneId,presetId,status,outputPath,genTimeSec,promptLength,shapeDescriptorPresent,frameQaStatus,frameCenterDeltaPx,frameBaselineDeltaPx,frameHeightDeltaPct,frameQaNotes,error",
        `GB-SQR-CLR-15ML-SPR-SBLK,GBSqr15SpryBlkSh,cap-on,cycle-01,grid-card-2000x2200,grid-card-2000x2200,ok,${pngPath},18.2,20970,true,pass,1,0,-0.018,canvas=2080x2288; centerDeltaPx=1,`,
        `GB-BAD,GBBad,cap-on,cycle-01,grid-card-2000x2200,grid-card-2000x2200,error,${join(dir, "GB-BAD.png")},,,,,,,,,api failed`,
      ].join("\n"),
    );

    const parsed = parseGenerationReport(report);
    const importable = selectImportableRows(parsed);

    assert.equal(parsed.length, 2);
    assert.equal(importable.length, 1);
    assert.equal(importable[0].graceSku, "GB-SQR-CLR-15ML-SPR-SBLK");
  });

  it("builds deterministic storage paths and generated_images insert payloads for Madison UI", () => {
    const row = {
      graceSku: "GB-SQR-CLR-15ML-SPR-SBLK",
      websiteSku: "GBSqr15SpryBlkSh",
      mode: "cap-on",
      cycleId: "cycle-01",
      pipelineLaneId: "grid-card-2000x2200",
      presetId: "grid-card-2000x2200",
      status: "ok",
      outputPath: "/tmp/GB-SQR-CLR-15ML-SPR-SBLK.png",
      genTimeSec: "18.2",
      promptLength: "20970",
      shapeDescriptorPresent: "true",
      frameQaStatus: "pass",
      frameCenterDeltaPx: "1",
      frameBaselineDeltaPx: "0",
      frameHeightDeltaPct: "-0.018",
      frameQaNotes: "canvas=2080x2288",
      error: "",
    };

    const storagePath = buildStoragePath({
      batchSlug: "missing-clear-ms-batch-001",
      row,
    });
    assert.equal(
      storagePath,
      "best-bottles/local-generation/missing-clear-ms-batch-001/cap-on/GB-SQR-CLR-15ML-SPR-SBLK.png",
    );

    const payload = buildGeneratedImageInsert({
      row,
      imageUrl: "https://example.supabase.co/storage/v1/object/public/generated-images/best-bottles/local-generation/missing-clear-ms-batch-001/cap-on/GB-SQR-CLR-15ML-SPR-SBLK.png",
      userId: "user-123",
      organizationId: "org-456",
      referenceImageUrl: "file:///reference.png",
      batchSlug: "missing-clear-ms-batch-001",
    });

    assert.equal(payload.user_id, "user-123");
    assert.equal(payload.organization_id, "org-456");
    assert.equal(payload.image_url.includes("GB-SQR-CLR-15ML-SPR-SBLK.png"), true);
    assert.equal(payload.aspect_ratio, "2080:2288");
    assert.equal(payload.goal_type, "product_photography");
    assert.equal(payload.saved_to_library, true);
    assert.equal(payload.is_hero_image, true);
    assert.equal(payload.library_category, "content");
    assert.equal(payload.output_format, "png");
    assert.equal(payload.selected_template, "grid-card-2080x2288");
    assert.equal(payload.final_prompt.includes("GB-SQR-CLR-15ML-SPR-SBLK"), true);
    assert.deepEqual(payload.brand_style_tags, [
      "best-bottles",
      "local-generation",
      "cap-on",
      "missing-clear-ms-batch-001",
      "frame-pass",
    ]);
    assert.deepEqual((payload as any).library_tags, payload.brand_style_tags);
    assert.equal((payload.brand_context_used as any).graceSku, "GB-SQR-CLR-15ML-SPR-SBLK");
    assert.equal((payload.brand_context_used as any).websiteSku, "GBSqr15SpryBlkSh");
    assert.equal((payload.reference_images as any).primary, "file:///reference.png");
  });
});
