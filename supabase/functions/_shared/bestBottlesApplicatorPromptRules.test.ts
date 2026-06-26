import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBestBottlesApplicatorPromptRules } from "./bestBottlesApplicatorPromptRules.ts";

describe("buildBestBottlesApplicatorPromptRules", () => {
  it("requires the internal dip tube for transparent sprayer and pump bottles", () => {
    const rules = buildBestBottlesApplicatorPromptRules({
      applicator: "Fine Mist Sprayer",
    });

    const text = [
      rules.sourceTruth,
      rules.glassMaterialLine,
      rules.fitmentMaterialLine,
    ].join("\n");

    assert.match(text, /visible internal dip tube/i);
    assert.match(text, /must be present/i);
    assert.match(text, /within a few millimeters of the interior base/i);
    assert.doesNotMatch(text, /dip tube if visible/i);
    assert.doesNotMatch(text, /dip tube if present/i);
  });

  it("keeps pale sprayer caps and detached over-caps readable on Bone", () => {
    const rules = buildBestBottlesApplicatorPromptRules({
      applicator: "Fine Mist Sprayer",
    });

    const text = [
      rules.fitmentMaterialLine,
      ...rules.forbiddenLines,
    ].join("\n");

    assert.match(text, /white, clear, translucent, or pale/i);
    assert.match(text, /detached over-cap/i);
    assert.match(text, /rim ellipse/i);
    assert.match(text, /must remain visible against the Bone background/i);
    assert.match(text, /No disappearing, washed-out, background-colored, ghosted, or erased cap/i);
  });

  it("requires the internal dip tube for clear bulb atomizer bottles", () => {
    const rules = buildBestBottlesApplicatorPromptRules({
      applicator: "Antique Bulb Sprayer",
    });

    const text = [
      rules.sourceTruth,
      rules.glassMaterialLine,
      rules.fitmentMaterialLine,
    ].join("\n");

    assert.match(text, /visible internal dip tube/i);
    assert.match(text, /must be present/i);
    assert.match(text, /inside the clear glass bottle/i);
  });

  it("keeps roller bottles explicitly tube-free", () => {
    const rules = buildBestBottlesApplicatorPromptRules({
      applicator: "Plastic Roller Ball",
    });

    const text = [
      rules.sourceTruth,
      rules.fitmentMaterialLine,
    ].join("\n");

    assert.match(text, /No hose, tassel, atomizer, pump, sprayer, or dip tube may be added/i);
  });
});
