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

  it("keeps sprayer and pump housing contained at the neck while only the dip tube enters glass", () => {
    const rules = buildBestBottlesApplicatorPromptRules({
      applicator: "Fine Mist Sprayer",
    });

    const text = [
      rules.glassMaterialLine,
      rules.fitmentMaterialLine,
      ...rules.forbiddenLines,
    ].join("\n");

    assert.match(text, /pump housing belong to the top closure assembly/i);
    assert.match(text, /must not hang down the front face, float outside the glass walls/i);
    assert.match(text, /short white connector visible below the cap is an internal neck component/i);
    assert.match(text, /not a separate visible exterior product component/i);
    assert.match(text, /Do not render it as a distinct rectangular white block below the cap/i);
    assert.match(text, /At most, show a tiny translucent neck stem/i);
    assert.match(text, /Only the narrow dip tube may continue below the neck into the empty clear glass bottle/i);
    assert.match(text, /Do not render a large white pump chamber, funnel, plug, sleeve, cloudy column, milky block/i);
    assert.match(text, /No pump body, actuator housing, collar mass, white mechanism block/i);
    assert.doesNotMatch(text, /external pump housing position/i);
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
