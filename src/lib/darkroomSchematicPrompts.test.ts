import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDarkroomSchematicPrompt } from "./darkroomSchematicPrompts";

describe("buildDarkroomSchematicPrompt", () => {
  it("builds a whole-product schematic prompt that preserves identity and canvas", () => {
    const prompt = buildDarkroomSchematicPrompt("whole-product");

    assert.match(prompt, /whole product schematic/i);
    assert.match(prompt, /preserve the exact product identity/i);
    assert.match(prompt, /Best Bottles Bone #F5F3EF/i);
    assert.doesNotMatch(prompt, /#EEE6D4/i);
    assert.match(prompt, /retain the source image canvas/i);
    assert.match(prompt, /Do not invent measurements/i);
    assert.doesNotMatch(prompt, /exploded assembly/i);
  });

  it("builds an exploded assembly prompt with only two cap-state assumptions", () => {
    const prompt = buildDarkroomSchematicPrompt("exploded");

    assert.match(prompt, /exploded assembly schematic/i);
    assert.match(prompt, /cap-off means the cap is visible beside the product/i);
    assert.match(prompt, /Best Bottles Bone #F5F3EF/i);
    assert.doesNotMatch(prompt, /#EEE6D4/i);
    assert.match(prompt, /Do not add parts/i);
    assert.match(prompt, /retain the source image canvas/i);
  });
});
