import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPromptForSku,
  generateJsonl,
  loadPromptSystem,
  readSkuInput,
} from "./generate-prompts";

const ROOT = process.cwd();

describe("Best Bottles modular prompt generator", () => {
  it("generates JSONL-ready prompt records for the sample SKU set", () => {
    const system = loadPromptSystem(ROOT);
    const skus = readSkuInput(`${ROOT}/examples/sample_skus.json`);
    const jsonl = generateJsonl(skus, system);
    const records = jsonl.split("\n").map((line) => JSON.parse(line));

    assert.equal(records.length, 10);
    assert.equal(records[0].sku, "GB-CYL-CLR-9ML-SPR-GLD");
    assert.ok(records[0].reference_image_path);
    assert.equal(records[0].product_family, "cylinder");
    assert.equal(records[0].frame_class, "tall_narrow");
    assert.match(records[0].final_prompt, /REFERENCE-LOCKED BEST BOTTLES PDP MASTER/i);
    assert.match(records[0].final_prompt, /conservative reference-preserving retouch/i);
    assert.match(records[0].final_prompt, /do not redraw/i);
    assert.match(records[0].final_prompt, /White, clear, translucent, or pale cap/i);
    assert.match(records[0].final_prompt, /Body material: clear glass/i);
    assert.deepEqual(records[0].qa_checklist.includes("white_caps_visible"), true);
  });

  it("keeps material truth scoped to the selected SKU material", () => {
    const system = loadPromptSystem(ROOT);
    const skus = readSkuInput(`${ROOT}/examples/sample_skus.json`);
    const atomizer = skus.find((sku) => sku.sku === "GB-ATM-BLK-10ML-SPR-BLK");
    const box = skus.find((sku) => sku.sku === "GB-BOX-WHT-30ML-CARTON");

    assert.ok(atomizer);
    assert.ok(box);

    const atomizerPrompt = buildPromptForSku(atomizer, system).final_prompt;
    const boxPrompt = buildPromptForSku(box, system).final_prompt;

    assert.match(atomizerPrompt, /opaque colored\/anodized metal shell/i);
    assert.doesNotMatch(atomizerPrompt, /glass caustics/i);
    assert.match(boxPrompt, /folding carton paperboard/i);
    assert.doesNotMatch(boxPrompt, /glass caustics|refraction through the body|transparent glass/i);
  });

  it("throws a useful error when a SKU references an unknown module", () => {
    const system = loadPromptSystem(ROOT);
    const skus = readSkuInput(`${ROOT}/examples/sample_skus.json`);
    const badSku = { ...skus[0], product_family: "missing_family" };

    assert.throws(
      () => buildPromptForSku(badSku, system),
      /Unknown product_family "missing_family"/,
    );
  });
});
