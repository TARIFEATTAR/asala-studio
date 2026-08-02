import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const endpointUrl = new URL(
  "../generate-bestbottles-material-pilot/index.ts",
  import.meta.url,
);

describe("material pilot edge quarantine", () => {
  it("uses fixed provider adapters, whole-raster normalization, and no background painting", () => {
    const source = readFileSync(endpointUrl, "utf8");
    assert.match(source, /OpenAIProvider\.generateImage/);
    assert.match(source, /callGeminiImage/);
    assert.match(source, /conformImageToCanvas/);
    assert.match(source, /evaluateNativeBoneCanvas/);
    assert.match(source, /buildMaterialPilotScaleContract/);
    assert.match(source, /evaluateMaterialPilotScaleQa/);
    assert.match(source, /framing_qa:\s*scaleQa/);
    assert.doesNotMatch(source, /containImageOnCanvas/);
    assert.doesNotMatch(source, /applyRigForegroundMatte/);
    assert.doesNotMatch(source, /flattenBackgroundLikePixels/);
    assert.doesNotMatch(source, /generate-madison-image/);
  });

  it("records the attempt before the provider call and never makes it publish eligible", () => {
    const source = readFileSync(endpointUrl, "utf8");
    const insertAt = source.indexOf('"best_bottles_material_pilot_attempts"');
    const executeAt = source.indexOf("executeMaterialPilotRenderer(");
    assert.ok(insertAt >= 0 && executeAt > insertAt);
    assert.match(source, /publish_eligible:\s*false/);
    assert.match(source, /background_mutated:\s*false/);
    assert.match(source, /best_bottles_material_pilot_mark_attempt_launched/);
    assert.match(source, /best_bottles_material_pilot_mark_attempt_completed/);
  });

  it("allows only an explicitly marked service-role automation request", () => {
    const source = readFileSync(endpointUrl, "utf8");
    assert.match(source, /jwtRole\(token\) === "service_role"/);
    assert.match(source, /x-material-pilot-automation/);
    assert.match(source, /=== "service"/);
  });
});
